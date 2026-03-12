import { logger, supabaseStock } from './serviceUtils';
import type { QuickBacktestResult } from './backtestService';
import type { StockScreenerResultItem } from './screenerService';
import { ENABLE_PICKER_ALERTS } from '@/config/featureFlags';
import type {
  PickerAlertLogRow,
  PickerAlertRuleRow,
  PickerBacktestDailyRow,
  PickerBacktestRow,
  PickerBacktestTradeRow,
  PickerResultRow,
} from '@/types/database';

interface SaveScreenerResultsParams {
  strategyId: number;
  tradeDate: string | null;
  items: StockScreenerResultItem[];
}

interface SaveQuickBacktestSummaryParams {
  strategyId: number;
  startDate: string;
  endDate: string;
  holdingDays: number;
  topN: number;
  result: QuickBacktestResult;
}

export type AlertType = 'new_match' | 'score_change' | 'price_threshold' | 'technical_signal' | 'volume_spike' | 'rank_change';

interface CreateAlertRuleParams {
  strategyId: number;
  name: string;
  alertType: AlertType;
  threshold?: number;
  rankThreshold?: number;
  lookbackDays?: number;
  technicalSignal?: string;
  checkInterval?: number;
  cooldown?: number;
  inApp?: boolean;
}

interface BacktestDetail {
  trades: PickerBacktestTradeRow[];
  daily: PickerBacktestDailyRow[];
}

interface UnreadAlertSummary {
  unreadCount: number;
  logs: PickerAlertLogRow[];
}

function isPickerAlertEnabled(): boolean {
  return ENABLE_PICKER_ALERTS;
}

function normalizeDate(date: string | null): string | null {
  if (!date) return null;
  if (date.length === 8 && !date.includes('-')) {
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  }
  return date;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function computeMaxDrawdown(returns: number[]) {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  let maxDrawdownStartIndex = 0;
  let maxDrawdownEndIndex = 0;
  let currentPeakIndex = 0;

  returns.forEach((item, index) => {
    equity *= 1 + item;
    if (equity > peak) {
      peak = equity;
      currentPeakIndex = index;
    }

    const drawdown = peak > 0 ? (peak - equity) / peak : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownStartIndex = currentPeakIndex;
      maxDrawdownEndIndex = index;
    }
  });

  return {
    maxDrawdown,
    startIndex: maxDrawdownStartIndex,
    endIndex: maxDrawdownEndIndex,
  };
}

function createRuleId(strategyId: number): string {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) ?? `${Date.now()}`;
  return `rule_${strategyId}_${random}`;
}

function buildAlertConditionConfig(params: CreateAlertRuleParams): Record<string, unknown> {
  return {
    mode: params.alertType,
    threshold: params.threshold ?? null,
    rankThreshold: params.rankThreshold ?? null,
    lookbackDays: params.lookbackDays ?? 1,
    technicalSignal: params.technicalSignal ?? null,
  };
}

function buildAlertChannels(params: CreateAlertRuleParams): Record<string, unknown> {
  return {
    inApp: params.inApp !== false,
  };
}

export async function saveScreenerResultsSnapshot(params: SaveScreenerResultsParams): Promise<number> {
  const tradeDate = normalizeDate(params.tradeDate);
  if (!tradeDate) return 0;

  const rows = params.items.map((item, index) => ({
    strategy_id: params.strategyId,
    trade_date: tradeDate,
    ts_code: item.code,
    name: item.name,
    close_price: item.price,
    pct_chg: item.change,
    score: item.score,
    rank_num: index + 1,
    metadata: {
      technicalScore: item.technicalScore,
      fundamentalScore: item.fundamentalScore,
      capitalScore: item.capitalScore,
      matchedFilters: item.matchedFilters,
      reasons: item.reasons,
      market: item.market,
      industry: item.industry,
      pe: item.pe,
      pb: item.pb,
      roe: item.roe,
      profitYoy: item.profitYoy,
      debtToAssets: item.debtToAssets,
    },
  }));

  try {
    await supabaseStock
      .from('picker_result')
      .delete()
      .eq('strategy_id', params.strategyId)
      .eq('trade_date', tradeDate);

    if (rows.length === 0) return 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseStock as any).from('picker_result').insert(rows);
    if (error) throw error;
    return rows.length;
  } catch (error) {
    logger.warn('保存选股结果快照失败:', error);
    return 0;
  }
}

export async function fetchRecentResultSnapshots(strategyId: number, limit = 20): Promise<PickerResultRow[]> {
  try {
    const { data, error } = await supabaseStock
      .from('picker_result')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('trade_date', { ascending: false })
      .order('rank_num', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    logger.warn('获取结果快照失败:', error);
    return [];
  }
}

export async function saveQuickBacktestSummary(params: SaveQuickBacktestSummaryParams): Promise<PickerBacktestRow | null> {
  const cycleReturns = params.result.trades.map((item) => item.averageReturn / 100);
  const wins = cycleReturns.filter((item) => item > 0);
  const losses = cycleReturns.filter((item) => item < 0);
  const mean = average(cycleReturns);
  const volatility = standardDeviation(cycleReturns);
  const annualFactor = params.holdingDays > 0 ? Math.sqrt(245 / params.holdingDays) : 1;
  const annualizedReturn = params.holdingDays > 0 ? Math.pow(1 + mean, 245 / params.holdingDays) - 1 : mean;
  const sharpeRatio = volatility > 0 ? (mean / volatility) * annualFactor : 0;
  const downsideDeviation = standardDeviation(losses.length > 0 ? losses : [0]);
  const sortinoRatio = downsideDeviation > 0 ? (mean / downsideDeviation) * annualFactor : 0;
  const drawdownStats = computeMaxDrawdown(cycleReturns);
  const profitFactor = Math.abs(losses.reduce((sum, item) => sum + item, 0)) > 0
    ? wins.reduce((sum, item) => sum + item, 0) / Math.abs(losses.reduce((sum, item) => sum + item, 0))
    : wins.length > 0 ? wins.reduce((sum, item) => sum + item, 0) : 0;
  const profitLossRatio = losses.length > 0 ? average(wins) / Math.abs(average(losses)) : average(wins);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseStock as any)
      .from('picker_backtest')
      .insert({
        strategy_id: params.strategyId,
        start_date: params.startDate,
        end_date: params.endDate,
        initial_capital: 1000000,
        total_return: mean,
        annualized_return: annualizedReturn,
        max_drawdown: drawdownStats.maxDrawdown,
        max_drawdown_start: params.result.trades[drawdownStats.startIndex]?.entryDate ?? params.startDate,
        max_drawdown_end: params.result.trades[drawdownStats.endIndex]?.exitDate ?? params.endDate,
        sharpe_ratio: sharpeRatio,
        sortino_ratio: sortinoRatio,
        calmar_ratio: drawdownStats.maxDrawdown > 0 ? annualizedReturn / drawdownStats.maxDrawdown : annualizedReturn,
        win_rate: params.result.winRate / 100,
        profit_factor: profitFactor,
        profit_loss_ratio: Number.isFinite(profitLossRatio) ? profitLossRatio : null,
        total_trades: params.result.totalSignals,
        avg_win: wins.length > 0 ? average(wins) : 0,
        avg_loss: losses.length > 0 ? average(losses) : 0,
        benchmark_return: null,
        alpha: null,
        beta: null,
        information_ratio: null,
        volatility,
        turnover_rate: params.topN,
        avg_holding_period: params.holdingDays,
        result_detail: {
          holdingDays: params.holdingDays,
          topN: params.topN,
          rebalanceCount: params.result.rebalanceCount,
          totalSignals: params.result.totalSignals,
          averageReturnPct: params.result.averageReturn,
          bestReturnPct: params.result.bestReturn,
          worstReturnPct: params.result.worstReturn,
          trades: params.result.trades,
        },
      })
      .select('*')
      .single();

    if (error) throw error;

    const insertedBacktest = data as PickerBacktestRow;
    const initialCapital = 1000000;
    let totalValue = initialCapital;
    let peakValue = initialCapital;
    const dailyRows = params.result.trades.map((item) => {
      totalValue *= 1 + item.averageReturn / 100;
      peakValue = Math.max(peakValue, totalValue);
      return {
        backtest_id: insertedBacktest.id,
        trade_date: item.exitDate,
        total_value: Number(totalValue.toFixed(2)),
        cash: 0,
        market_value: Number(totalValue.toFixed(2)),
        daily_return: Number((item.averageReturn / 100).toFixed(4)),
        cumulative_return: Number(((totalValue - initialCapital) / initialCapital).toFixed(4)),
        drawdown: peakValue > 0 ? Number(((peakValue - totalValue) / peakValue).toFixed(4)) : 0,
        position_count: item.positions.length,
      };
    });

    const tradeRows = params.result.trades.flatMap((cycle) => cycle.positions.flatMap((position) => {
      const shares = Math.max(100, Math.round((initialCapital / Math.max(params.topN, 1)) / Math.max(position.entryPrice, 0.01) / 100) * 100);
      const buyAmount = Number((shares * position.entryPrice).toFixed(2));
      const sellAmount = Number((shares * position.exitPrice).toFixed(2));
      return [
        {
          backtest_id: insertedBacktest.id,
          trade_date: cycle.entryDate,
          ts_code: position.code,
          name: position.name,
          action: 'BUY',
          price: position.entryPrice,
          shares,
          amount: buyAmount,
          commission: 0,
          slippage: 0,
          reason: `回测建仓，区间 ${cycle.entryDate} -> ${cycle.exitDate}`,
        },
        {
          backtest_id: insertedBacktest.id,
          trade_date: cycle.exitDate,
          ts_code: position.code,
          name: position.name,
          action: 'SELL',
          price: position.exitPrice,
          shares,
          amount: sellAmount,
          commission: 0,
          slippage: 0,
          reason: `回测平仓，收益 ${position.returnPct.toFixed(2)}%`,
        },
      ];
    }));

    if (tradeRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseStock as any).from('picker_backtest_trade').insert(tradeRows);
    }

    if (dailyRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseStock as any).from('picker_backtest_daily').insert(dailyRows);
    }

    return data;
  } catch (error) {
    logger.warn('保存回测记录失败:', error);
    return null;
  }
}

export async function fetchRecentBacktests(strategyId: number, limit = 6): Promise<PickerBacktestRow[]> {
  try {
    const { data, error } = await supabaseStock
      .from('picker_backtest')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    logger.warn('获取回测记录失败:', error);
    return [];
  }
}

export async function fetchBacktestDetail(backtestId: number): Promise<BacktestDetail> {
  try {
    const [tradeResponse, dailyResponse] = await Promise.all([
      supabaseStock
        .from('picker_backtest_trade')
        .select('*')
        .eq('backtest_id', backtestId)
        .order('trade_date', { ascending: true }),
      supabaseStock
        .from('picker_backtest_daily')
        .select('*')
        .eq('backtest_id', backtestId)
        .order('trade_date', { ascending: true }),
    ]);

    if (tradeResponse.error) throw tradeResponse.error;
    if (dailyResponse.error) throw dailyResponse.error;

    return {
      trades: (tradeResponse.data ?? []) as PickerBacktestTradeRow[],
      daily: (dailyResponse.data ?? []) as PickerBacktestDailyRow[],
    };
  } catch (error) {
    logger.warn('获取回测详情失败:', error);
    return { trades: [], daily: [] };
  }
}

export async function fetchAlertRules(strategyId: number): Promise<PickerAlertRuleRow[]> {
  if (!isPickerAlertEnabled()) return [];

  try {
    const { data, error } = await supabaseStock
      .from('picker_alert_rule')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    logger.warn('获取预警规则失败:', error);
    return [];
  }
}

export async function createDefaultAlertRule(strategyId: number, strategyName: string): Promise<PickerAlertRuleRow | null> {
  return createAlertRule({
    strategyId,
    name: `${strategyName}-新命中提醒`,
    alertType: 'new_match',
    lookbackDays: 1,
    checkInterval: 300,
    cooldown: 60,
    inApp: true,
  });
}

export async function createAlertRule(params: CreateAlertRuleParams): Promise<PickerAlertRuleRow | null> {
  if (!isPickerAlertEnabled()) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseStock as any)
      .from('picker_alert_rule')
      .insert({
        id: createRuleId(params.strategyId),
        strategy_id: params.strategyId,
        name: params.name,
        alert_type: params.alertType,
        condition_config: buildAlertConditionConfig(params),
        notification_channels: buildAlertChannels(params),
        check_interval: params.checkInterval ?? 300,
        cooldown: params.cooldown ?? 60,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.warn('创建预警规则失败:', error);
    return null;
  }
}

export async function updateAlertRuleStatus(ruleId: string, isActive: boolean): Promise<boolean> {
  if (!isPickerAlertEnabled()) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseStock as any)
      .from('picker_alert_rule')
      .update({ is_active: isActive })
      .eq('id', ruleId);

    if (error) throw error;
    return true;
  } catch (error) {
    logger.warn('更新预警规则状态失败:', error);
    return false;
  }
}

export async function fetchRecentAlertLogs(strategyId: number, limit = 10): Promise<PickerAlertLogRow[]> {
  if (!isPickerAlertEnabled()) return [];

  const rules = await fetchAlertRules(strategyId);
  const ruleIds = rules.map((item) => item.id);
  if (ruleIds.length === 0) return [];

  try {
    const { data, error } = await supabaseStock
      .from('picker_alert_log')
      .select('*')
      .in('rule_id', ruleIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    logger.warn('获取预警日志失败:', error);
    return [];
  }
}

export async function markAlertLogRead(logId: number): Promise<boolean> {
  if (!isPickerAlertEnabled()) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseStock as any)
      .from('picker_alert_log')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', logId);

    if (error) throw error;
    return true;
  } catch (error) {
    logger.warn('更新预警日志状态失败:', error);
    return false;
  }
}

export async function fetchUnreadAlertSummary(limit = 8): Promise<UnreadAlertSummary> {
  if (!isPickerAlertEnabled()) {
    return {
      unreadCount: 0,
      logs: [],
    };
  }

  try {
    const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([
      supabaseStock
        .from('picker_alert_log')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false),
      supabaseStock
        .from('picker_alert_log')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    if (countError) throw countError;
    if (dataError) throw dataError;

    return {
      unreadCount: count ?? 0,
      logs: (data ?? []) as PickerAlertLogRow[],
    };
  } catch (error) {
    logger.warn('获取未读预警摘要失败:', error);
    return {
      unreadCount: 0,
      logs: [],
    };
  }
}