import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import * as echarts from 'echarts/core';
import { LineChart, BarChart as EBarChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  GraphicComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { getStockChartColors } from '@/lib/chartTheme';

echarts.use([
  LineChart,
  EBarChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  GraphicComponent,
  CanvasRenderer,
]);

interface TimeSeriesData {
    time: string;
    price: number;
    volume: number;
    avg_price: number;
}

function buildTradingTimeline(): string[] {
    const timeline: string[] = [];

    for (let hour = 9; hour <= 11; hour += 1) {
        const startMinute = hour === 9 ? 30 : 0;
        const endMinute = hour === 11 ? 30 : 59;

        for (let minute = startMinute; minute <= endMinute; minute += 1) {
            timeline.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
        }
    }

    for (let hour = 13; hour <= 15; hour += 1) {
        const endMinute = hour === 15 ? 0 : 59;

        for (let minute = 0; minute <= endMinute; minute += 1) {
            timeline.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
        }
    }

    return timeline;
}

const KEY_TIME_LABELS: Record<string, string> = {
    '09:30': '09:30',
    '10:30': '10:30',
    '11:30': '11:30/13:00',
    '14:00': '14:00',
    '15:00': '15:00',
};

interface TimeSeriesChartProps {
    data: TimeSeriesData[];
    preClose: number;
    className?: string;
    stockName?: string;
    stockCode?: string;
    tradeDate?: string; // YYYYMMDD
    layoutMode?: 'default' | 'fullscreen';
    themeKey?: string;
}

export function TimeSeriesChart({
    data,
    preClose,
    className,
    stockName,
    stockCode,
    tradeDate,
    layoutMode = 'default',
    themeKey,
}: TimeSeriesChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<echarts.ECharts | null>(null);

    // Init once, dispose on unmount
    useEffect(() => {
        if (!chartContainerRef.current) return;
        const chart = echarts.init(chartContainerRef.current, null);
        chartRef.current = chart;

        const handleResize = () => chart.resize();
        const resizeObserver = new ResizeObserver(() => {
            chart.resize();
        });

        resizeObserver.observe(chartContainerRef.current);
        window.addEventListener('resize', handleResize);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
            chart.dispose();
            chartRef.current = null;
        };
    }, []);

    // Update option when data changes
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        if (data.length === 0) {
            chart.clear();
            return;
        }

                const themeHost = chartContainerRef.current;
                if (!themeHost) return;

                const colors = getStockChartColors(themeHost);

        const timeline = buildTradingTimeline();
        const dataMap = new Map(data.map((item) => [item.time, item]));
        const observedIndices = data
            .map((item) => timeline.indexOf(item.time))
            .filter((index) => index >= 0);
        const latestObservedIndex = observedIndices.length > 0 ? Math.max(...observedIndices) : -1;
        const latestObservedPoint = latestObservedIndex >= 0 ? dataMap.get(timeline[latestObservedIndex]) ?? null : null;

        let lastPrice: number | null = null;
        let lastAvgPrice: number | null = null;

        const times = timeline;
        const prices = timeline.map((time, index) => {
            const item = dataMap.get(time);
            if (item) {
                lastPrice = item.price;
                return item.price;
            }

            if (latestObservedIndex >= 0 && index > latestObservedIndex) {
                return null;
            }

            return lastPrice;
        });
        const avgPrices = timeline.map((time, index) => {
            const item = dataMap.get(time);
            if (item) {
                lastAvgPrice = item.avg_price;
                return item.avg_price;
            }

            if (latestObservedIndex >= 0 && index > latestObservedIndex) {
                return null;
            }

            return lastAvgPrice;
        });
        const volumes = timeline.map((time) => dataMap.get(time)?.volume || 0);

        // ========== 东方财富风格：Y轴以昨收价对称 ==========
        const validPrices = prices.filter((price): price is number => typeof price === 'number' && Number.isFinite(price));
        const validAvgPrices = avgPrices.filter((price): price is number => typeof price === 'number' && Number.isFinite(price));
        const maxDev = Math.max(
            ...validPrices.map(p => Math.abs(p - preClose)),
            ...validAvgPrices.map(p => Math.abs(p - preClose)),
            preClose * 0.005 // 最小偏差 0.5%，避免价格不变时太扁
        );
        const yMin = preClose - maxDev * 1.04;
        const yMax = preClose + maxDev * 1.04;

        // 对称涨跌幅
        const maxChangePct = (maxDev / preClose) * 100 * 1.04;

        // 最新数据
        const latestPrice = latestObservedPoint?.price ?? preClose;
        const latestChange = latestPrice - preClose;
        const latestChangePct = (latestChange / preClose * 100).toFixed(2);
        const latestVolume = latestObservedPoint?.volume || 0;
        const isFullscreen = layoutMode === 'fullscreen';
        const horizontalPadding = isFullscreen ? 112 : 70;
        const priceGridTop = stockName ? (isFullscreen ? 36 : 32) : (isFullscreen ? 18 : 16);
        const priceGridHeight = isFullscreen ? '63%' : '62%';
        const volumeGridTop = isFullscreen ? '76%' : '78%';
        const volumeGridHeight = isFullscreen ? '20%' : '14%';
        const volumeBarWidth = isFullscreen ? '88%' : '70%';
        const maxVolume = Math.max(...volumes, 0);
        const baseVolumeStep = 500000;
        const volumeStep = maxVolume > 0
            ? Math.max(baseVolumeStep, Math.ceil(maxVolume / 4 / baseVolumeStep) * baseVolumeStep)
            : baseVolumeStep;
        const volumeAxisMax = Math.max(volumeStep * 4, Math.ceil(maxVolume / volumeStep) * volumeStep);

        // 成交量颜色：当前价格 vs 前一分钟价格
        const volumeColors = volumes.map((_vol, idx) => {
            const currentPrice = prices[idx] ?? preClose;
            const previousPrice = prices[idx - 1] ?? preClose;

            if (idx === 0) {
                return currentPrice >= preClose ? colors.upVol : colors.downVol;
            }
            return currentPrice >= previousPrice ? colors.upVol : colors.downVol;
        });

        const option: echarts.EChartsCoreOption = {
            backgroundColor: 'transparent',
            // ========== 图表顶部信息（东方财富风格） ==========
            graphic: stockName ? [
                {
                    type: 'text',
                    left: 70,
                    top: 8,
                    style: {
                        text: `${stockName}${stockCode ? ` [${stockCode}]` : ''}`,
                        fill: colors.text,
                        fontSize: 11,
                        fontFamily: 'system-ui, sans-serif'
                    }
                },
                {
                    type: 'text',
                    left: 250,
                    top: 8,
                    style: {
                        text: `价格:${latestPrice.toFixed(2)}  涨幅:${latestChange >= 0 ? '+' : ''}${latestChangePct}%  成交量:${latestVolume}`,
                        fill: latestChange >= 0 ? colors.up : colors.down,
                        fontSize: 11,
                        fontFamily: 'system-ui, sans-serif'
                    }
                }
            ] : [],
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    crossStyle: {
                        color: colors.markLine,
                        width: 1
                    },
                    lineStyle: {
                        color: colors.markLine,
                        type: 'dashed'
                    },
                    label: {
                        show: true,
                        backgroundColor: colors.labelBg
                    }
                },
                backgroundColor: colors.tooltipBg,
                borderColor: colors.tooltipBorder,
                borderWidth: 1,
                padding: [8, 12],
                textStyle: { color: colors.tooltipText, fontSize: 12 },
                formatter: (params: any) => {
                    if (!Array.isArray(params) || params.length === 0) return '';
                    const time = params[0].axisValue;
                    // 使用传入的交易日期，若未提供则降级为当天
                    const dateStr = tradeDate
                        ? `${tradeDate.slice(0, 4)}-${tradeDate.slice(4, 6)}-${tradeDate.slice(6, 8)}`
                        : new Date().toISOString().slice(0, 10);
                    let html = `<div style="font-weight:600;margin-bottom:6px;color:${colors.tooltipText}">${dateStr} ${time}</div>`;

                    params.forEach((item: any) => {
                        if (item.seriesName === '价格') {
                            const price = Number(item.value);
                            if (!Number.isFinite(price)) return;
                            const change = price - preClose;
                            const changePct = (change / preClose * 100).toFixed(2);
                            const color = change >= 0 ? colors.up : colors.down;
                            html += `<div style="display:flex;justify-content:space-between;gap:20px;margin:2px 0">
                <span style="color:${colors.tooltipLabel}">价格</span>
                <span style="color:${color};font-weight:600;font-family:monospace">${price.toFixed(2)}</span>
              </div>`;
                            html += `<div style="display:flex;justify-content:space-between;gap:20px;margin:2px 0">
                <span style="color:${colors.tooltipLabel}">涨跌</span>
                <span style="color:${color};font-family:monospace">${change >= 0 ? '+' : ''}${change.toFixed(2)} (${change >= 0 ? '+' : ''}${changePct}%)</span>
              </div>`;
                        } else if (item.seriesName === '均价') {
                                                        const avgPrice = Number(item.value);
                                                        if (!Number.isFinite(avgPrice)) return;
                                                        html += `<div style="display:flex;justify-content:space-between;gap:20px;margin:2px 0">
                <span style="color:${colors.tooltipLabel}">均价</span>
                                <span style="color:${colors.avgLine};font-family:monospace">${avgPrice.toFixed(2)}</span>
              </div>`;
                        } else if (item.seriesName === '成交量') {
                            const vol = item.value;
                            const volStr = vol >= 10000 ? (vol / 10000).toFixed(2) + '万' : vol.toString();
                            html += `<div style="display:flex;justify-content:space-between;gap:20px;margin:2px 0">
                <span style="color:${colors.tooltipLabel}">成交量</span>
                <span style="font-family:monospace">${volStr}</span>
              </div>`;
                        }
                    });
                    return html;
                }
            },
            grid: [
                {
                    left: horizontalPadding,
                    right: horizontalPadding,
                    top: priceGridTop,
                    height: priceGridHeight
                },
                {
                    left: horizontalPadding,
                    right: horizontalPadding,
                    top: volumeGridTop,
                    height: volumeGridHeight
                }
            ],
            xAxis: [
                {
                    type: 'category',
                    data: times,
                    boundaryGap: false,
                    axisLine: { lineStyle: { color: colors.line } },
                    axisTick: { show: false },
                    axisLabel: {
                        color: colors.text,
                        fontSize: 11,
                        margin: isFullscreen ? 18 : 14,
                        interval: 0,
                        hideOverlap: false,
                        showMinLabel: true,
                        showMaxLabel: true,
                        fontFamily: 'monospace',
                        formatter: (value: string) => {
                            return KEY_TIME_LABELS[value] || '';
                        }
                    },
                    splitLine: {
                        show: true,
                        lineStyle: { color: colors.grid, type: 'solid', width: 0.5 }
                    }
                },
                {
                    type: 'category',
                    gridIndex: 1,
                    data: times,
                    boundaryGap: false,
                    axisLine: { lineStyle: { color: colors.line } },
                    axisTick: { show: false },
                    axisLabel: { show: false },
                    splitLine: { show: false }
                }
            ],
            yAxis: [
                {
                    // 左Y轴：价格（对称）
                    type: 'value',
                    min: yMin,
                    max: yMax,
                    position: 'left',
                    splitNumber: 8,
                    axisLine: { lineStyle: { color: colors.line } },
                    axisTick: { show: false },
                    axisLabel: {
                        fontSize: 11,
                        margin: isFullscreen ? 18 : 10,
                        fontFamily: 'monospace',
                        // 东方财富风格：高于昨收红色，低于昨收绿色
                        color: (value?: string | number) => {
                            const v = Number(value);
                            if (v > preClose + 0.001) return colors.up;
                            if (v < preClose - 0.001) return colors.down;
                            return colors.text;
                        },
                        formatter: (value: number) => value.toFixed(2)
                    },
                    splitLine: {
                        lineStyle: { color: colors.grid, type: 'solid', width: 0.5 }
                    }
                },
                {
                    // 右Y轴：涨跌幅（对称）
                    type: 'value',
                    min: -maxChangePct,
                    max: maxChangePct,
                    position: 'right',
                    splitNumber: 8,
                    axisLine: { lineStyle: { color: colors.line } },
                    axisTick: { show: false },
                    axisLabel: {
                        fontSize: 11,
                        margin: isFullscreen ? 18 : 10,
                        fontFamily: 'monospace',
                        // 东方财富风格：正值红色，负值绿色
                        color: (value?: string | number) => {
                            const v = Number(value);
                            if (v > 0.001) return colors.up;
                            if (v < -0.001) return colors.down;
                            return colors.text;
                        },
                        formatter: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
                    },
                    splitLine: { show: false }
                },
                {
                    // 成交量Y轴
                    type: 'value',
                    gridIndex: 1,
                    min: 0,
                    max: volumeAxisMax,
                    interval: volumeStep,
                    axisLine: { lineStyle: { color: colors.line } },
                    axisTick: { show: false },
                    axisLabel: {
                        fontSize: 9,
                        fontFamily: 'monospace',
                        color: colors.textMuted,
                        margin: isFullscreen ? 18 : 12,
                        formatter: (value: number) => {
                            if (value === 0) return '0';
                            return `${(value / 10000).toFixed(0)}万`;
                        }
                    },
                    splitLine: {
                        show: true,
                        lineStyle: { color: colors.gridFaint, type: 'dashed', width: 0.5 }
                    }
                }
            ],
            series: [
                {
                    // 价格线
                    name: '价格',
                    type: 'line',
                    data: prices,
                    symbol: 'none',
                    connectNulls: true,
                    lineStyle: {
                        width: 1.5,
                        color: colors.priceLine
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: colors.areaGrad0 },
                            { offset: 0.5, color: colors.areaGradMid },
                            { offset: 1, color: colors.areaGrad1 }
                        ])
                    },
                    // 昨收基准线（东方财富风格：灰色实线，无文字）
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        lineStyle: {
                            color: colors.markLine,
                            type: 'solid',
                            width: 1
                        },
                        label: { show: false },
                        data: [
                            { yAxis: preClose }
                        ]
                    }
                },
                {
                    // 均价线（东方财富风格：黄色实线）
                    name: '均价',
                    type: 'line',
                    data: avgPrices,
                    symbol: 'none',
                    connectNulls: true,
                    lineStyle: {
                        width: 1,
                        color: colors.avgLine,
                        type: 'solid'
                    }
                },
                {
                    // 成交量柱（前后价格对比着色）
                    name: '成交量',
                    type: 'bar',
                    xAxisIndex: 1,
                    yAxisIndex: 2,
                    data: volumes.map((vol, idx) => ({
                        value: vol,
                        itemStyle: {
                            color: volumeColors[idx]
                        }
                    })),
                    barWidth: volumeBarWidth
                }
            ]
        };

        chart.setOption(option, true); // notMerge=true for clean replace
        chart.resize();
    }, [data, preClose, stockName, stockCode, tradeDate, layoutMode, themeKey]);

    return (
        <div className={cn('flex h-full min-h-0 w-full flex-col', className)}>
            <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 h-0.5 bg-blue-700 dark:bg-blue-400 rounded"></span>
                        <span className="text-muted-foreground">价格</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 h-0.5 bg-amber-600 dark:bg-amber-400 rounded"></span>
                        <span className="text-muted-foreground">均价</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 h-[1px] bg-slate-400 dark:bg-slate-500"></span>
                        <span className="text-muted-foreground">昨收</span>
                    </span>
                </div>
            </div>
            {data.length > 0 ? (
                <div
                    ref={chartContainerRef}
                    className={cn('flex-1 w-full rounded-lg border border-border bg-card', layoutMode === 'fullscreen' ? 'min-h-0 h-full' : 'min-h-[460px]')}
                />
            ) : (
                <div className={cn('flex-1 w-full rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground', layoutMode === 'fullscreen' ? 'min-h-0 h-full' : 'min-h-[460px]')}>
                    暂无分时数据
                </div>
            )}
        </div>
    );
}
