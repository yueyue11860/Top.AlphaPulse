import type { StockScreenerParams } from './screenerService';

export interface AIScreenerDraft {
  title: string;
  params: Partial<StockScreenerParams>;
  explanations: string[];
  warnings: string[];
  source: 'local' | 'model';
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function parseNumber(text: string): number | undefined {
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function generateScreenerDraftFromPrompt(prompt: string): Promise<AIScreenerDraft> {
  const normalized = prompt.trim().toLowerCase();
  const selectedFilters: string[] = [];
  const explanations: string[] = [];
  const warnings: string[] = [];
  const params: Partial<StockScreenerParams> = {
    market: 'all',
    selectedFilters: [],
    sortBy: 'score',
  };

  if (!normalized) {
    return {
      title: 'AI 条件建议',
      params,
      explanations: [],
      warnings: ['请输入一句自然语言描述，例如“找创业板里主力净流入、放量突破、PE 不高的股票”。'],
      source: 'local',
    };
  }

  if (normalized.includes('创业板')) {
    params.market = 'cy';
    explanations.push('识别到“创业板”，已限定到创业板股票池。');
  } else if (normalized.includes('科创板')) {
    params.market = 'kc';
    explanations.push('识别到“科创板”，已限定到科创板股票池。');
  } else if (normalized.includes('北交所')) {
    params.market = 'bj';
    explanations.push('识别到“北交所”，已限定到北交所股票池。');
  } else if (normalized.includes('沪市')) {
    params.market = 'sh';
    explanations.push('识别到“沪市”，已限定到沪市股票池。');
  } else if (normalized.includes('深市')) {
    params.market = 'sz';
    explanations.push('识别到“深市”，已限定到深市股票池。');
  }

  if (normalized.includes('低估值') || normalized.includes('便宜') || normalized.includes('pe低') || normalized.includes('低pe')) {
    selectedFilters.push('pe_low');
    explanations.push('识别到低估值偏好，已加入 PE<20。');
  }

  if (normalized.includes('主力净流入') || normalized.includes('资金流入') || normalized.includes('主力流入')) {
    selectedFilters.push('main_inflow');
    explanations.push('识别到资金流偏好，已加入主力净流入。');
  }

  if (normalized.includes('大单') || normalized.includes('机构买入')) {
    selectedFilters.push('big_order');
    explanations.push('识别到大单偏好，已加入大单占比条件。');
  }

  if (normalized.includes('换手') || normalized.includes('活跃')) {
    selectedFilters.push('high_turnover');
    explanations.push('识别到活跃度偏好，已加入高换手率。');
  }

  if (normalized.includes('放量')) {
    selectedFilters.push('volume_burst');
    explanations.push('识别到放量要求，已加入放量上涨。');
  }

  if (normalized.includes('突破')) {
    selectedFilters.push('break_high');
    explanations.push('识别到突破要求，已加入突破新高。');
  }

  if (normalized.includes('布林')) {
    selectedFilters.push('boll_break');
    explanations.push('识别到布林突破偏好。');
  }

  if (normalized.includes('多头') || normalized.includes('趋势')) {
    selectedFilters.push('ma_bull');
    explanations.push('识别到趋势偏好，已加入均线多头。');
  }

  if (normalized.includes('超跌') || normalized.includes('抄底') || normalized.includes('超卖')) {
    selectedFilters.push('kdj_oversold');
    explanations.push('识别到超卖修复偏好，已加入 KDJ 超卖。');
  }

  if (normalized.includes('金叉')) {
    selectedFilters.push('macd_golden');
    explanations.push('识别到金叉信号偏好，已加入 MACD 金叉。');
  }

  const priceUpper = normalized.match(/(\d+(?:\.\d+)?)元(?:以下|以内|下方)/);
  if (priceUpper?.[1]) {
    params.priceMax = parseNumber(priceUpper[1]);
    explanations.push(`识别到价格上限，已设置最高价 ${priceUpper[1]} 元。`);
  }

  const priceLower = normalized.match(/(\d+(?:\.\d+)?)元(?:以上|起步|上方)/);
  if (priceLower?.[1]) {
    params.priceMin = parseNumber(priceLower[1]);
    explanations.push(`识别到价格下限，已设置最低价 ${priceLower[1]} 元。`);
  }

  const changeUpper = normalized.match(/涨幅(?:不超过|小于|低于|<=?)(\d+(?:\.\d+)?)%/);
  if (changeUpper?.[1]) {
    params.changeMax = parseNumber(changeUpper[1]);
    explanations.push(`识别到涨幅上限，已设置最大涨跌幅 ${changeUpper[1]}%。`);
  }

  const changeLower = normalized.match(/涨幅(?:超过|大于|高于|>=?)(\d+(?:\.\d+)?)%/);
  if (changeLower?.[1]) {
    params.changeMin = parseNumber(changeLower[1]);
    explanations.push(`识别到涨幅下限，已设置最小涨跌幅 ${changeLower[1]}%。`);
  }

  const volumeLower = normalized.match(/成交量(?:超过|大于|高于|>=?)(\d+(?:\.\d+)?)(万手|手)/);
  if (volumeLower?.[1]) {
    const baseValue = parseNumber(volumeLower[1]);
    params.volumeMin = volumeLower[2] === '万手' && baseValue !== undefined ? baseValue * 10000 : baseValue;
    explanations.push(`识别到成交量下限，已设置最小成交量 ${volumeLower[1]}${volumeLower[2]}。`);
  }

  if (normalized.includes('短线') || normalized.includes('强势')) {
    params.sortBy = 'change';
    explanations.push('识别到短线/强势风格，排序优先级调整为涨幅优先。');
  }

  if (normalized.includes('稳健') || normalized.includes('综合')) {
    params.sortBy = 'score';
    explanations.push('识别到稳健/综合风格，排序优先级保持综合评分。');
  }

  params.selectedFilters = unique(selectedFilters);

  if ((params.selectedFilters?.length ?? 0) === 0 && params.market === 'all' && params.priceMin === undefined && params.priceMax === undefined && params.changeMin === undefined && params.changeMax === undefined) {
    warnings.push('暂未从文本中识别到明确条件，建议补充市场、估值、资金流或突破信号等关键词。');
  }

  if (normalized.includes('roe') || normalized.includes('净利润增长') || normalized.includes('负债率')) {
    warnings.push('当前 AI 辅助已识别你的财务偏好；若财务表可用，将转成真实筛选，否则会自动降级并在结果区提示。');
  }

  return {
    title: `AI 条件建议：${prompt.trim().slice(0, 18)}`,
    params,
    explanations,
    warnings,
    source: 'local',
  };
}