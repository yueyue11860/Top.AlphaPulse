import { createClient } from '@supabase/supabase-js';

function getEnv() {
  const url = process.env.VITE_SUPABASE_STOCK_URL;
  const key = process.env.SUPABASE_STOCK_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_STOCK_ANON_KEY;
  return { url, key };
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === 'object' ? metadata : {};
}

function buildLogKey(ruleId, tradeDate, tsCode, alertType) {
  return `${ruleId}:${tradeDate}:${tsCode}:${alertType}`;
}

function evaluateRule(rule, latestRows, previousRows) {
  const config = normalizeMetadata(rule.condition_config);
  const latestMap = new Map(latestRows.map((item) => [item.ts_code, item]));
  const previousMap = new Map(previousRows.map((item) => [item.ts_code, item]));
  const threshold = Number(config.threshold ?? 0);
  const rankThreshold = Number(config.rankThreshold ?? 0);
  const technicalSignal = typeof config.technicalSignal === 'string' ? config.technicalSignal : '';
  const matches = [];

  if (rule.alert_type === 'new_match') {
    latestRows.forEach((item) => {
      if (!previousMap.has(item.ts_code)) {
        matches.push({
          ts_code: item.ts_code,
          name: item.name,
          trade_date: item.trade_date,
          alert_title: `${item.name || item.ts_code} 新进入策略池`,
          alert_content: `该股票在 ${item.trade_date} 新进入策略结果池，当前分数 ${(item.score ?? 0).toFixed(0)}。`,
          alert_data: { latest: item },
        });
      }
    });
  }

  if (rule.alert_type === 'score_change') {
    latestRows.forEach((item) => {
      const previous = previousMap.get(item.ts_code);
      if (!previous) return;
      const scoreDiff = (item.score ?? 0) - (previous.score ?? 0);
      if (Math.abs(scoreDiff) >= threshold) {
        matches.push({
          ts_code: item.ts_code,
          name: item.name,
          trade_date: item.trade_date,
          alert_title: `${item.name || item.ts_code} 评分变化提醒`,
          alert_content: `评分变化 ${scoreDiff > 0 ? '+' : ''}${scoreDiff.toFixed(0)}，当前 ${(item.score ?? 0).toFixed(0)} 分。`,
          alert_data: { latest: item, previous, scoreDiff },
        });
      }
    });
  }

  if (rule.alert_type === 'price_threshold') {
    latestRows.forEach((item) => {
      if ((item.close_price ?? 0) >= threshold) {
        matches.push({
          ts_code: item.ts_code,
          name: item.name,
          trade_date: item.trade_date,
          alert_title: `${item.name || item.ts_code} 价格阈值提醒`,
          alert_content: `价格 ${(item.close_price ?? 0).toFixed(2)} 触达阈值 ${threshold.toFixed(2)}。`,
          alert_data: { latest: item, threshold },
        });
      }
    });
  }

  if (rule.alert_type === 'technical_signal') {
    latestRows.forEach((item) => {
      const metadata = normalizeMetadata(item.metadata);
      const matchedFilters = toArray(metadata.matchedFilters).map(String);
      if (technicalSignal && matchedFilters.includes(technicalSignal)) {
        matches.push({
          ts_code: item.ts_code,
          name: item.name,
          trade_date: item.trade_date,
          alert_title: `${item.name || item.ts_code} 技术信号提醒`,
          alert_content: `命中技术信号 ${technicalSignal}。`,
          alert_data: { latest: item, technicalSignal },
        });
      }
    });
  }

  if (rule.alert_type === 'volume_spike') {
    latestRows.forEach((item) => {
      const metadata = normalizeMetadata(item.metadata);
      const matchedFilters = toArray(metadata.matchedFilters).map(String);
      if (matchedFilters.includes('volume_burst')) {
        matches.push({
          ts_code: item.ts_code,
          name: item.name,
          trade_date: item.trade_date,
          alert_title: `${item.name || item.ts_code} 放量提醒`,
          alert_content: `该股票在最新一期结果中命中放量条件。`,
          alert_data: { latest: item },
        });
      }
    });
  }

  if (rule.alert_type === 'rank_change') {
    latestRows.forEach((item) => {
      const previous = previousMap.get(item.ts_code);
      if (!previous) return;
      const rankDiff = (previous.rank_num ?? 999) - (item.rank_num ?? 999);
      if (rankDiff >= rankThreshold) {
        matches.push({
          ts_code: item.ts_code,
          name: item.name,
          trade_date: item.trade_date,
          alert_title: `${item.name || item.ts_code} 排名提升提醒`,
          alert_content: `排名提升 ${rankDiff} 位，当前第 ${item.rank_num ?? '--'} 名。`,
          alert_data: { latest: item, previous, rankDiff },
        });
      }
    });
  }

  return matches;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url, key } = getEnv();
  if (!url || !key) {
    res.status(503).json({ error: 'Stock Supabase server credentials are not configured' });
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const strategyId = typeof req.body?.strategyId === 'number' ? req.body.strategyId : null;

  try {
    let ruleQuery = supabase.from('picker_alert_rule').select('*').eq('is_active', true);
    if (strategyId !== null) {
      ruleQuery = ruleQuery.eq('strategy_id', strategyId);
    }

    const { data: rules, error: ruleError } = await ruleQuery;
    if (ruleError) throw ruleError;

    let insertedLogs = 0;
    let triggeredRules = 0;

    for (const rule of rules ?? []) {
      const { data: snapshotRows, error: snapshotError } = await supabase
        .from('picker_result')
        .select('*')
        .eq('strategy_id', rule.strategy_id)
        .order('trade_date', { ascending: false })
        .order('rank_num', { ascending: true })
        .limit(200);

      if (snapshotError) throw snapshotError;
      const grouped = new Map();
      for (const row of snapshotRows ?? []) {
        if (!grouped.has(row.trade_date)) grouped.set(row.trade_date, []);
        grouped.get(row.trade_date).push(row);
      }

      const dates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));
      const latestRows = dates[0] ? grouped.get(dates[0]) : [];
      const previousRows = dates[1] ? grouped.get(dates[1]) : [];
      if (!latestRows || latestRows.length === 0) continue;

      const matches = evaluateRule(rule, latestRows, previousRows || []);
      if (matches.length === 0) continue;

      const tradeDate = latestRows[0].trade_date;
      const { data: existingLogs } = await supabase
        .from('picker_alert_log')
        .select('rule_id, trade_date, ts_code, alert_type')
        .eq('rule_id', rule.id)
        .eq('trade_date', tradeDate);

      const existingKeys = new Set((existingLogs ?? []).map((item) => buildLogKey(item.rule_id, item.trade_date, item.ts_code, item.alert_type)));
      const newLogs = matches
        .filter((item) => !existingKeys.has(buildLogKey(rule.id, item.trade_date, item.ts_code, rule.alert_type)))
        .map((item) => ({
          rule_id: rule.id,
          ts_code: item.ts_code,
          name: item.name,
          trade_date: item.trade_date,
          alert_type: rule.alert_type,
          alert_title: item.alert_title,
          alert_content: item.alert_content,
          alert_data: item.alert_data,
          is_read: false,
        }));

      if (newLogs.length === 0) continue;

      const { error: insertError } = await supabase.from('picker_alert_log').insert(newLogs);
      if (insertError) throw insertError;

      const nextTriggerCount = Number(rule.trigger_count ?? 0) + newLogs.length;
      const { error: updateError } = await supabase
        .from('picker_alert_rule')
        .update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: nextTriggerCount,
        })
        .eq('id', rule.id);
      if (updateError) throw updateError;

      insertedLogs += newLogs.length;
      triggeredRules += 1;
    }

    res.status(200).json({
      scannedRules: (rules ?? []).length,
      triggeredRules,
      insertedLogs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown alert scan error';
    res.status(500).json({ error: message });
  }
}