const RAW_FALLBACKS = {
  foreground: '220 15% 15%',
  mutedForeground: '220 10% 40%',
  border: '220 15% 90%',
  stockUp: '0 84% 47%',
  stockDown: '142 71% 36%',
  chartGrid: '220 15% 92%',
  chartText: '220 10% 45%',
  watchPrice: '217 91% 50%',
  watchAverage: '38 92% 50%',
  watchBuyFill: '142 71% 45%',
  watchSellFill: '0 84% 55%',
  tooltipBg: '222 47% 11%',
  tooltipBorder: '217 33% 20%',
  axis: '217 33% 20%',
};

function readRawToken(element: HTMLElement, variableName: string, fallback: string) {
  const value = window.getComputedStyle(element).getPropertyValue(variableName).trim();
  return value || fallback;
}

function asColor(rawValue: string) {
  if (rawValue.startsWith('#') || rawValue.startsWith('rgb') || rawValue.startsWith('hsl(')) {
    return rawValue;
  }

  const [hue = '0', saturation = '0%', lightness = '0%'] = rawValue.split(/\s+/);
  return `hsl(${hue}, ${saturation}, ${lightness})`;
}

function asAlphaColor(rawValue: string, alpha: number) {
  if (rawValue.startsWith('#') || rawValue.startsWith('rgb') || rawValue.startsWith('hsl(')) {
    return rawValue;
  }

  const [hue = '0', saturation = '0%', lightness = '0%'] = rawValue.split(/\s+/);
  return `hsla(${hue}, ${saturation}, ${lightness}, ${alpha})`;
}

export function getThemeTokenColor(element: HTMLElement, variableName: string, fallback: string) {
  return asColor(readRawToken(element, variableName, fallback));
}

export function getThemeTokenAlphaColor(
  element: HTMLElement,
  variableName: string,
  fallback: string,
  alpha: number,
) {
  return asAlphaColor(readRawToken(element, variableName, fallback), alpha);
}

export function getStockChartColors(element: HTMLElement) {
  return {
    up: getThemeTokenColor(element, '--stock-up', RAW_FALLBACKS.stockUp),
    down: getThemeTokenColor(element, '--stock-down', RAW_FALLBACKS.stockDown),
    text: getThemeTokenColor(element, '--chart-text', RAW_FALLBACKS.chartText),
    textMuted: getThemeTokenColor(element, '--muted-foreground', RAW_FALLBACKS.mutedForeground),
    line: getThemeTokenColor(element, '--watch-chart-axis', RAW_FALLBACKS.axis),
    grid: getThemeTokenAlphaColor(element, '--chart-grid', RAW_FALLBACKS.chartGrid, 0.75),
    gridFaint: getThemeTokenAlphaColor(element, '--chart-grid', RAW_FALLBACKS.chartGrid, 0.35),
    tooltipBg: getThemeTokenAlphaColor(element, '--watch-tooltip-bg', RAW_FALLBACKS.tooltipBg, 0.96),
    tooltipBorder: getThemeTokenColor(element, '--watch-tooltip-border', RAW_FALLBACKS.tooltipBorder),
    tooltipText: getThemeTokenColor(element, '--foreground', RAW_FALLBACKS.foreground),
    tooltipLabel: getThemeTokenColor(element, '--muted-foreground', RAW_FALLBACKS.mutedForeground),
    priceLine: getThemeTokenColor(element, '--watch-chart-price', RAW_FALLBACKS.watchPrice),
    avgLine: getThemeTokenColor(element, '--watch-chart-average', RAW_FALLBACKS.watchAverage),
    areaGrad0: getThemeTokenAlphaColor(element, '--watch-chart-price', RAW_FALLBACKS.watchPrice, 0.22),
    areaGradMid: getThemeTokenAlphaColor(element, '--watch-chart-price', RAW_FALLBACKS.watchPrice, 0.08),
    areaGrad1: getThemeTokenAlphaColor(element, '--watch-chart-price', RAW_FALLBACKS.watchPrice, 0.02),
    upVol: getThemeTokenAlphaColor(element, '--watch-sell-fill', RAW_FALLBACKS.watchSellFill, 0.72),
    downVol: getThemeTokenAlphaColor(element, '--watch-buy-fill', RAW_FALLBACKS.watchBuyFill, 0.72),
    markLine: getThemeTokenColor(element, '--watch-chart-axis', RAW_FALLBACKS.axis),
    labelBg: getThemeTokenColor(element, '--watch-tooltip-border', RAW_FALLBACKS.tooltipBorder),
    zoom: getThemeTokenAlphaColor(element, '--watch-chart-price', RAW_FALLBACKS.watchPrice, 0.2),
    zoomHandle: getThemeTokenColor(element, '--watch-chart-price', RAW_FALLBACKS.watchPrice),
  };
}