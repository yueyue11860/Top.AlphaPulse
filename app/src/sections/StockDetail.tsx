import { Suspense, lazy, useState, useEffect } from 'react';
import useSWR from 'swr';
import { StockListTable } from '@/components/stock/StockListTable';
import { cn, formatNumber, getChangeColor, formatLargeNumber, formatVolumeHand } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Star,
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
} from 'lucide-react';
import { fetchStockDetailBundle } from '@/services/stockDetailService';
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
  time: string;
  price: number;
  volume: number;
  avg_price: number;
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
  const [chartType, setChartType] = useState<'timeseries' | 'kline'>('timeseries');
  const [isFavorited, setIsFavorited] = useState(false);
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
  }, [stockCode]);

  const { data, isLoading } = useSWR(
    ['stock:detail:bundle', stockCode],
    () => fetchStockDetailBundle(stockCode),
    {
      dedupingInterval: 15_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const loading = isLoading && !data;
  const stockData = (data?.detail || null) as StockDetailData | null;
  const kLineData = (data?.kLineData || []) as KLineItem[];
  const timeSeriesData = (data?.timeSeriesData || []) as TimeSeriesItem[];
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

  const { change, pct_chg, close: currentPrice, pre_close: preClose } = stockData;

  return (
    <div className="space-y-4">
      {/* 返回按钮 */}
      <Button variant="outline" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        返回列表
      </Button>

      {/* 股票头部信息 */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{stockData.name}</h2>
                <span className="text-sm text-muted-foreground">{stockData.ts_code}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded bg-border text-muted-foreground">{stockData.industry}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-border text-muted-foreground">{stockData.market}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-yellow-400"
                onClick={() => setIsFavorited(!isFavorited)}
              >
                <Star className={cn('w-5 h-5', isFavorited && 'fill-yellow-400 text-yellow-400')} />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-muted-foreground">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-muted-foreground">
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={cn('text-3xl font-bold font-mono', getChangeColor(change))}>
              {formatNumber(currentPrice)}
            </div>
            <div className="flex flex-col">
              <span className={cn('text-sm font-mono', getChangeColor(change))}>
                {change > 0 ? '+' : ''}{formatNumber(change)}
              </span>
              <span className={cn('text-sm font-mono', getChangeColor(change))}>
                {pct_chg > 0 ? '+' : ''}{pct_chg.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* 关键数据 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mt-4 pt-4 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground">今开</div>
            <div className={cn('text-sm font-mono', getChangeColor(stockData.open - preClose))}>
              {formatNumber(stockData.open)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">最高</div>
            <div className="text-sm font-mono text-red-500">{formatNumber(stockData.high)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">最低</div>
            <div className="text-sm font-mono text-green-500">{formatNumber(stockData.low)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">昨收</div>
            <div className="text-sm font-mono text-foreground">{formatNumber(preClose)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">成交量</div>
            <div className="text-sm font-mono text-foreground">{formatVolumeHand(stockData.vol)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">成交额</div>
            <div className="text-sm font-mono text-foreground">{formatLargeNumber(stockData.amount, 'qian')}</div>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 图表区域 */}
        <Card className="p-4 lg:col-span-2">
          {/* 图表类型切换 */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant={chartType === 'timeseries' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setChartType('timeseries')}
            >
              分时
            </Button>
            <Button
              variant={chartType === 'kline' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setChartType('kline')}
            >
              日K
            </Button>
          </div>

          {/* 图表内容 */}
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            {chartType === 'timeseries' ? (
              <TimeSeriesChart
                data={timeSeriesData}
                preClose={stockData.pre_close || 0}
                className="h-96"
                stockName={stockData.name}
                stockCode={stockData.ts_code}
                tradeDate={stockData.trade_date}
              />
            ) : (
              kLineData.length > 0 ? (
                <KLineChart data={kLineData} className="h-96" />
              ) : (
                <div className="h-96 flex items-center justify-center text-muted-foreground">
                  暂无K线数据
                </div>
              )
            )}
          </Suspense>
        </Card>

        {/* 右侧信息 */}
        <div className="space-y-4">
          {/* 行情概览 */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-foreground mb-3">行情概览</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">量比</span>
                <span className="font-mono text-foreground">{stockData.volume_ratio?.toFixed(2) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">换手率(自由流通)</span>
                <span className="font-mono text-foreground">{stockData.turnover_rate_f?.toFixed(2) || '-'}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">市盈率(静态)</span>
                <span className="font-mono text-foreground">{stockData.pe?.toFixed(2) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">市盈率(TTM)</span>
                <span className="font-mono text-foreground">{stockData.pe_ttm?.toFixed(2) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">市净率</span>
                <span className="font-mono text-foreground">{stockData.pb?.toFixed(2) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">股息率</span>
                <span className="font-mono text-foreground">{stockData.dv_ttm?.toFixed(2) || '-'}%</span>
              </div>
            </div>
          </Card>

          {/* 资金流向 */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-foreground mb-3">今日资金流向</h3>
            {moneyFlowData.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">主力净流入</span>
                  <span className={cn(
                    'font-mono font-medium',
                    (moneyFlowData[0].net_main_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                  )}>
                    {(moneyFlowData[0].net_main_amount || 0) > 0 ? '+' : ''}
                    {((moneyFlowData[0].net_main_amount || 0) / 10000).toFixed(2)}万
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">特大单净流入</span>
                  <span className={cn(
                    'font-mono',
                    (moneyFlowData[0].net_elg_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                  )}>
                    {(moneyFlowData[0].net_elg_amount || 0) > 0 ? '+' : ''}
                    {((moneyFlowData[0].net_elg_amount || 0) / 10000).toFixed(2)}万
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">大单净流入</span>
                  <span className={cn(
                    'font-mono',
                    (moneyFlowData[0].net_lg_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                  )}>
                    {(moneyFlowData[0].net_lg_amount || 0) > 0 ? '+' : ''}
                    {((moneyFlowData[0].net_lg_amount || 0) / 10000).toFixed(2)}万
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">中单净流入</span>
                  <span className={cn(
                    'font-mono',
                    (moneyFlowData[0].net_md_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                  )}>
                    {(moneyFlowData[0].net_md_amount || 0) > 0 ? '+' : ''}
                    {((moneyFlowData[0].net_md_amount || 0) / 10000).toFixed(2)}万
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">小单净流入</span>
                  <span className={cn(
                    'font-mono',
                    (moneyFlowData[0].net_sm_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                  )}>
                    {(moneyFlowData[0].net_sm_amount || 0) > 0 ? '+' : ''}
                    {((moneyFlowData[0].net_sm_amount || 0) / 10000).toFixed(2)}万
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">暂无资金流向数据</div>
            )}
          </Card>
        </div>
      </div>

      {/* Tab内容 */}
      <Tabs defaultValue="fundamental" className="w-full">
        <TabsList className="w-full justify-start bg-muted">
          <TabsTrigger value="fundamental" className="data-[state=active]:bg-white">
            <FileText className="w-4 h-4 mr-1" />
            基本面
          </TabsTrigger>
          <TabsTrigger value="financial" className="data-[state=active]:bg-white">
            <BarChart3 className="w-4 h-4 mr-1" />
            市值股本
          </TabsTrigger>
          <TabsTrigger value="capital" className="data-[state=active]:bg-white">
            <TrendingUp className="w-4 h-4 mr-1" />
            资金流向
          </TabsTrigger>
          <TabsTrigger value="news" className="data-[state=active]:bg-white">
            <Newspaper className="w-4 h-4 mr-1" />
            公司信息
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fundamental" className="mt-4">
          <Card className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">总市值</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.total_mv || 0, 'wan')}</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">流通市值</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.circ_mv || 0, 'wan')}</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">市盈率(TTM)</div>
                <div className="text-lg font-mono text-foreground">{stockData.pe_ttm?.toFixed(2) || '-'}</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">市净率</div>
                <div className="text-lg font-mono text-foreground">{stockData.pb?.toFixed(2) || '-'}</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">市销率(TTM)</div>
                <div className="text-lg font-mono text-foreground">{stockData.ps_ttm?.toFixed(2) || '-'}</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">股息率</div>
                <div className="text-lg font-mono text-foreground">{stockData.dv_ratio?.toFixed(2) || '-'}%</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">股息率(TTM)</div>
                <div className="text-lg font-mono text-foreground">{stockData.dv_ttm?.toFixed(2) || '-'}%</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">量比</div>
                <div className="text-lg font-mono text-foreground">{stockData.volume_ratio?.toFixed(2) || '-'}</div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          <Card className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">总股本</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.total_share || 0, 'wan')}股</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">流通股本</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.float_share || 0, 'wan')}股</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">自由流通股</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.free_share || 0, 'wan')}股</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">换手率</div>
                <div className="text-lg font-mono text-foreground">{stockData.turnover_rate?.toFixed(2) || '-'}%</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">换手率(自由流通)</div>
                <div className="text-lg font-mono text-foreground">{stockData.turnover_rate_f?.toFixed(2) || '-'}%</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">总市值</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.total_mv || 0, 'wan')}</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">流通市值</div>
                <div className="text-lg font-mono text-foreground">{formatLargeNumber(stockData.circ_mv || 0, 'wan')}</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">数据日期</div>
                <div className="text-lg font-mono text-foreground">{stockData.trade_date || '-'}</div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="capital" className="mt-4">
          <Card className="p-4">
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
                      <tr key={flow.trade_date} className="border-b border-border hover:bg-muted">
                        <td className="py-2 px-3 text-foreground">{flow.trade_date}</td>
                        <td className={cn(
                          'py-2 px-3 text-right font-mono',
                          (flow.net_main_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                        )}>
                          {((flow.net_main_amount || 0) / 10000).toFixed(2)}万
                        </td>
                        <td className={cn(
                          'py-2 px-3 text-right font-mono',
                          (flow.net_elg_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                        )}>
                          {((flow.net_elg_amount || 0) / 10000).toFixed(2)}万
                        </td>
                        <td className={cn(
                          'py-2 px-3 text-right font-mono',
                          (flow.net_lg_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                        )}>
                          {((flow.net_lg_amount || 0) / 10000).toFixed(2)}万
                        </td>
                        <td className={cn(
                          'py-2 px-3 text-right font-mono',
                          (flow.net_md_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'
                        )}>
                          {((flow.net_md_amount || 0) / 10000).toFixed(2)}万
                        </td>
                        <td className={cn(
                          'py-2 px-3 text-right font-mono',
                          (flow.net_sm_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'
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
            <Card className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">所属行业</div>
                  <div className="text-lg font-medium text-foreground">{stockData.industry || '-'}</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">所属地区</div>
                  <div className="text-lg font-medium text-foreground">{stockData.area || '-'}</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">上市板块</div>
                  <div className="text-lg font-medium text-foreground">{stockData.market || '-'}</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">上市日期</div>
                  <div className="text-lg font-mono text-foreground">{stockData.list_date || '-'}</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">股票代码</div>
                  <div className="text-lg font-mono text-foreground">{stockData.ts_code}</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">证券代码</div>
                  <div className="text-lg font-mono text-foreground">{stockData.symbol}</div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
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
                <TabsList className="w-full justify-start bg-muted overflow-x-auto">
                  <TabsTrigger value="announcements" className="data-[state=active]:bg-white">
                    公告
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="data-[state=active]:bg-white">
                    研报
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="data-[state=active]:bg-white">
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
                          className="w-full rounded-lg border border-border p-3 space-y-2 text-left hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedAnnouncementId(item.ann_id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-blue-600" />
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
                          className="w-full rounded-lg border border-border p-3 space-y-2 text-left hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedReportId(item.report_id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-purple-600" />
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
                          className="w-full rounded-lg border border-border p-3 space-y-2 text-left hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedEventId(item.event_id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="w-4 h-4 text-green-600" />
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
  onOpenNews,
}: {
  initialStockCode?: string | null;
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
        onBack={() => setSelectedStock(null)}
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
