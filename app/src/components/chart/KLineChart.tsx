import { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import * as echarts from 'echarts/core';
import { CandlestickChart, BarChart as EBarChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { getStockChartColors } from '@/lib/chartTheme';

echarts.use([
  CandlestickChart,
  EBarChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  CanvasRenderer,
]);

interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface KLineChartProps {
  data: KLineData[];
  className?: string;
  period?: 'day' | 'week' | 'month';
  defaultPeriod?: 'day' | 'week' | 'month';
  onPeriodChange?: (period: 'day' | 'week' | 'month') => void;
  layoutMode?: 'default' | 'fullscreen';
  themeKey?: string;
}

// 聚合日K为周K / 月K
function aggregateKLine(data: KLineData[], period: 'day' | 'week' | 'month'): KLineData[] {
  if (period === 'day' || data.length === 0) return data;

  const groups: KLineData[][] = [];
  let currentGroup: KLineData[] = [];

  for (const item of data) {
    const d = new Date(item.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
    if (currentGroup.length === 0) {
      currentGroup.push(item);
      continue;
    }

    const prevDate = new Date(currentGroup[0].date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
    let isSameGroup = false;

    if (period === 'week') {
      // 同一周：取 ISO week
      const getWeek = (dt: Date) => {
        const start = new Date(dt.getFullYear(), 0, 1);
        return Math.ceil(((dt.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
      };
      isSameGroup = d.getFullYear() === prevDate.getFullYear() && getWeek(d) === getWeek(prevDate);
    } else {
      isSameGroup = d.getFullYear() === prevDate.getFullYear() && d.getMonth() === prevDate.getMonth();
    }

    if (isSameGroup) {
      currentGroup.push(item);
    } else {
      groups.push(currentGroup);
      currentGroup = [item];
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  return groups.map((group) => ({
    date: group[group.length - 1].date,
    open: group[0].open,
    high: Math.max(...group.map((g) => g.high)),
    low: Math.min(...group.map((g) => g.low)),
    close: group[group.length - 1].close,
    volume: group.reduce((sum, g) => sum + g.volume, 0),
  }));
}

export function KLineChart({
  data,
  className,
  period: controlledPeriod,
  defaultPeriod = 'day',
  onPeriodChange,
  layoutMode = 'default',
  themeKey,
}: KLineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [internalPeriod, setInternalPeriod] = useState<'day' | 'week' | 'month'>(defaultPeriod);
  const period = controlledPeriod ?? internalPeriod;

  const handlePeriodChange = (nextPeriod: 'day' | 'week' | 'month') => {
    if (controlledPeriod === undefined) {
      setInternalPeriod(nextPeriod);
    }
    onPeriodChange?.(nextPeriod);
  };

  // 根据周期聚合数据
  const chartData = useMemo(() => aggregateKLine(data, period), [data, period]);

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

  // Update option when data or period changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (chartData.length === 0) {
      chart.clear();
      return;
    }

    const themeHost = chartContainerRef.current;
    if (!themeHost) return;

    const colors = getStockChartColors(themeHost);
    const isFullscreen = layoutMode === 'fullscreen';
    const priceGridLeft = isFullscreen ? 118 : '10%';
    const priceGridRight = isFullscreen ? 82 : '3%';
    const priceGridTop = isFullscreen ? '8%' : '8%';
    const priceGridHeight = isFullscreen ? '63%' : '55%';
    const volumeGridTop = isFullscreen ? '77%' : '70%';
    const volumeGridHeight = isFullscreen ? '17%' : '15%';
    const zoomTop = isFullscreen ? '94%' : '92%';
    const dates = chartData.map(item => item.date);
    const values = chartData.map(item => [item.open, item.close, item.low, item.high]);
    const volumes = chartData.map(item => item.volume);
    const maxVolume = Math.max(...volumes, 0);
    const volumeStepBase = 500000;
    const volumeInterval = maxVolume > 0
      ? Math.max(volumeStepBase, Math.ceil(maxVolume / 3 / volumeStepBase) * volumeStepBase)
      : volumeStepBase;
    const volumeAxisMax = Math.max(volumeInterval * 3, Math.ceil(maxVolume / volumeInterval) * volumeInterval);

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        textStyle: { color: colors.tooltipText },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';

          const candle = params.find((item) => item.seriesName === 'K线');
          const volume = params.find((item) => item.seriesName === '成交量');
          const axisValue = params[0]?.axisValue ?? '';

          let html = `<div style="font-weight:600;margin-bottom:8px;color:${colors.tooltipText}">${axisValue}</div>`;

          if (candle && Array.isArray(candle.data) && candle.data.length >= 4) {
            const [open, close, low, high] = candle.data as [number, number, number, number];
            html += `<div style="display:flex;align-items:center;gap:8px;margin:2px 0 8px 0;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:${close >= open ? colors.up : colors.down}"></span>
              <span style="color:${colors.tooltipText};font-weight:600;">K线</span>
            </div>`;
            html += `<div style="display:flex;justify-content:space-between;gap:20px;margin:2px 0"><span>开盘</span><span style="font-family:monospace;font-weight:600">${open.toFixed(2)}</span></div>`;
            html += `<div style="display:flex;justify-content:space-between;gap:20px;margin:2px 0"><span>收盘</span><span style="font-family:monospace;font-weight:600">${close.toFixed(2)}</span></div>`;
            html += `<div style="display:flex;justify-content:space-between;gap:20px;margin:2px 0"><span>最低</span><span style="font-family:monospace;font-weight:600">${low.toFixed(2)}</span></div>`;
            html += `<div style="display:flex;justify-content:space-between;gap:20px;margin:2px 0"><span>最高</span><span style="font-family:monospace;font-weight:600">${high.toFixed(2)}</span></div>`;
          }

          if (volume) {
            const volumeValue = Number(volume.value ?? 0);
            const volumeText = volumeValue >= 10000
              ? `${(volumeValue / 10000).toFixed(2)}万`
              : `${Math.round(volumeValue)}`;
            html += `<div style="display:flex;justify-content:space-between;gap:20px;margin:8px 0 2px 0"><span>成交量</span><span style="font-family:monospace;font-weight:600">${volumeText}</span></div>`;
          }

          return html;
        }
      },
      grid: [
        {
          left: priceGridLeft,
          right: priceGridRight,
          top: priceGridTop,
          height: priceGridHeight
        },
        {
          left: priceGridLeft,
          right: priceGridRight,
          top: volumeGridTop,
          height: volumeGridHeight
        }
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: { onZero: false, lineStyle: { color: colors.line } },
          splitLine: { show: false },
          axisLabel: { color: colors.text },
          min: 'dataMin',
          max: 'dataMax'
        },
        {
          type: 'category',
          gridIndex: 1,
          data: dates,
          axisLabel: { show: false }
        }
      ],
      yAxis: [
        {
          scale: true,
          splitArea: {
            show: true,
            areaStyle: {
              color: ['transparent', 'transparent']
            }
          },
          axisLine: { lineStyle: { color: colors.line } },
          axisLabel: { color: colors.text, margin: isFullscreen ? 18 : 8 },
          splitLine: { lineStyle: { color: colors.grid } }
        },
        {
          scale: true,
          gridIndex: 1,
          min: 0,
          max: volumeAxisMax,
          interval: volumeInterval,
          axisLabel: {
            show: true,
            color: colors.text,
            margin: isFullscreen ? 18 : 8,
            formatter: (value: number) => {
              if (value === 0) return '0';
              return `${(value / 10000).toFixed(0)}万`;
            }
          },
          axisLine: { lineStyle: { color: colors.line } },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } }
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 50,
          end: 100
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: 'slider',
          top: zoomTop,
          start: 50,
          end: 100,
          textStyle: { color: colors.text },
          borderColor: colors.line,
          fillerColor: colors.zoom,
          handleStyle: {
            color: colors.zoomHandle
          }
        }
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: values,
          itemStyle: {
            color: colors.up,
            color0: colors.down,
            borderColor: colors.up,
            borderColor0: colors.down
          }
        },
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes,
          itemStyle: {
            color: (params: any) => {
              const dataIndex = params.dataIndex;
              const close = values[dataIndex][1];
              const open = values[dataIndex][0];
              return close >= open ? colors.up : colors.down;
            }
          }
        }
      ]
    }, true); // notMerge=true for clean replace
    chart.resize();
  }, [chartData, layoutMode, themeKey]);

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">K线图</span>
        </div>
        <div className="flex gap-1">
          <Button
            variant={period === 'day' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => handlePeriodChange('day')}
          >
            日K
          </Button>
          <Button
            variant={period === 'week' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => handlePeriodChange('week')}
          >
            周K
          </Button>
          <Button
            variant={period === 'month' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => handlePeriodChange('month')}
          >
            月K
          </Button>
        </div>
      </div>
      <div 
        ref={chartContainerRef} 
        className={cn('flex-1 w-full rounded-lg bg-muted/50', layoutMode === 'fullscreen' ? 'min-h-0 h-full' : 'min-h-[300px]')}
      />
    </div>
  );
}
