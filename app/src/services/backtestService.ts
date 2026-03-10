import { requestWithCache, supabaseStock, stableStringify } from './serviceUtils';
import { runStockScreener, type StockScreenerParams } from './screenerService';

export interface QuickBacktestParams {
  strategy: StockScreenerParams;
  startDate: string;
  endDate: string;
  holdingDays: number;
  topN: number;
}

export interface QuickBacktestPosition {
  code: string;
  name: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
}

export interface QuickBacktestTrade {
  entryDate: string;
  exitDate: string;
  sampleSize: number;
  averageReturn: number;
  bestReturn: number;
  worstReturn: number;
  topStock?: string;
  positions: QuickBacktestPosition[];
}

export interface QuickBacktestResult {
  rebalanceCount: number;
  totalSignals: number;
  averageReturn: number;
  winRate: number;
  bestReturn: number;
  worstReturn: number;
  trades: QuickBacktestTrade[];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function runQuickBacktest(params: QuickBacktestParams): Promise<QuickBacktestResult> {
  const cacheKey = `stock:quick-backtest:${stableStringify(params)}`;
  return requestWithCache(cacheKey, 'runQuickBacktest', async () => {
    const { data: indexRows, error } = await supabaseStock
      .from('index_daily')
      .select('trade_date')
      .eq('ts_code', '000001.SH')
      .gte('trade_date', params.startDate)
      .lte('trade_date', params.endDate)
      .order('trade_date', { ascending: true });

    if (error) throw error;

    const tradeDates = ((indexRows as Array<{ trade_date: string }> | null) ?? []).map((item) => item.trade_date);
    if (tradeDates.length <= params.holdingDays) {
      return {
        rebalanceCount: 0,
        totalSignals: 0,
        averageReturn: 0,
        winRate: 0,
        bestReturn: 0,
        worstReturn: 0,
        trades: [],
      };
    }

    const trades: QuickBacktestTrade[] = [];

    for (let index = 0; index < tradeDates.length - params.holdingDays; index += params.holdingDays) {
      const entryDate = tradeDates[index];
      const exitDate = tradeDates[index + params.holdingDays];
      const screenerResult = await runStockScreener({
        ...params.strategy,
        tradeDate: entryDate,
        limit: params.topN,
      });

      if (screenerResult.items.length === 0) continue;

      const codes = screenerResult.items.slice(0, params.topN).map((item) => item.code);
      const { data: exitRows } = await supabaseStock
        .from('daily')
        .select('ts_code, close')
        .eq('trade_date', exitDate)
        .in('ts_code', codes);

      const exitMap = new Map<string, number>(
        (((exitRows as Array<{ ts_code: string; close: number }> | null) ?? [])).map((item) => [item.ts_code, item.close])
      );

      const returns = screenerResult.items.slice(0, params.topN).flatMap((item) => {
        const exitPrice = exitMap.get(item.code);
        if (!exitPrice || item.price <= 0) return [];
        return [((exitPrice - item.price) / item.price) * 100];
      });

      if (returns.length === 0) continue;

      trades.push({
        entryDate,
        exitDate,
        sampleSize: returns.length,
        averageReturn: average(returns),
        bestReturn: Math.max(...returns),
        worstReturn: Math.min(...returns),
        topStock: screenerResult.items[0]?.name,
        positions: screenerResult.items.slice(0, params.topN).flatMap((item) => {
          const exitPrice = exitMap.get(item.code);
          if (!exitPrice || item.price <= 0) return [];
          return [{
            code: item.code,
            name: item.name,
            entryPrice: item.price,
            exitPrice,
            returnPct: ((exitPrice - item.price) / item.price) * 100,
          }];
        }),
      });
    }

    const allReturns = trades.map((item) => item.averageReturn);
    const wins = allReturns.filter((value) => value > 0).length;

    return {
      rebalanceCount: trades.length,
      totalSignals: trades.reduce((sum, item) => sum + item.sampleSize, 0),
      averageReturn: average(allReturns),
      winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
      bestReturn: allReturns.length > 0 ? Math.max(...allReturns) : 0,
      worstReturn: allReturns.length > 0 ? Math.min(...allReturns) : 0,
      trades,
    };
  }, { ttlMs: 60_000 });
}
