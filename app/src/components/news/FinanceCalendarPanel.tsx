import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarIcon, Clock3, Search } from 'lucide-react';
import { fetchFinanceCalendar, fetchFinanceCalendarDetail } from '@/services/newsService';
import type { CalendarDateRange, CalendarEventStatus, CalendarEventType, ContentImportance } from '@/types';

interface FinanceCalendarPanelProps {
  onSelectStock?: (tsCode: string) => void;
  initialStockCode?: string | null;
}

function getStatusLabel(status: CalendarEventStatus) {
  switch (status) {
    case 'ongoing':
      return '进行中';
    case 'done':
      return '已结束';
    case 'upcoming':
    default:
      return '未开始';
  }
}

function getStatusColor(status: CalendarEventStatus) {
  switch (status) {
    case 'ongoing':
      return 'bg-red-100 text-red-700';
    case 'done':
      return 'bg-slate-100 text-slate-600';
    case 'upcoming':
    default:
      return 'bg-blue-100 text-blue-700';
  }
}

function getImportanceColor(importance: ContentImportance) {
  switch (importance) {
    case 'urgent':
    case 'high':
      return 'bg-orange-100 text-orange-700';
    case 'low':
      return 'bg-slate-100 text-slate-600';
    case 'normal':
    default:
      return 'bg-green-100 text-green-700';
  }
}

export function FinanceCalendarPanel({ onSelectStock, initialStockCode }: FinanceCalendarPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [stockCodeFilter, setStockCodeFilter] = useState(initialStockCode || '');
  const [eventType, setEventType] = useState<'all' | CalendarEventType>('all');
  const [status, setStatus] = useState<'all' | CalendarEventStatus>('all');
  const [importance, setImportance] = useState<'all' | ContentImportance>('all');
  const [dateRange, setDateRange] = useState<CalendarDateRange>('7d');
  const [pageSize, setPageSize] = useState(20);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    ['news:calendar', keyword, stockCodeFilter, eventType, status, importance, dateRange, pageSize],
    () => fetchFinanceCalendar({
      keyword,
      stockCode: stockCodeFilter || undefined,
      eventType,
      status,
      importance,
      dateRange,
      page: 1,
      pageSize,
    }),
    {
      dedupingInterval: 180_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  useEffect(() => {
    setStockCodeFilter(initialStockCode || '');
    setPageSize(20);
    setSelectedEventId(null);
  }, [initialStockCode]);

  const { data: detail } = useSWR(
    selectedEventId ? ['news:calendar-detail', selectedEventId] : null,
    () => fetchFinanceCalendarDetail(selectedEventId as string),
    {
      dedupingInterval: 180_000,
      revalidateOnFocus: false,
    }
  );

  const events = data?.items || [];

  return (
    <>
      <Card className="p-4 bg-background border-border">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-foreground">财经日历</h3>
            <span className="text-xs text-muted-foreground">已支持事件类型、状态、时间范围和详情查看</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="relative xl:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索事件、股票、描述"
                className="pl-9"
              />
            </div>
            <Select value={eventType} onValueChange={(value) => setEventType(value as 'all' | CalendarEventType)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="事件类型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部事件</SelectItem>
                <SelectItem value="财报披露">财报披露</SelectItem>
                <SelectItem value="股东大会">股东大会</SelectItem>
                <SelectItem value="新股申购">新股申购</SelectItem>
                <SelectItem value="宏观数据">宏观数据</SelectItem>
                <SelectItem value="解禁预告">解禁预告</SelectItem>
                <SelectItem value="融资融券">融资融券</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => setStatus(value as 'all' | CalendarEventStatus)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="upcoming">未开始</SelectItem>
                <SelectItem value="ongoing">进行中</SelectItem>
                <SelectItem value="done">已结束</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Select value={importance} onValueChange={(value) => setImportance(value as 'all' | ContentImportance)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="重要度" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部重要度</SelectItem>
                  <SelectItem value="high">重要</SelectItem>
                  <SelectItem value="normal">普通</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as CalendarDateRange)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="时间范围" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">今天</SelectItem>
                  <SelectItem value="7d">近7天</SelectItem>
                  <SelectItem value="30d">近30天</SelectItem>
                  <SelectItem value="all">全部</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {stockCodeFilter && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Badge variant="outline">股票 {stockCodeFilter}</Badge>
              <span>当前只展示该股票相关日历事件</span>
              <Button variant="ghost" size="sm" onClick={() => setStockCodeFilter('')}>清除筛选</Button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{data ? `共 ${data.total} 个事件，当前展示 ${events.length} 个` : '正在获取财经日历'}</span>
            <Button variant="ghost" size="sm" onClick={() => mutate()}>刷新</Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarIcon className="size-5" /></EmptyMedia>
                <EmptyTitle>财经日历加载失败</EmptyTitle>
                <EmptyDescription>当前无法获取事件日历数据，请稍后重试。</EmptyDescription>
              </EmptyHeader>
              <Button onClick={() => mutate()}>重新加载</Button>
            </Empty>
          ) : events.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarIcon className="size-5" /></EmptyMedia>
                <EmptyTitle>暂无匹配事件</EmptyTitle>
                <EmptyDescription>可以扩大时间范围，查看更完整的事件日历。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ScrollArea className="h-[460px] pr-2">
              <div className="space-y-3">
                {events.map((event) => (
                  <button
                    type="button"
                    key={event.event_id}
                    className="w-full rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedEventId(event.event_id)}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{event.event_type}</Badge>
                          <Badge className={getStatusColor(event.status)}>{getStatusLabel(event.status)}</Badge>
                          <Badge className={getImportanceColor(event.importance)}>{event.importance}</Badge>
                        </div>
                        <div className="font-medium text-foreground leading-6">{event.event_name}</div>
                        {event.event_desc && <p className="text-sm text-muted-foreground line-clamp-2">{event.event_desc}</p>}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{event.event_date}</span>
                          {event.event_time && <span>{event.event_time}</span>}
                          {event.ts_code && (
                            <button
                              type="button"
                              className="rounded-md bg-green-50 px-2 py-1 text-green-700 hover:bg-green-100"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation();
                                onSelectStock?.(event.ts_code as string);
                              }}
                            >
                              {event.stock_name || event.ts_code} {event.ts_code}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                        <Clock3 className="w-3 h-3 mr-1" />
                        {event.event_time || '全天'}
                      </div>
                    </div>
                  </button>
                ))}

                {data?.hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" onClick={() => setPageSize((value) => value + 20)}>
                      加载更多
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </Card>

      <Sheet open={Boolean(selectedEventId)} onOpenChange={(open) => !open && setSelectedEventId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail?.event_name || '事件详情'}</SheetTitle>
            <SheetDescription>
              {detail ? `${detail.event_date} ${detail.event_time || '全天'} · ${detail.event_type}` : '正在加载事件详情'}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="px-4 pb-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{detail.event_type}</Badge>
                <Badge className={getStatusColor(detail.status)}>{getStatusLabel(detail.status)}</Badge>
                <Badge className={getImportanceColor(detail.importance)}>{detail.importance}</Badge>
              </div>
              <div className="rounded-lg bg-muted/40 p-4 text-sm text-foreground leading-7 whitespace-pre-wrap">
                {detail.event_desc || '当前仅同步到事件摘要。'}
              </div>
              {detail.extra_data && (
                <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground overflow-x-auto">
                  <pre>{JSON.stringify(detail.extra_data, null, 2)}</pre>
                </div>
              )}
              {detail.ts_code && (
                <Button variant="outline" onClick={() => onSelectStock?.(detail.ts_code as string)}>
                  查看个股详情
                </Button>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-10 w-32" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}