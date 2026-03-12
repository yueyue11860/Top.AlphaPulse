import { Suspense, lazy, useState, useEffect } from 'react';
import useSWR from 'swr';
import { StockListTable } from '@/components/stock/StockListTable';
import { cn, formatNumber, getChangeColor, formatLargeNumber, formatVolumeHand } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { ENABLE_STOCK_DETAIL_WATCH_THEME } from '@/config/featureFlags';
import { useWatchTheme } from '@/hooks/useWatchTheme';
import { WatchThemeSwitcher } from '@/components/stock/WatchThemeSwitcher';
import { WatchlistToggleButton } from '@/components/stock/WatchlistToggleButton';
import { getWatchThemeClassName } from '@/lib/watchThemes';
import {
  Bell,
  Share2,
  TrendingUp,
  BarChart3,
  FileText,
  Newspaper,
  ArrowLeft,
  Building2,
  CalendarDays,
  ExternalLink,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { fetchStockDetailBundle } from '@/services/stockDetailService';
import { getStockDetailRefreshInterval } from '@/lib/marketTime';
import {
  fetchAnnouncementDetail,
  fetchAnnouncements,
  fetchFinanceCalendar,
  fetchFinanceCalendarDetail,
  fetchResearchReportDetail,
  fetchResearchReports,
} from '@/services/newsService';
import type {
  AnnouncementDetail,
  AnnouncementItem,
  FinanceCalendarEvent,
  ResearchReportDetail,
  ResearchReportItem,
} from '@/types';

const KLineChart = lazy(() => import('@/components/chart/KLineChart').then((m) => ({ default: m.KLineChart })));
const TimeSeriesChart = lazy(() => import('@/components/chart/TimeSeriesChart').then((m) => ({ default: m.TimeSeriesChart })));

interface StockDetailData {
  ts_code: string;
  symbol: string;
  name: string;
  industry: string;
  market: string;
  area: string;
  list_date: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pre_close: number;
  change: number;
  pct_chg: number;
  vol: number;
  amount: number;
  turnover_rate: number;
  turnover_rate_f: number;
  volume_ratio: number;
  pe: number;
  pe_ttm: number;
  pb: number;
  ps: number;
  ps_ttm: number;
  dv_ratio: number;
  dv_ttm: number;
  total_share: number;
  float_share: number;
  free_share: number;
  total_mv: number;
  circ_mv: number;
}

interface MoneyFlowItem {
  trade_date: string;
  buy_sm_amount: number;
  sell_sm_amount: number;
  net_sm_amount: number;
  buy_md_amount: number;
  sell_md_amount: number;
  net_md_amount: number;
  buy_lg_amount: number;
  sell_lg_amount: number;
  net_lg_amount: number;
  buy_elg_amount: number;
  sell_elg_amount: number;
  net_elg_amount: number;
  net_main_amount: number;
  net_mf_amount: number;
}

interface KLineItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TimeSeriesItem {
  date?: string;
  time: string;
  price: number;
  volume: number;
  avg_price: number;
  pre_close?: number;
}

interface RealtimeQuoteItem {
  ts_code: string;
  name: string;
  date: string;
  time: string;
  open: number;
  high: number;
  low: number;
  price: number;
  volume: number;
  amount: number;
  pre_close: number;
  change_pct: number;
  change_amount: number;
  bid: number;
  ask: number;
  b1_v: number;
  b1_p: number;
  b2_v: number;
  b2_p: number;
  b3_v: number;
  b3_p: number;
  b4_v: number;
  b4_p: number;
  b5_v: number;
  b5_p: number;
  a1_v: number;
  a1_p: number;
  a2_v: number;
  a2_p: number;
  a3_v: number;
  a3_p: number;
  a4_v: number;
  a4_p: number;
  a5_v: number;
  a5_p: number;
}

type ChartType = 'timeseries' | 'kline';
type KLinePeriod = 'day' | 'week' | 'month';

function formatOrderBookVolume(value: number) {
  const amount = Number(value || 0);
  if (amount >= 10000) return `${(amount / 10000).toFixed(2)}万`;
  return `${Math.round(amount)}`;
}

function formatSignedPercent(value: number) {
  const num = Number(value || 0);
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
}

function formatSignedNumber(value: number) {
  const num = Number(value || 0);
  return `${num > 0 ? '+' : ''}${num.toFixed(0)}`;
}

function RealtimeOrderBook({
  quote,
  fallbackPreClose,
  className,
  watchThemeEnabled = false,
}: {
  quote: RealtimeQuoteItem | null;
  fallbackPreClose: number;
  className?: string;
  watchThemeEnabled?: boolean;
}) {
  if (!quote) {
    return (
      <Card className={cn('p-4 h-full overflow-auto', className)}>
        <h3 className="text-sm font-medium text-foreground mb-3">实时盘口</h3>
        <div className="h-full min-h-[32rem] flex items-center justify-center text-sm text-muted-foreground">
          暂无实时盘口数据
        </div>
      </Card>
    );
  }

  const preClose = quote.pre_close || fallbackPreClose || 0;
  const buyTotal = Number(quote.b1_v || 0) + Number(quote.b2_v || 0) + Number(quote.b3_v || 0) + Number(quote.b4_v || 0) + Number(quote.b5_v || 0);
  const sellTotal = Number(quote.a1_v || 0) + Number(quote.a2_v || 0) + Number(quote.a3_v || 0) + Number(quote.a4_v || 0) + Number(quote.a5_v || 0);
  const totalEntrust = buyTotal + sellTotal;
  const ratio = totalEntrust > 0 ? ((buyTotal - sellTotal) / totalEntrust) * 100 : 0;
  const diff = buyTotal - sellTotal;
  const maxLevelVolume = Math.max(
    buyTotal,
    sellTotal,
    Number(quote.b1_v || 0),
    Number(quote.b2_v || 0),
    Number(quote.b3_v || 0),
    Number(quote.b4_v || 0),
    Number(quote.b5_v || 0),
    Number(quote.a1_v || 0),
    Number(quote.a2_v || 0),
    Number(quote.a3_v || 0),
    Number(quote.a4_v || 0),
    Number(quote.a5_v || 0),
    1,
  );

  const sellLevels = [
    { label: '卖五', price: quote.a5_p, volume: quote.a5_v },
    { label: '卖四', price: quote.a4_p, volume: quote.a4_v },
    { label: '卖三', price: quote.a3_p, volume: quote.a3_v },
    { label: '卖二', price: quote.a2_p, volume: quote.a2_v },
    { label: '卖一', price: quote.a1_p, volume: quote.a1_v },
  ];
  const buyLevels = [
    { label: '买一', price: quote.b1_p, volume: quote.b1_v },
    { label: '买二', price: quote.b2_p, volume: quote.b2_v },
    { label: '买三', price: quote.b3_p, volume: quote.b3_v },
    { label: '买四', price: quote.b4_p, volume: quote.b4_v },
    { label: '买五', price: quote.b5_p, volume: quote.b5_v },
  ];

  return (
    <Card className={cn(watchThemeEnabled && 'watch-theme-card', 'p-4 h-full overflow-auto', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">实时盘口</h3>
        <span className="text-xs font-mono text-muted-foreground">{quote.date} {quote.time}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 pb-4 border-b border-border">
        <div>
          <div className="text-xs text-muted-foreground">委比</div>
          <div className={cn('text-3xl font-mono mt-1', getChangeColor(ratio))}>{formatSignedPercent(ratio)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">委差</div>
          <div className={cn('text-3xl font-mono mt-1', getChangeColor(diff))}>{formatSignedNumber(diff)}</div>
        </div>
      </div>

      <div className="space-y-1 py-4 border-b border-border">
        {sellLevels.map((level) => (
          <div key={level.label} className="grid grid-cols-[3.5rem_5rem_1fr_4.75rem] items-center gap-2 text-sm">
            <span className="text-muted-foreground">{level.label}</span>
            <span className={cn('font-mono', getChangeColor((level.price || 0) - preClose))}>{formatNumber(level.price || 0)}</span>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-[hsl(var(--watch-sell-fill)/0.88)]"
                style={{ width: `${Math.max(4, Math.round((Number(level.volume || 0) / maxLevelVolume) * 100))}%` }}
              />
            </div>
            <span className="font-mono text-right text-foreground">{formatOrderBookVolume(level.volume || 0)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1 py-4 border-b border-border">
        {buyLevels.map((level) => (
          <div key={level.label} className="grid grid-cols-[3.5rem_5rem_1fr_4.75rem] items-center gap-2 text-sm">
            <span className="text-muted-foreground">{level.label}</span>
            <span className={cn('font-mono', getChangeColor((level.price || 0) - preClose))}>{formatNumber(level.price || 0)}</span>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-[hsl(var(--watch-buy-fill)/0.88)]"
                style={{ width: `${Math.max(4, Math.round((Number(level.volume || 0) / maxLevelVolume) * 100))}%` }}
              />
            </div>
            <span className="font-mono text-right text-foreground">{formatOrderBookVolume(level.volume || 0)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4 text-sm">
        <div className={watchThemeEnabled ? 'watch-theme-stat rounded-lg p-3' : 'rounded-lg bg-muted/60 p-3'}>
          <div className="text-xs text-muted-foreground mb-1">买入价 / 卖出价</div>
          <div className="font-mono text-foreground">{formatNumber(quote.bid || 0)} / {formatNumber(quote.ask || 0)}</div>
        </div>
        <div className={watchThemeEnabled ? 'watch-theme-stat rounded-lg p-3' : 'rounded-lg bg-muted/60 p-3'}>
          <div className="text-xs text-muted-foreground mb-1">实时成交量</div>
          <div className="font-mono text-foreground">{formatOrderBookVolume(quote.volume || 0)}</div>
        </div>
      </div>
    </Card>
  );
}

function RelatedContentSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border p-3 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function EmptyRelatedContent({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground text-center py-6">{text}</div>;
}

function StockChartWorkspace({
  chartType,
  onChartTypeChange,
  isFullscreen,
  onToggleFullscreen,
  allowDoubleClick,
  timeSeriesData,
  timeSeriesPreClose,
  timeSeriesTradeDate,
  stockName,
  stockCode,
  kLineData,
  kLinePeriod,
  onKLinePeriodChange,
  realtimeQuote,
  fallbackPreClose,
  themeKey,
  watchThemeEnabled = false,
}: {
  chartType: ChartType;
  onChartTypeChange: (nextType: ChartType) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  allowDoubleClick: boolean;
  timeSeriesData: TimeSeriesItem[];
  timeSeriesPreClose: number;
  timeSeriesTradeDate?: string;
  stockName: string;
  stockCode: string;
  kLineData: KLineItem[];
  kLinePeriod: KLinePeriod;
  onKLinePeriodChange: (nextPeriod: KLinePeriod) => void;
  realtimeQuote: RealtimeQuoteItem | null;
  fallbackPreClose: number;
  themeKey?: string;
  watchThemeEnabled?: boolean;
}) {
  const isTimeseries = chartType === 'timeseries';
  const chartViewportClassName = isFullscreen ? 'h-full min-h-0 w-full' : isTimeseries ? 'h-[32rem]' : 'h-96';
  const chartFallbackClassName = cn(chartViewportClassName, 'w-full');

  return (
    <div className={cn('grid grid-cols-1 gap-4', isFullscreen ? 'h-full min-h-0 grid-rows-[minmax(0,1fr)] md:grid-cols-3 md:gap-4' : 'lg:grid-cols-3')}>
      <Card
        className={cn(
          watchThemeEnabled && 'watch-theme-card',
          'p-4 overflow-hidden',
          isFullscreen ? 'flex h-full min-h-0 flex-col md:col-span-2' : 'lg:col-span-2'
        )}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={isTimeseries ? 'default' : 'outline'}
              size="sm"
              className={cn('h-7 px-3 text-xs', watchThemeEnabled && 'watch-theme-control')}
              onClick={() => onChartTypeChange('timeseries')}
            >
              分时
            </Button>
            <Button
              variant={!isTimeseries ? 'default' : 'outline'}
              size="sm"
              className={cn('h-7 px-3 text-xs', watchThemeEnabled && 'watch-theme-control')}
              onClick={() => onChartTypeChange('kline')}
            >
              日K
            </Button>
          </div>

          <Button variant="outline" size="sm" className={cn('h-8 gap-2', watchThemeEnabled && 'watch-theme-control')} onClick={onToggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullscreen ? '退出全屏' : '全屏查看'}
          </Button>
        </div>

        <div
          className={cn('min-h-0 w-full', isFullscreen && 'h-full flex-1', allowDoubleClick && 'cursor-zoom-in')}
          onDoubleClick={allowDoubleClick ? onToggleFullscreen : undefined}
        >
          <Suspense fallback={<Skeleton className={chartFallbackClassName} />}>
            {isTimeseries ? (
              timeSeriesData.length > 0 ? (
                <TimeSeriesChart
                  data={timeSeriesData}
                  preClose={timeSeriesPreClose}
                  className={chartViewportClassName}
                  stockName={stockName}
                  stockCode={stockCode}
                  tradeDate={timeSeriesTradeDate}
                  layoutMode={isFullscreen ? 'fullscreen' : 'default'}
                  themeKey={themeKey}
                />
              ) : (
                <div className={cn(chartViewportClassName, 'flex items-center justify-center text-sm text-muted-foreground')}>
                  当前股票暂无实时分时数据（同步任务可能未覆盖该标的）
                </div>
              )
            ) : kLineData.length > 0 ? (
              <KLineChart
                data={kLineData}
                className={chartViewportClassName}
                period={kLinePeriod}
                onPeriodChange={onKLinePeriodChange}
                layoutMode={isFullscreen ? 'fullscreen' : 'default'}
                themeKey={themeKey}
              />
            ) : (
              <div className={cn(chartViewportClassName, 'flex items-center justify-center text-muted-foreground')}>
                暂无K线数据
              </div>
            )}
          </Suspense>
        </div>
      </Card>

      <div className={cn(isFullscreen && 'min-h-0 h-full')}>
        <RealtimeOrderBook
          quote={realtimeQuote}
          fallbackPreClose={fallbackPreClose}
          className={cn(isFullscreen && 'h-full min-h-0')}
          watchThemeEnabled={watchThemeEnabled}
        />
      </div>
    </div>
  );
}

function StockChartFullscreenDialog({
  open,
  onOpenChange,
  workspace,
  themeClassName,
  watchThemeEnabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: React.ReactNode;
  themeClassName?: string;
  watchThemeEnabled?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          watchThemeEnabled && themeClassName,
          '!left-0 !top-0 z-[60] !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 gap-0 rounded-none border-0 bg-background/95 p-0 shadow-none sm:!max-w-none'
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>股票图表全屏看盘</DialogTitle>
          <DialogDescription>全屏查看分时图、日K图与实时盘口。</DialogDescription>
        </DialogHeader>
        <div className={cn('h-full w-full overflow-hidden p-2 md:p-4', watchThemeEnabled && 'watch-theme-shell')}>{workspace}</div>
      </DialogContent>
    </Dialog>
  );
}

function getEventStatusLabel(status: FinanceCalendarEvent['status']) {
  switch (status) {
    case 'ongoing':
      return '进行中';
    case 'done':
      return '已结束';
    default:
      return '未开始';
  }
}

const INITIAL_RELATED_PAGE_SIZE = 5;
const RELATED_PAGE_INCREMENT = 5;
const WATCH_THEME_STAT_CARD_CLASS = 'watch-theme-stat rounded-lg p-3';
const WATCH_THEME_TAB_LIST_CLASS = 'watch-theme-tabs w-full justify-start overflow-x-auto';
const WATCH_THEME_TAB_TRIGGER_CLASS = 'watch-theme-tab';
const WATCH_THEME_INTERACTIVE_CARD_CLASS = 'watch-theme-interactive w-full rounded-lg border border-border p-3 space-y-2 text-left transition-colors';

// 股票详情视图组件
function StockDetailView({
  stockCode,
  onBack,
  onOpenNews,
}: {
  stockCode: string;
  onBack: () => void;
  onOpenNews?: (tab: 'announcement' | 'report' | 'calendar', stockCode?: string | null) => void;
}) {
  const isMobile = useIsMobile();
  const watchTheme = useWatchTheme();
  const watchThemeEnabled = ENABLE_STOCK_DETAIL_WATCH_THEME;
  const [chartType, setChartType] = useState<ChartType>('timeseries');
  const [kLinePeriod, setKLinePeriod] = useState<KLinePeriod>('day');
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [announcementPageSize, setAnnouncementPageSize] = useState(INITIAL_RELATED_PAGE_SIZE);
  const [reportPageSize, setReportPageSize] = useState(INITIAL_RELATED_PAGE_SIZE);
  const [calendarPageSize, setCalendarPageSize] = useState(INITIAL_RELATED_PAGE_SIZE);

  useEffect(() => {
    setAnnouncementPageSize(INITIAL_RELATED_PAGE_SIZE);
    setReportPageSize(INITIAL_RELATED_PAGE_SIZE);
    setCalendarPageSize(INITIAL_RELATED_PAGE_SIZE);
    setSelectedAnnouncementId(null);
    setSelectedReportId(null);
    setSelectedEventId(null);
    setIsChartFullscreen(false);
    setKLinePeriod('day');
  }, [stockCode]);

  const { data, isLoading } = useSWR(
    ['stock:detail:bundle', stockCode],
    () => fetchStockDetailBundle(stockCode),
    {
      dedupingInterval: 1_000,
      refreshInterval: () => getStockDetailRefreshInterval(),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const loading = isLoading && !data;
  const stockData = (data?.detail || null) as StockDetailData | null;
  const kLineData = (data?.kLineData || []) as KLineItem[];
  const timeSeriesData = (data?.timeSeriesData || []) as TimeSeriesItem[];
  const realtimeQuote = (data?.realtimeQuote || null) as RealtimeQuoteItem | null;
  const timeSeriesLast = timeSeriesData.length > 0 ? timeSeriesData[timeSeriesData.length - 1] : null;
  const timeSeriesPreClose = timeSeriesLast?.pre_close || stockData?.pre_close || 0;
  const timeSeriesTradeDate = timeSeriesLast?.date || stockData?.trade_date;
  const moneyFlowData = (data?.moneyFlowData || []) as MoneyFlowItem[];
  const { data: announcementData, isLoading: announcementLoading } = useSWR(
    ['stock:announcements', stockCode, announcementPageSize],
    () => fetchAnnouncements({ stockCode, page: 1, pageSize: announcementPageSize, dateRange: '90d' }),
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
  const { data: reportData, isLoading: reportLoading } = useSWR(
    ['stock:research-reports', stockCode, reportPageSize],
    () => fetchResearchReports({ stockCode, page: 1, pageSize: reportPageSize, dateRange: '90d' }),
    {
      dedupingInterval: 90_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
  const { data: calendarData, isLoading: calendarLoading } = useSWR(
    ['stock:calendar', stockCode, calendarPageSize],
    () => fetchFinanceCalendar({ stockCode, page: 1, pageSize: calendarPageSize, dateRange: 'all' }),
    {
      dedupingInterval: 120_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const announcements = (announcementData?.items || []) as AnnouncementItem[];
  const reports = (reportData?.items || []) as ResearchReportItem[];
  const calendarEvents = (calendarData?.items || []) as FinanceCalendarEvent[];
  const announcementTotal = announcementData?.total || 0;
  const reportTotal = reportData?.total || 0;
  const calendarTotal = calendarData?.total || 0;
  const canExpandAnnouncements = announcementTotal > announcements.length;
  const canCollapseAnnouncements = announcementPageSize > INITIAL_RELATED_PAGE_SIZE;
  const canExpandReports = reportTotal > reports.length;
  const canCollapseReports = reportPageSize > INITIAL_RELATED_PAGE_SIZE;
  const canExpandCalendar = calendarTotal > calendarEvents.length;
  const canCollapseCalendar = calendarPageSize > INITIAL_RELATED_PAGE_SIZE;
  const { data: selectedAnnouncementDetail, isLoading: announcementDetailLoading } = useSWR(
    selectedAnnouncementId ? ['stock:announcement-detail', selectedAnnouncementId] : null,
    () => fetchAnnouncementDetail(selectedAnnouncementId as string),
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
  const { data: selectedReportDetail, isLoading: reportDetailLoading } = useSWR(
    selectedReportId ? ['stock:report-detail', selectedReportId] : null,
    () => fetchResearchReportDetail(selectedReportId as string),
    {
      dedupingInterval: 90_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
  const { data: selectedEventDetail, isLoading: eventDetailLoading } = useSWR(
    selectedEventId ? ['stock:event-detail', selectedEventId] : null,
    () => fetchFinanceCalendarDetail(selectedEventId as string),
    {
      dedupingInterval: 120_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-96 lg:col-span-2" />
          <div className="space-y-4">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        </div>
      </div>
    );
  }

  if (!stockData) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </Button>
        <div className="text-center py-20 text-muted-foreground">
          未找到股票数据
        </div>
      </div>
    );
  }

  const { pct_chg, close: currentPrice, pre_close: preClose } = stockData;
  const displayedPrice = currentPrice;
  const displayedPreClose = preClose;
  const displayedChange = stockData.change ?? (displayedPrice - displayedPreClose);
  const displayedPctChg = displayedPreClose > 0
    ? (displayedChange / displayedPreClose) * 100
    : pct_chg;
  const displayedOpen = stockData.open;
  const displayedHigh = stockData.high;
  const displayedLow = stockData.low;
  const displayedVolume = stockData.vol;
  const displayedAmount = stockData.amount;
  const watchThemeClassName = watchThemeEnabled ? getWatchThemeClassName(watchTheme.theme) : undefined;
  const statCardClassName = watchThemeEnabled ? WATCH_THEME_STAT_CARD_CLASS : 'bg-muted rounded-lg p-3';
  const primaryTabsListClassName = watchThemeEnabled ? WATCH_THEME_TAB_LIST_CLASS : 'w-full justify-start bg-muted';
  const nestedTabsListClassName = watchThemeEnabled ? WATCH_THEME_TAB_LIST_CLASS : 'w-full justify-start bg-muted overflow-x-auto';
  const tabTriggerClassName = watchThemeEnabled ? WATCH_THEME_TAB_TRIGGER_CLASS : 'data-[state=active]:bg-white';
  const interactiveCardClassName = watchThemeEnabled
    ? WATCH_THEME_INTERACTIVE_CARD_CLASS
    : 'w-full rounded-lg border border-border p-3 space-y-2 text-left hover:bg-muted/50 transition-colors';
  const chartWorkspace = (
    <StockChartWorkspace
      chartType={chartType}
      onChartTypeChange={setChartType}
      isFullscreen={false}
      onToggleFullscreen={() => setIsChartFullscreen(true)}
      allowDoubleClick={!isMobile}
      timeSeriesData={timeSeriesData}
      timeSeriesPreClose={timeSeriesPreClose}
      timeSeriesTradeDate={timeSeriesTradeDate}
      stockName={stockData.name}
      stockCode={stockData.ts_code}
      kLineData={kLineData}
      kLinePeriod={kLinePeriod}
      onKLinePeriodChange={setKLinePeriod}
      realtimeQuote={realtimeQuote}
      fallbackPreClose={timeSeriesPreClose || preClose}
      themeKey={watchThemeEnabled ? watchTheme.theme : undefined}
      watchThemeEnabled={watchThemeEnabled}
    />
  );

  const fullscreenWorkspace = (
    <StockChartWorkspace
      chartType={chartType}
      onChartTypeChange={setChartType}
      isFullscreen
      onToggleFullscreen={() => setIsChartFullscreen(false)}
      allowDoubleClick={false}
      timeSeriesData={timeSeriesData}
      timeSeriesPreClose={timeSeriesPreClose}
      timeSeriesTradeDate={timeSeriesTradeDate}
      stockName={stockData.name}
      stockCode={stockData.ts_code}
      kLineData={kLineData}
      kLinePeriod={kLinePeriod}
      onKLinePeriodChange={setKLinePeriod}
      realtimeQuote={realtimeQuote}
      fallbackPreClose={timeSeriesPreClose || preClose}
      themeKey={watchThemeEnabled ? watchTheme.theme : undefined}
      watchThemeEnabled={watchThemeEnabled}
    />
  );

  return (
    <div className={cn('space-y-4', watchThemeEnabled && 'watch-theme-shell', watchThemeClassName)}>
      {/* 返回按钮 */}
      <Button variant="outline" onClick={onBack} className={cn('gap-2', watchThemeEnabled && 'watch-theme-control')}>
        <ArrowLeft className="w-4 h-4" />
        返回列表
      </Button>

      {/* 股票头部信息 */}
      <Card className={cn('p-4', watchThemeEnabled && 'watch-theme-card')}>
        {watchThemeEnabled && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="watch-theme-chip border-transparent">{watchTheme.currentTheme.name}</Badge>
              <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{watchTheme.currentTheme.tagline}</span>
              <span className="text-xs text-muted-foreground">当前主题仅作用于本盯盘页</span>
            </div>
            <WatchThemeSwitcher
              theme={watchTheme.theme}
              themes={watchTheme.themes}
              onThemeChange={watchTheme.setTheme}
              onRandomize={watchTheme.randomizeTheme}
              isMobile={isMobile}
            />
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{stockData.name}</h2>
                <span className="text-sm text-muted-foreground">{stockData.ts_code}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn('text-xs px-2 py-0.5 rounded text-muted-foreground', watchThemeEnabled ? 'watch-theme-chip' : 'bg-border')}>
                  {stockData.industry}
                </span>
                <span className={cn('text-xs px-2 py-0.5 rounded text-muted-foreground', watchThemeEnabled ? 'watch-theme-chip' : 'bg-border')}>
                  {stockData.market}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <WatchlistToggleButton
                tsCode={stockData.ts_code}
                stockName={stockData.name}
                market={stockData.market}
                size="icon"
                variant="ghost"
                className={cn('text-muted-foreground hover:text-yellow-400', watchThemeEnabled && 'watch-theme-control')}
              />
              <Button variant="ghost" size="icon" className={cn('text-muted-foreground hover:text-muted-foreground', watchThemeEnabled && 'watch-theme-control')}>
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className={cn('text-muted-foreground hover:text-muted-foreground', watchThemeEnabled && 'watch-theme-control')}>
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={cn('text-3xl font-bold font-mono', getChangeColor(displayedChange))}>
              {formatNumber(displayedPrice)}
            </div>
            <div className="flex flex-col">
              <span className={cn('text-sm font-mono', getChangeColor(displayedChange))}>
                {displayedChange > 0 ? '+' : ''}{formatNumber(displayedChange)}
              </span>
              <span className={cn('text-sm font-mono', getChangeColor(displayedChange))}>
                {displayedPctChg > 0 ? '+' : ''}{displayedPctChg.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* 关键数据 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mt-4 pt-4 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground">今开</div>
            <div className={cn('text-sm font-mono', getChangeColor(displayedOpen - displayedPreClose))}>
              {formatNumber(displayedOpen)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">最高</div>
            <div className="text-sm font-mono text-stock-up">{formatNumber(displayedHigh)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">最低</div>
            <div className="text-sm font-mono text-stock-down">{formatNumber(displayedLow)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">昨收</div>
            <div className="text-sm font-mono text-foreground">{formatNumber(displayedPreClose)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">成交量</div>
            <div className="text-sm font-mono text-foreground">{formatVolumeHand(displayedVolume)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">成交额</div>
            <div className="text-sm font-mono text-foreground">{formatLargeNumber(displayedAmount, 'qian')}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">换手率</div>
            <div className="text-sm font-mono text-foreground">{stockData.turnover_rate?.toFixed(2) || '-'}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">市盈率</div>
            <div className="text-sm font-mono text-foreground">{stockData.pe_ttm?.toFixed(2) || '-'}</div>
          </div>
        </div>
      </Card>

      {/* 主要内容区 */}
      {chartWorkspace}

      {/* Tab内容 */}
      <Tabs defaultValue="fundamental" className="w-full">
        <TabsList className={primaryTabsListClassName}>
          <TabsTrigger value="fundamental" className={tabTriggerClassName}>
            <FileText className="w-4 h-4 mr-1" />
            基本面
          </TabsTrigger>
          <TabsTrigger value="financial" className={tabTriggerClassName}>
            <BarChart3 className="w-4 h-4 mr-1" />
            市值股本
          </TabsTrigger>
          <TabsTrigger value="capital" className={tabTriggerClassName}>
            <TrendingUp className="w-4 h-4 mr-1" />
            资金流向
          </TabsTrigger>
          <TabsTrigger value="news" className={tabTriggerClassName}>
            <Newspaper className="w-4 h-4 mr-1" />
            公司信息
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fundamental" className="mt-4">
          <Card className={cn('p-4', watchThemeEnabled && 'watch-theme-card')}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">总市值</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.total_mv || 0, 'wan')}</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">流通市值</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.circ_mv || 0, 'wan')}</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">市盈率(TTM)</div>
                <div className="text-lg font-mono text-foreground">{stockData.pe_ttm?.toFixed(2) || '-'}</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">市净率</div>
                <div className="text-lg font-mono text-foreground">{stockData.pb?.toFixed(2) || '-'}</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">市销率(TTM)</div>
                <div className="text-lg font-mono text-foreground">{stockData.ps_ttm?.toFixed(2) || '-'}</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">股息率</div>
                <div className="text-lg font-mono text-foreground">{stockData.dv_ratio?.toFixed(2) || '-'}%</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">股息率(TTM)</div>
                <div className="text-lg font-mono text-foreground">{stockData.dv_ttm?.toFixed(2) || '-'}%</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">量比</div>
                <div className="text-lg font-mono text-foreground">{stockData.volume_ratio?.toFixed(2) || '-'}</div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          <Card className={cn('p-4', watchThemeEnabled && 'watch-theme-card')}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">总股本</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.total_share || 0, 'wan')}股</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">流通股本</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.float_share || 0, 'wan')}股</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">自由流通股</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.free_share || 0, 'wan')}股</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">换手率</div>
                <div className="text-lg font-mono text-foreground">{stockData.turnover_rate?.toFixed(2) || '-'}%</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">换手率(自由流通)</div>
                <div className="text-lg font-mono text-foreground">{stockData.turnover_rate_f?.toFixed(2) || '-'}%</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">总市值</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.total_mv || 0, 'wan')}</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">流通市值</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.circ_mv || 0, 'wan')}</div>
              </div>
              <div className={statCardClassName}>
                <div className="text-xs text-muted-foreground">数据日期</div>
                <div className="text-lg font-mono text-foreground">{stockData.trade_date || '-'}</div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="capital" className="mt-4">
          <Card className={cn('p-4', watchThemeEnabled && 'watch-theme-card')}>
            <h3 className="text-lg font-semibold text-foreground mb-4">近5日资金流向</h3>
            {moneyFlowData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">日期</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">主力净流入</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">特大单</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">大单</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">中单</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">小单</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moneyFlowData.map((flow) => (
                      <tr key={flow.trade_date} className={cn('border-b border-border hover:bg-muted', watchThemeEnabled && 'watch-theme-table-row hover:bg-transparent')}>
                        <td className="py-2 px-3 text-foreground">{flow.trade_date}</td>
                        <td className={cn(
                          'py-2 px-3 text-right font-mono',
                          getChangeColor(flow.net_main_amount || 0)
                        )}>
                          {((flow.net_main_amount || 0) / 10000).toFixed(2)}万
                        </td>
                        <td className={cn(
                          'py-2 px-3 text-right font-mono',
                          getChangeColor(flow.net_elg_amount || 0)
                        )}>
                          {((flow.net_elg_amount || 0) / 10000).toFixed(2)}万
                        </td>
                        <td className={cn(
                          'py-2 px-3 text-right font-mono',
                          getChangeColor(flow.net_lg_amount || 0)
                        )}>
                          {((flow.net_lg_amount || 0) / 10000).toFixed(2)}万
                        </td>
                        <td className={cn(
                          'py-2 px-3 text-right font-mono',
                          getChangeColor(flow.net_md_amount || 0)
                        )}>
                          {((flow.net_md_amount || 0) / 10000).toFixed(2)}万
                        </td>
                        <td className={cn(
                          'py-2 px-3 text-right font-mono',
                          getChangeColor(flow.net_sm_amount || 0)
                        )}>
                          {((flow.net_sm_amount || 0) / 10000).toFixed(2)}万
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                暂无资金流向数据
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="news" className="mt-4">
          <div className="space-y-4">
            <Card className={cn('p-4', watchThemeEnabled && 'watch-theme-card')}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">所属行业</div>
                  <div className="text-lg font-medium text-foreground">{stockData.industry || '-'}</div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">所属地区</div>
                  <div className="text-lg font-medium text-foreground">{stockData.area || '-'}</div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">上市板块</div>
                  <div className="text-lg font-medium text-foreground">{stockData.market || '-'}</div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">上市日期</div>
                  <div className="text-lg font-mono text-foreground">{stockData.list_date || '-'}</div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">股票代码</div>
                  <div className="text-lg font-mono text-foreground">{stockData.ts_code}</div>
                </div>
                <div className={statCardClassName}>
                  <div className="text-xs text-muted-foreground">证券代码</div>
                  <div className="text-lg font-mono text-foreground">{stockData.symbol}</div>
                </div>
              </div>
            </Card>

            <Card className={cn('p-4', watchThemeEnabled && 'watch-theme-card')}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">公告 {announcementTotal}</Badge>
                  <Badge variant="outline">研报 {reportTotal}</Badge>
                  <Badge variant="outline">日历 {calendarTotal}</Badge>
                  <span className="text-xs text-muted-foreground">展示最近关联内容，点击卡片可查看详情</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => onOpenNews?.('announcement', stockCode)}>
                  去资讯中心查看
                </Button>
              </div>

              <Tabs defaultValue="announcements" className="w-full">
                <TabsList className={nestedTabsListClassName}>
                  <TabsTrigger value="announcements" className={tabTriggerClassName}>
                    公告
                  </TabsTrigger>
                  <TabsTrigger value="reports" className={tabTriggerClassName}>
                    研报
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className={tabTriggerClassName}>
                    日历
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="announcements" className="mt-4">
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => onOpenNews?.('announcement', stockCode)}>
                        在资讯中心查看更多公告
                      </Button>
                    </div>
                    {announcementLoading ? (
                      <RelatedContentSkeleton />
                    ) : announcements.length === 0 ? (
                      <EmptyRelatedContent text="最近没有公告数据" />
                    ) : (
                      announcements.map((item) => (
                        <button
                          type="button"
                          key={item.ann_id}
                          className={interactiveCardClassName}
                          onClick={() => setSelectedAnnouncementId(item.ann_id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Building2 className={cn('w-4 h-4 text-blue-600', watchThemeEnabled && 'text-[hsl(var(--watch-accent))]')} />
                              <Badge variant="outline">{item.ann_type}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{item.ann_date}</span>
                          </div>
                          <div className="text-sm text-foreground leading-6">{item.title}</div>
                          {item.summary && <div className="text-xs text-muted-foreground line-clamp-2">{item.summary}</div>}
                        </button>
                      ))
                    )}
                    {(canExpandAnnouncements || canCollapseAnnouncements) && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {canCollapseAnnouncements && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAnnouncementPageSize(INITIAL_RELATED_PAGE_SIZE)}
                          >
                            收起
                          </Button>
                        )}
                        {canExpandAnnouncements && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAnnouncementPageSize((current) => current + RELATED_PAGE_INCREMENT)}
                          >
                            查看更多
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="reports" className="mt-4">
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => onOpenNews?.('report', stockCode)}>
                        在资讯中心查看更多研报
                      </Button>
                    </div>
                    {reportLoading ? (
                      <RelatedContentSkeleton />
                    ) : reports.length === 0 ? (
                      <EmptyRelatedContent text="最近没有研报数据" />
                    ) : (
                      reports.map((item) => (
                        <button
                          type="button"
                          key={item.report_id}
                          className={interactiveCardClassName}
                          onClick={() => setSelectedReportId(item.report_id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileText className={cn('w-4 h-4 text-purple-600', watchThemeEnabled && 'text-[hsl(var(--watch-accent-secondary))]')} />
                              <Badge variant="outline">{item.rating || '未评级'}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{item.report_date}</span>
                          </div>
                          <div className="text-sm text-foreground leading-6">{item.title}</div>
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>{item.org_name || '--'}</span>
                            <span>{typeof item.target_price === 'number' ? `目标价 ${item.target_price}` : '无目标价'}</span>
                          </div>
                        </button>
                      ))
                    )}
                    {(canExpandReports || canCollapseReports) && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {canCollapseReports && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReportPageSize(INITIAL_RELATED_PAGE_SIZE)}
                          >
                            收起
                          </Button>
                        )}
                        {canExpandReports && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReportPageSize((current) => current + RELATED_PAGE_INCREMENT)}
                          >
                            查看更多
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="calendar" className="mt-4">
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => onOpenNews?.('calendar', stockCode)}>
                        在资讯中心查看更多日历
                      </Button>
                    </div>
                    {calendarLoading ? (
                      <RelatedContentSkeleton />
                    ) : calendarEvents.length === 0 ? (
                      <EmptyRelatedContent text="最近没有日历事件" />
                    ) : (
                      calendarEvents.map((item) => (
                        <button
                          type="button"
                          key={item.event_id}
                          className={interactiveCardClassName}
                          onClick={() => setSelectedEventId(item.event_id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <CalendarDays className={cn('w-4 h-4 text-green-600', watchThemeEnabled && 'text-[hsl(var(--watch-accent-tertiary))]')} />
                              <Badge variant="outline">{item.event_type}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{item.event_date}</span>
                          </div>
                          <div className="text-sm text-foreground leading-6">{item.event_name}</div>
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>{item.event_time || '全天'}</span>
                            <span>{getEventStatusLabel(item.status)}</span>
                          </div>
                        </button>
                      ))
                    )}
                    {(canExpandCalendar || canCollapseCalendar) && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {canCollapseCalendar && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCalendarPageSize(INITIAL_RELATED_PAGE_SIZE)}
                          >
                            收起
                          </Button>
                        )}
                        {canExpandCalendar && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCalendarPageSize((current) => current + RELATED_PAGE_INCREMENT)}
                          >
                            查看更多
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <RelatedAnnouncementSheet
        open={Boolean(selectedAnnouncementId)}
        onOpenChange={(open) => !open && setSelectedAnnouncementId(null)}
        detail={selectedAnnouncementDetail}
        loading={announcementDetailLoading}
      />
      <RelatedReportSheet
        open={Boolean(selectedReportId)}
        onOpenChange={(open) => !open && setSelectedReportId(null)}
        detail={selectedReportDetail}
        loading={reportDetailLoading}
      />
      <RelatedEventSheet
        open={Boolean(selectedEventId)}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
        detail={selectedEventDetail}
        loading={eventDetailLoading}
      />
      <StockChartFullscreenDialog
        open={isChartFullscreen}
        onOpenChange={setIsChartFullscreen}
        workspace={fullscreenWorkspace}
        themeClassName={watchThemeClassName}
        watchThemeEnabled={watchThemeEnabled}
      />
    </div>
  );
}

function RelatedAnnouncementSheet({
  open,
  onOpenChange,
  detail,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: AnnouncementDetail | null | undefined;
  loading: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{detail?.title || '公告详情'}</SheetTitle>
          <SheetDescription>
            {detail ? `${detail.stock_name} ${detail.ts_code} · ${detail.ann_date}` : '正在加载公告详情'}
          </SheetDescription>
        </SheetHeader>
        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detail ? (
          <div className="px-4 pb-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{detail.ann_type}</Badge>
              {detail.file_url && <Badge variant="outline">附件</Badge>}
            </div>
            {detail.summary && <p className="text-sm text-muted-foreground leading-6">{detail.summary}</p>}
            <div className="rounded-lg bg-muted/40 p-4 text-sm text-foreground leading-7 whitespace-pre-wrap">
              {detail.content || '当前仅同步到公告摘要。'}
            </div>
            {detail.file_url && (
              <div className="flex justify-end">
                <Button asChild>
                  <a href={detail.file_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />查看附件
                  </a>
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RelatedReportSheet({
  open,
  onOpenChange,
  detail,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ResearchReportDetail | null | undefined;
  loading: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{detail?.title || '研报详情'}</SheetTitle>
          <SheetDescription>
            {detail ? `${detail.org_name || '--'} · ${detail.report_date}` : '正在加载研报详情'}
          </SheetDescription>
        </SheetHeader>
        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detail ? (
          <div className="px-4 pb-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {detail.rating && <Badge variant="outline">{detail.rating}</Badge>}
              {detail.rating_change && <Badge variant="outline">{detail.rating_change}</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/40 p-3">目标价：{detail.target_price ?? '--'}</div>
              <div className="rounded-lg bg-muted/40 p-3">预测 PE：{detail.pe_forecast ?? '--'}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-4 text-sm text-foreground leading-7 whitespace-pre-wrap">
              {detail.summary || '当前仅同步到研报摘要。'}
            </div>
            {detail.file_url && (
              <div className="flex justify-end">
                <Button asChild>
                  <a href={detail.file_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />查看原文
                  </a>
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RelatedEventSheet({
  open,
  onOpenChange,
  detail,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: FinanceCalendarEvent | null | undefined;
  loading: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{detail?.event_name || '事件详情'}</SheetTitle>
          <SheetDescription>
            {detail ? `${detail.event_date} ${detail.event_time || '全天'} · ${detail.event_type}` : '正在加载事件详情'}
          </SheetDescription>
        </SheetHeader>
        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detail ? (
          <div className="px-4 pb-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{detail.event_type}</Badge>
              <Badge variant="outline">{getEventStatusLabel(detail.status)}</Badge>
            </div>
            <div className="rounded-lg bg-muted/40 p-4 text-sm text-foreground leading-7 whitespace-pre-wrap">
              {detail.event_desc || '当前仅同步到事件摘要。'}
            </div>
            {detail.extra_data && Object.keys(detail.extra_data).length > 0 && (
              <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground overflow-x-auto">
                <pre>{JSON.stringify(detail.extra_data, null, 2)}</pre>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// 主组件：股票列表 + 详情切换
export function StockDetail({
  initialStockCode,
  onBack,
  onOpenNews,
}: {
  initialStockCode?: string | null;
  onBack?: () => void;
  onOpenNews?: (tab: 'announcement' | 'report' | 'calendar', stockCode?: string | null) => void;
}) {
  const [selectedStock, setSelectedStock] = useState<string | null>(initialStockCode ?? null);

  // 当外部传入的 initialStockCode 变化时同步更新
  useEffect(() => {
    if (initialStockCode) {
      setSelectedStock(initialStockCode);
    }
  }, [initialStockCode]);

  // 如果选中了股票，显示详情页
  if (selectedStock) {
    return (
      <StockDetailView
        stockCode={selectedStock}
        onBack={() => {
          if (onBack) {
            onBack();
            return;
          }
          setSelectedStock(null);
        }}
        onOpenNews={onOpenNews}
      />
    );
  }

  // 默认显示股票列表
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">全部股票行情</h2>
        <div className="text-sm text-muted-foreground">
          点击任意股票查看详情
        </div>
      </div>
      <StockListTable onSelectStock={setSelectedStock} />
    </div>
  );
}
