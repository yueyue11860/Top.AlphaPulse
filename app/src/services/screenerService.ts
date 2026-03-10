import { mockStocks } from '@/data/mock';
import { requestWithCache, supabaseNews, supabaseStock, logger, USE_MOCK_FALLBACK, stableStringify, getRecentTradeDates } from './serviceUtils';
import type { PickerStrategyRow } from '@/types/database';

export type ScreenerSortBy = 'score' | 'change';

export interface StockScreenerParams {
  market: string;
  tradeDate?: string;
  priceMin?: number;
  priceMax?: number;
  changeMin?: number;
  changeMax?: number;
  volumeMin?: number;
  volumeMax?: number;
  selectedFilters: string[];
  sortBy?: ScreenerSortBy;
  limit?: number;
}

export interface StockScreenerResultItem {
  code: string;
  name: string;
  industry: string;
  market: string;
  price: number;
  change: number;
  volume: number;
  turnoverRate: number;
  marketCap: number;
  score: number;
  technicalScore: number;
  fundamentalScore: number;
  capitalScore: number;
  roe: number | null;
  profitYoy: number | null;
  debtToAssets: number | null;
  pe: number;
  pb: number;
  peForecast: number | null;
  epsForecast: number | null;
  rating: string | null;
  targetPrice: number | null;
  reasons: string[];
  matchedFilters: string[];
}

export interface ParsedScreenerStrategyConfig {
  market: string;
  priceMin?: number;
  priceMax?: number;
  changeMin?: number;
  changeMax?: number;
  volumeMin?: number;
  volumeMax?: number;
  selectedFilters: string[];
}

export interface StockScreenerResponse {
  total: number;
  items: StockScreenerResultItem[];
  latestTradeDate: string | null;
  warnings: string[];
  isMock: boolean;
}

interface DailyRow {
  ts_code: string;
  trade_date: string;
  close: number | null;
  pct_chg: number | null;
  vol: number | null;
  amount: number | null;
  high?: number | null;
  low?: number | null;
}

interface DailyBasicRow {
  ts_code: string;
  trade_date: string;
  close: number | null;
  turnover_rate: number | null;
  volume_ratio: number | null;
  pe: number | null;
  pb: number | null;
  total_mv: number | null;
  circ_mv: number | null;
}

interface StockBasicRow {
  ts_code: string;
  symbol: string;
  name: string;
  industry: string | null;
  market: string | null;
}

interface MoneyflowRow {
  ts_code: string;
  trade_date: string;
  buy_sm_amount: number | null;
  buy_md_amount: number | null;
  buy_lg_amount: number | null;
  buy_elg_amount: number | null;
  sell_sm_amount: number | null;
  sell_md_amount: number | null;
  sell_lg_amount: number | null;
  sell_elg_amount: number | null;
  net_mf_amount: number | null;
}

interface ResearchSignalRow {
  ts_code: string | null;
  rating: string | null;
  target_price: number | null;
  eps_forecast: number | null;
  pe_forecast: number | null;
  report_date: string;
}

interface FinancialSignalRow {
  ts_code: string;
  ann_date?: string | null;
  end_date?: string | null;
  roe?: number | null;
  grossprofit_margin?: number | null;
  profit_yoy?: number | null;
  revenue_yoy?: number | null;
  debt_to_assets?: number | null;
}

interface SignalEvaluation {
  matched: Set<string>;
  reasons: string[];
  technicalScore: number;
  fundamentalScore: number;
  capitalScore: number;
}

const UNSUPPORTED_FILTERS = new Map<string, string>();

const FILTER_LABELS = new Map<string, string>([
  ['macd_golden', 'MACD金叉'],
  ['kdj_oversold', 'KDJ超卖'],
  ['ma_bull', '均线多头'],
  ['boll_break', '布林突破'],
  ['volume_burst', '放量上涨'],
  ['break_high', '突破新高'],
  ['pe_low', 'PE<20'],
  ['roe_high', 'ROE>15%'],
  ['growth', '净利润增长>20%'],
  ['low_debt', '负债率<50%'],
  ['main_inflow', '主力净流入'],
  ['big_order', '大单占比>30%'],
  ['high_turnover', '换手率>5%'],
]);

function toNumber(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatTradeDate(date: string | null): string | null {
  if (!date) return null;
  if (date.length === 8 && !date.includes('-')) {
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  }
  return date;
}

function matchesMarketFilter(marketFilter: string, stock: StockBasicRow): boolean {
  if (marketFilter === 'all') return true;

  const tsCode = stock.ts_code.toUpperCase();
  const symbol = stock.symbol || '';
  const market = stock.market || '';

  switch (marketFilter) {
    case 'sh':
      return tsCode.endsWith('.SH');
    case 'sz':
      return tsCode.endsWith('.SZ');
    case 'cy':
      return symbol.startsWith('300') || market.includes('创业');
    case 'kc':
      return symbol.startsWith('688') || market.includes('科创');
    case 'bj':
      return tsCode.endsWith('.BJ');
    default:
      return true;
  }
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function calculateEMA(values: number[], period: number): number[] {
  if (!values.length) return [];
  const multiplier = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result.push((values[index] - result[index - 1]) * multiplier + result[index - 1]);
  }
  return result;
}

function calculateMovingAverage(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return average(values.slice(-period));
}

function calculateMacdSignal(closes: number[]): boolean {
  if (closes.length < 35) return false;
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const dif = ema12.map((value, index) => value - ema26[index]);
  const dea = calculateEMA(dif, 9);
  const currentIndex = dif.length - 1;
  const previousIndex = currentIndex - 1;
  return dif[currentIndex] > dea[currentIndex] && dif[previousIndex] <= dea[previousIndex];
}

function calculateKdjOversoldSignal(history: DailyRow[]): boolean {
  if (history.length < 10) return false;

  let prevK = 50;
  let prevD = 50;
  const kValues: number[] = [];
  const dValues: number[] = [];

  for (let index = 8; index < history.length; index += 1) {
    const window = history.slice(index - 8, index + 1);
    const highs = window.map((item) => toNumber(item.high ?? item.close));
    const lows = window.map((item) => toNumber(item.low ?? item.close));
    const highest = Math.max(...highs);
    const lowest = Math.min(...lows);
    const close = toNumber(history[index].close);
    const rsv = highest === lowest ? 50 : ((close - lowest) / (highest - lowest)) * 100;
    const k = (2 * prevK + rsv) / 3;
    const d = (2 * prevD + k) / 3;
    prevK = k;
    prevD = d;
    kValues.push(k);
    dValues.push(d);
  }

  if (kValues.length < 2 || dValues.length < 2) return false;
  const currentK = kValues[kValues.length - 1];
  const currentD = dValues[dValues.length - 1];
  const previousK = kValues[kValues.length - 2];
  const previousD = dValues[dValues.length - 2];

  return currentK > currentD && previousK <= previousD && currentK < 25 && currentD < 25;
}

function calculateBollBreak(closes: number[]): boolean {
  if (closes.length < 20) return false;
  const recent = closes.slice(-20);
  const middle = average(recent);
  const upper = middle + standardDeviation(recent) * 2;
  return closes[closes.length - 1] > upper;
}

function calculateSignalEvaluation(input: {
  latestDaily: DailyRow;
  latestBasic?: DailyBasicRow;
  latestMoneyflow?: MoneyflowRow;
  latestResearch?: ResearchSignalRow;
  latestFinancial?: FinancialSignalRow;
  history: DailyRow[];
}): SignalEvaluation {
  const closes = input.history.map((item) => toNumber(item.close));
  const latestClose = toNumber(input.latestDaily.close);
  const latestVolume = toNumber(input.latestDaily.vol);
  const previousVolumes = input.history.slice(-6, -1).map((item) => toNumber(item.vol)).filter((value) => value > 0);
  const avgRecentVolume = average(previousVolumes);
  const latestPe = toNumber(input.latestBasic?.pe);
  const latestPb = toNumber(input.latestBasic?.pb);
  const turnoverRate = toNumber(input.latestBasic?.turnover_rate);
  const netMfAmount = toNumber(input.latestMoneyflow?.net_mf_amount);
  const targetPrice = toNumber(input.latestResearch?.target_price);
  const peForecast = toNumber(input.latestResearch?.pe_forecast);
  const epsForecast = input.latestResearch?.eps_forecast ?? null;
  const rating = input.latestResearch?.rating || '';
  const roe = input.latestFinancial?.roe ?? null;
  const profitYoy = input.latestFinancial?.profit_yoy ?? null;
  const debtToAssets = input.latestFinancial?.debt_to_assets ?? null;
  const grossMargin = input.latestFinancial?.grossprofit_margin ?? null;

  const totalBuyAmount =
    toNumber(input.latestMoneyflow?.buy_sm_amount) +
    toNumber(input.latestMoneyflow?.buy_md_amount) +
    toNumber(input.latestMoneyflow?.buy_lg_amount) +
    toNumber(input.latestMoneyflow?.buy_elg_amount);
  const bigOrderBuyAmount = toNumber(input.latestMoneyflow?.buy_lg_amount) + toNumber(input.latestMoneyflow?.buy_elg_amount);
  const bigOrderRatio = totalBuyAmount > 0 ? (bigOrderBuyAmount / totalBuyAmount) * 100 : 0;

  const ma5 = calculateMovingAverage(closes, 5);
  const ma10 = calculateMovingAverage(closes, 10);
  const ma20 = calculateMovingAverage(closes, 20);
  const previous60High = closes.length > 1 ? Math.max(...closes.slice(0, -1).slice(-60)) : 0;

  const signals = {
    macd_golden: calculateMacdSignal(closes),
    kdj_oversold: calculateKdjOversoldSignal(input.history),
    ma_bull: ma5 !== null && ma10 !== null && ma20 !== null && ma5 > ma10 && ma10 > ma20 && latestClose >= ma5,
    boll_break: calculateBollBreak(closes),
    volume_burst: avgRecentVolume > 0 && latestVolume > avgRecentVolume * 1.5 && toNumber(input.latestDaily.pct_chg) > 0,
    break_high: previous60High > 0 && latestClose >= previous60High,
    pe_low: latestPe > 0 && latestPe < 20,
    roe_high: roe !== null && roe > 15,
    growth: profitYoy !== null && profitYoy > 20,
    low_debt: debtToAssets !== null && debtToAssets < 50,
    main_inflow: netMfAmount > 0,
    big_order: bigOrderRatio >= 30,
    high_turnover: turnoverRate >= 5,
  };

  const reportSignals = {
    low_forecast_pe: peForecast > 0 && peForecast < 25,
    positive_rating: ['买入', '增持', '推荐'].includes(rating),
    target_upside: targetPrice > 0 && latestClose > 0 && ((targetPrice - latestClose) / latestClose) >= 0.15,
    positive_eps_forecast: epsForecast !== null && epsForecast > 0,
  };

  const matched = new Set<string>();
  const reasons: string[] = [];

  Object.entries(signals).forEach(([key, value]) => {
    if (value) {
      matched.add(key);
      const label = FILTER_LABELS.get(key);
      if (label) reasons.push(label);
    }
  });

  if (reportSignals.low_forecast_pe) reasons.push('预测PE较低');
  if (reportSignals.positive_rating) reasons.push(`研报评级偏积极${rating ? `(${rating})` : ''}`);
  if (reportSignals.target_upside) reasons.push('研报目标价存在上行空间');
  if (grossMargin !== null && grossMargin > 35) reasons.push('毛利率较高');

  const technicalCount = ['macd_golden', 'kdj_oversold', 'ma_bull', 'boll_break', 'volume_burst', 'break_high']
    .filter((key) => signals[key as keyof typeof signals]).length;
  const fundamentalScore = clampScore(
    (signals.pe_low ? 45 : 20) +
    (latestPb > 0 && latestPb < 3 ? 15 : 0) +
    (signals.roe_high ? 12 : 0) +
    (signals.growth ? 10 : 0) +
    (signals.low_debt ? 8 : 0) +
    (grossMargin !== null && grossMargin > 35 ? 5 : 0) +
    (reportSignals.low_forecast_pe ? 15 : 0) +
    (reportSignals.positive_rating ? 10 : 0) +
    (reportSignals.target_upside ? 10 : 0) +
    (reportSignals.positive_eps_forecast ? 5 : 0)
  );
  const capitalScore = clampScore((signals.main_inflow ? 45 : 15) + (signals.big_order ? 30 : 0) + (signals.high_turnover ? 25 : 0));
  const technicalScore = clampScore((technicalCount / 6) * 100);

  return {
    matched,
    reasons,
    technicalScore,
    fundamentalScore,
    capitalScore,
  };
}

function sortItems(items: StockScreenerResultItem[], sortBy: ScreenerSortBy): StockScreenerResultItem[] {
  return [...items].sort((left, right) => {
    if (sortBy === 'change') {
      return right.change - left.change || right.score - left.score;
    }
    return right.score - left.score || right.change - left.change;
  });
}

function buildMockResponse(params: StockScreenerParams, warning: string): StockScreenerResponse {
  const items = mockStocks
    .filter((stock) => matchesMarketFilter(params.market, {
      ts_code: stock.ts_code,
      symbol: stock.symbol,
      name: stock.name,
      industry: stock.industry,
      market: stock.market,
    }))
    .slice(0, params.limit ?? 20)
    .map((stock, index) => ({
      code: stock.ts_code,
      name: stock.name,
      industry: stock.industry,
      market: stock.market,
      price: Number((18 + index * 12.5).toFixed(2)),
      change: Number((4.8 - index * 0.35).toFixed(2)),
      volume: 180000 + index * 24000,
      turnoverRate: Number((3.2 + index * 0.5).toFixed(2)),
      marketCap: 500000 + index * 160000,
      technicalScore: 68 + (index % 3) * 6,
      fundamentalScore: 64 + (index % 2) * 10,
      capitalScore: 66 + ((index + 1) % 3) * 8,
      roe: 17 + index,
      profitYoy: 22 + index * 2,
      debtToAssets: 42 - index,
      pe: 18 + index,
      pb: Number((2.2 + index * 0.1).toFixed(2)),
      peForecast: 16 + index,
      epsForecast: Number((1.2 + index * 0.15).toFixed(2)),
      rating: index % 2 === 0 ? '推荐' : '买入',
      targetPrice: Number((22 + index * 13.2).toFixed(2)),
      score: 82 - index,
      reasons: ['模拟结果', '建议接入真实数据后复核'],
      matchedFilters: [],
    }));

  return {
    total: items.length,
    items: sortItems(items, params.sortBy ?? 'score'),
    latestTradeDate: null,
    warnings: [warning],
    isMock: true,
  };
}

async function runStockScreenerRaw(params: StockScreenerParams): Promise<StockScreenerResponse> {
  const warnings: string[] = [];
  const unsupportedFilters = params.selectedFilters.filter((filterId) => UNSUPPORTED_FILTERS.has(filterId));
  const supportedFilters = params.selectedFilters.filter((filterId) => !UNSUPPORTED_FILTERS.has(filterId));

  unsupportedFilters.forEach((filterId) => {
    const warning = UNSUPPORTED_FILTERS.get(filterId);
    if (warning) warnings.push(warning);
  });

  try {
    const latestTradeDate = params.tradeDate ?? (() => null)();
    let resolvedTradeDate = latestTradeDate;

    if (!resolvedTradeDate) {
      const { data: latestRows, error: latestError } = await supabaseStock
        .from('daily')
        .select('trade_date')
        .order('trade_date', { ascending: false })
        .limit(1);

      if (latestError) throw latestError;
      resolvedTradeDate = (latestRows as Array<{ trade_date: string }> | null)?.[0]?.trade_date ?? null;
    }

    if (!resolvedTradeDate) {
      if (USE_MOCK_FALLBACK) {
        return buildMockResponse(params, '未获取到最新交易日，当前展示模拟选股结果。');
      }
      return { total: 0, items: [], latestTradeDate: null, warnings, isMock: false };
    }

    let dailyQuery = supabaseStock
      .from('daily')
      .select('ts_code, trade_date, close, pct_chg, vol, amount, high, low')
      .eq('trade_date', resolvedTradeDate)
      .order('amount', { ascending: false })
      .limit(Math.max((params.limit ?? 50) * 6, 120));

    if (params.priceMin !== undefined) dailyQuery = dailyQuery.gte('close', params.priceMin);
    if (params.priceMax !== undefined) dailyQuery = dailyQuery.lte('close', params.priceMax);
    if (params.changeMin !== undefined) dailyQuery = dailyQuery.gte('pct_chg', params.changeMin);
    if (params.changeMax !== undefined) dailyQuery = dailyQuery.lte('pct_chg', params.changeMax);
    if (params.volumeMin !== undefined) dailyQuery = dailyQuery.gte('vol', params.volumeMin);
    if (params.volumeMax !== undefined) dailyQuery = dailyQuery.lte('vol', params.volumeMax);

    const { data: latestDailyRows, error: dailyError } = await dailyQuery;
    if (dailyError) throw dailyError;

    const latestDaily = (latestDailyRows as DailyRow[] | null) ?? [];
    if (!latestDaily.length) {
      return {
        total: 0,
        items: [],
        latestTradeDate: resolvedTradeDate,
        warnings,
        isMock: false,
      };
    }

    const candidateCodes = latestDaily.map((item) => item.ts_code);

    const [basicResult, dailyBasicResult, moneyflowResult, researchResult, financialResult] = await Promise.all([
      supabaseStock
        .from('stock_basic')
        .select('ts_code, symbol, name, industry, market')
        .in('ts_code', candidateCodes),
      supabaseStock
        .from('daily_basic')
        .select('ts_code, trade_date, close, turnover_rate, volume_ratio, pe, pb, total_mv, circ_mv')
        .eq('trade_date', resolvedTradeDate)
        .in('ts_code', candidateCodes),
      supabaseStock
        .from('moneyflow')
        .select('ts_code, trade_date, buy_sm_amount, buy_md_amount, buy_lg_amount, buy_elg_amount, sell_sm_amount, sell_md_amount, sell_lg_amount, sell_elg_amount, net_mf_amount')
        .eq('trade_date', resolvedTradeDate)
        .in('ts_code', candidateCodes),
      supabaseNews
        .from('research_report')
        .select('ts_code, rating, target_price, eps_forecast, pe_forecast, report_date')
        .in('ts_code', candidateCodes)
        .lte('report_date', resolvedTradeDate)
        .order('report_date', { ascending: false })
        .limit(Math.max(candidateCodes.length * 3, 120)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseStock as any)
        .from('fina_indicator')
        .select('ts_code, ann_date, end_date, roe, grossprofit_margin, profit_yoy, revenue_yoy, debt_to_assets')
        .in('ts_code', candidateCodes)
        .lte('ann_date', resolvedTradeDate)
        .order('ann_date', { ascending: false })
        .limit(Math.max(candidateCodes.length * 3, 120)),
    ]);

    if (basicResult.error) throw basicResult.error;
    if (dailyBasicResult.error) throw dailyBasicResult.error;
    if (moneyflowResult.error) {
      warnings.push('资金流向数据加载失败，资金面评分已按空值处理。');
    }
    if (researchResult.error) {
      warnings.push('研报预测数据加载失败，基本面增强评分已按空值处理。');
    }
    if (financialResult?.error) {
      warnings.push('财务指标表加载失败，ROE/增长/负债率筛选已按空值处理。');
    }

    const basicMap = new Map<string, StockBasicRow>(
      ((basicResult.data as StockBasicRow[] | null) ?? []).map((item) => [item.ts_code, item])
    );
    const dailyBasicMap = new Map<string, DailyBasicRow>(
      ((dailyBasicResult.data as DailyBasicRow[] | null) ?? []).map((item) => [item.ts_code, item])
    );
    const moneyflowMap = new Map<string, MoneyflowRow>(
      ((moneyflowResult.data as MoneyflowRow[] | null) ?? []).map((item) => [item.ts_code, item])
    );
    const researchMap = new Map<string, ResearchSignalRow>();
    ((researchResult.data as ResearchSignalRow[] | null) ?? []).forEach((item) => {
      if (!item.ts_code || researchMap.has(item.ts_code)) return;
      researchMap.set(item.ts_code, item);
    });
    const financialMap = new Map<string, FinancialSignalRow>();
    (((financialResult?.data as FinancialSignalRow[] | null) ?? [])).forEach((item) => {
      if (!item.ts_code || financialMap.has(item.ts_code)) return;
      financialMap.set(item.ts_code, item);
    });

    const marketFiltered = latestDaily.filter((item) => {
      const basic = basicMap.get(item.ts_code);
      return basic ? matchesMarketFilter(params.market, basic) : false;
    });

    if (!marketFiltered.length) {
      return {
        total: 0,
        items: [],
        latestTradeDate: resolvedTradeDate,
        warnings,
        isMock: false,
      };
    }

    const historyCodes = marketFiltered.slice(0, 150).map((item) => item.ts_code);
    const recentTradeDates = getRecentTradeDates(80);
    const { data: historyRows, error: historyError } = await supabaseStock
      .from('daily')
      .select('ts_code, trade_date, close, vol, high, low')
      .in('trade_date', recentTradeDates)
      .in('ts_code', historyCodes)
      .order('trade_date', { ascending: true });

    if (historyError) {
      warnings.push('历史行情加载失败，部分技术面规则已退化。');
    }

    const historyMap = new Map<string, DailyRow[]>();
    ((historyRows as DailyRow[] | null) ?? []).forEach((item) => {
      const existing = historyMap.get(item.ts_code) ?? [];
      existing.push(item);
      historyMap.set(item.ts_code, existing);
    });

    const scoredItems = marketFiltered.map((dailyItem) => {
      const basic = basicMap.get(dailyItem.ts_code);
      const latestBasic = dailyBasicMap.get(dailyItem.ts_code);
      const latestMoneyflow = moneyflowMap.get(dailyItem.ts_code);
      const latestResearch = researchMap.get(dailyItem.ts_code);
      const latestFinancial = financialMap.get(dailyItem.ts_code);
      const history = historyMap.get(dailyItem.ts_code) ?? [dailyItem];
      const signalEvaluation = calculateSignalEvaluation({
        latestDaily: dailyItem,
        latestBasic,
        latestMoneyflow,
        latestResearch,
        latestFinancial,
        history,
      });

      const score = clampScore(
        signalEvaluation.technicalScore * 0.4 +
        signalEvaluation.fundamentalScore * 0.25 +
        signalEvaluation.capitalScore * 0.35
      );

      const reasons = signalEvaluation.reasons.length > 0
        ? signalEvaluation.reasons.slice(0, 4)
        : ['符合基础活跃度条件'];

      return {
        code: dailyItem.ts_code,
        name: basic?.name ?? dailyItem.ts_code,
        industry: basic?.industry ?? '未分类',
        market: basic?.market ?? '未知',
        price: toNumber(dailyItem.close),
        change: toNumber(dailyItem.pct_chg),
        volume: toNumber(dailyItem.vol),
        turnoverRate: toNumber(latestBasic?.turnover_rate),
        marketCap: toNumber(latestBasic?.total_mv || latestBasic?.circ_mv),
        score,
        technicalScore: signalEvaluation.technicalScore,
        fundamentalScore: signalEvaluation.fundamentalScore,
        capitalScore: signalEvaluation.capitalScore,
        roe: latestFinancial?.roe ?? null,
        profitYoy: latestFinancial?.profit_yoy ?? null,
        debtToAssets: latestFinancial?.debt_to_assets ?? null,
        pe: toNumber(latestBasic?.pe),
        pb: toNumber(latestBasic?.pb),
        peForecast: latestResearch?.pe_forecast ?? null,
        epsForecast: latestResearch?.eps_forecast ?? null,
        rating: latestResearch?.rating ?? null,
        targetPrice: latestResearch?.target_price ?? null,
        reasons,
        matchedFilters: Array.from(signalEvaluation.matched),
      } satisfies StockScreenerResultItem;
    });

    const filteredItems = scoredItems.filter((item) =>
      supportedFilters.every((filterId) => item.matchedFilters.includes(filterId))
    );

    return {
      total: filteredItems.length,
      items: sortItems(filteredItems, params.sortBy ?? 'score').slice(0, params.limit ?? 50),
      latestTradeDate: resolvedTradeDate,
      warnings,
      isMock: false,
    };
  } catch (error) {
    logger.error('执行智能选股失败:', error);
    if (USE_MOCK_FALLBACK) {
      return buildMockResponse(params, '真实选股查询失败，当前展示模拟结果，请检查 Supabase 数据源配置。');
    }
    throw error;
  }
}

export function getUnsupportedScreenerFilters(selectedFilters: string[]): string[] {
  return selectedFilters.filter((filterId) => UNSUPPORTED_FILTERS.has(filterId));
}

export function getScreenerFilterLabel(filterId: string): string {
  return FILTER_LABELS.get(filterId) ?? filterId;
}

export function buildScreenerStrategyFilters(params: StockScreenerParams): Array<Record<string, unknown>> {
  const filters: Array<Record<string, unknown>> = [];

  if (params.market !== 'all') {
    filters.push({ field: 'market', operator: 'eq', value: params.market });
  }
  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    filters.push({ field: 'price', operator: 'between', value: params.priceMin, value2: params.priceMax });
  }
  if (params.changeMin !== undefined || params.changeMax !== undefined) {
    filters.push({ field: 'change', operator: 'between', value: params.changeMin, value2: params.changeMax });
  }
  if (params.volumeMin !== undefined || params.volumeMax !== undefined) {
    filters.push({ field: 'volume', operator: 'between', value: params.volumeMin, value2: params.volumeMax });
  }

  params.selectedFilters.forEach((filterId) => {
    filters.push({ field: filterId, operator: 'eq', value: true, label: getScreenerFilterLabel(filterId) });
  });

  return filters;
}

export function parseScreenerStrategyConfig(strategy: PickerStrategyRow): ParsedScreenerStrategyConfig {
  const config = strategy.stock_pool_config as { filters?: Array<Record<string, unknown>> } | null;
  const filters = Array.isArray(config?.filters) ? config?.filters : [];

  const parsed: ParsedScreenerStrategyConfig = {
    market: 'all',
    selectedFilters: [],
  };

  filters.forEach((filter) => {
    const field = typeof filter.field === 'string' ? filter.field : '';
    const value = filter.value;
    const value2 = filter.value2;

    switch (field) {
      case 'market':
        if (typeof value === 'string') parsed.market = value;
        break;
      case 'price':
        parsed.priceMin = typeof value === 'number' ? value : undefined;
        parsed.priceMax = typeof value2 === 'number' ? value2 : undefined;
        break;
      case 'change':
        parsed.changeMin = typeof value === 'number' ? value : undefined;
        parsed.changeMax = typeof value2 === 'number' ? value2 : undefined;
        break;
      case 'volume':
        parsed.volumeMin = typeof value === 'number' ? value : undefined;
        parsed.volumeMax = typeof value2 === 'number' ? value2 : undefined;
        break;
      default:
        if (FILTER_LABELS.has(field)) {
          parsed.selectedFilters.push(field);
        }
        break;
    }
  });

  parsed.selectedFilters = Array.from(new Set(parsed.selectedFilters));
  return parsed;
}

export async function runStockScreener(params: StockScreenerParams): Promise<StockScreenerResponse> {
  const cacheKey = `stock:screener:${stableStringify(params)}`;
  return requestWithCache(
    cacheKey,
    'runStockScreener',
    () => runStockScreenerRaw(params),
    { ttlMs: 15_000 }
  );
}

export function formatScreenerTradeDate(date: string | null): string | null {
  return formatTradeDate(date);
}