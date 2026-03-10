import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, FileText, Search } from 'lucide-react';
import { fetchAnnouncementDetail, fetchAnnouncements } from '@/services/newsService';
import type { AnnouncementDateRange, ContentImportance } from '@/types';

interface AnnouncementPanelProps {
  onSelectStock?: (tsCode: string) => void;
  initialStockCode?: string | null;
}

const ANNOUNCEMENT_TYPES = ['all', '定期报告', '重大事项', '融资公告', '增减持', '回购', '业绩预告'];

function getImportanceBadge(importance: ContentImportance) {
  switch (importance) {
    case 'urgent':
      return 'bg-red-100 text-red-700';
    case 'high':
      return 'bg-orange-100 text-orange-700';
    case 'low':
      return 'bg-slate-100 text-slate-600';
    case 'normal':
    default:
      return 'bg-blue-100 text-blue-700';
  }
}

function getAnnouncementTypeColor(type: string) {
  switch (type) {
    case '业绩预告':
      return 'bg-green-100 text-green-700';
    case '定期报告':
      return 'bg-blue-100 text-blue-700';
    case '重大事项':
      return 'bg-red-100 text-red-700';
    case '增减持':
      return 'bg-yellow-100 text-yellow-700';
    case '回购':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function AnnouncementPanel({ onSelectStock, initialStockCode }: AnnouncementPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [stockCodeFilter, setStockCodeFilter] = useState(initialStockCode || '');
  const [annType, setAnnType] = useState('all');
  const [importance, setImportance] = useState<'all' | ContentImportance>('all');
  const [attachment, setAttachment] = useState<'all' | 'yes' | 'no'>('all');
  const [dateRange, setDateRange] = useState<AnnouncementDateRange>('30d');
  const [pageSize, setPageSize] = useState(20);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    ['news:announcements', keyword, stockCodeFilter, annType, importance, attachment, dateRange, pageSize],
    () => fetchAnnouncements({
      keyword,
      stockCode: stockCodeFilter || undefined,
      annType,
      importance,
      hasAttachment: attachment === 'all' ? undefined : attachment === 'yes',
      dateRange,
      page: 1,
      pageSize,
    }),
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  useEffect(() => {
    setStockCodeFilter(initialStockCode || '');
    setPageSize(20);
    setSelectedAnnId(null);
  }, [initialStockCode]);

  const { data: detail } = useSWR(
    selectedAnnId ? ['news:announcement-detail', selectedAnnId] : null,
    () => fetchAnnouncementDetail(selectedAnnId as string),
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
    }
  );

  const announcements = data?.items || [];

  return (
    <>
      <Card className="p-4 bg-background border-border">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-foreground">公司公告</h3>
            <span className="text-xs text-muted-foreground">真实数据接入中，已支持筛选与详情</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="relative xl:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索公告标题、股票名称"
                className="pl-9"
              />
            </div>
            <Select value={annType} onValueChange={setAnnType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="公告类型" />
              </SelectTrigger>
              <SelectContent>
                {ANNOUNCEMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'all' ? '全部类型' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={importance} onValueChange={(value) => setImportance(value as 'all' | ContentImportance)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="重要度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部重要度</SelectItem>
                <SelectItem value="urgent">紧急</SelectItem>
                <SelectItem value="high">重要</SelectItem>
                <SelectItem value="normal">普通</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Select value={attachment} onValueChange={(value) => setAttachment(value as 'all' | 'yes' | 'no')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="附件" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部附件</SelectItem>
                  <SelectItem value="yes">仅有附件</SelectItem>
                  <SelectItem value="no">仅无附件</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as AnnouncementDateRange)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="时间范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">近7天</SelectItem>
                  <SelectItem value="30d">近30天</SelectItem>
                  <SelectItem value="90d">近90天</SelectItem>
                  <SelectItem value="all">全部</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {stockCodeFilter && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Badge variant="outline">股票 {stockCodeFilter}</Badge>
              <span>当前只展示该股票相关公告</span>
              <Button variant="ghost" size="sm" onClick={() => setStockCodeFilter('')}>清除筛选</Button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{data ? `共 ${data.total} 条，当前展示 ${announcements.length} 条` : '正在获取公告列表'}</span>
            <Button variant="ghost" size="sm" onClick={() => mutate()}>
              刷新
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          ) : error ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2 className="size-5" />
                </EmptyMedia>
                <EmptyTitle>公告加载失败</EmptyTitle>
                <EmptyDescription>当前无法获取公司公告数据，请检查数据表或稍后重试。</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => mutate()}>重新加载</Button>
              </EmptyContent>
            </Empty>
          ) : announcements.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2 className="size-5" />
                </EmptyMedia>
                <EmptyTitle>暂无匹配公告</EmptyTitle>
                <EmptyDescription>可以放宽时间范围，或者减少筛选条件。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ScrollArea className="h-[460px] pr-2">
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <button
                    type="button"
                    key={announcement.ann_id}
                    className="w-full text-left rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedAnnId(announcement.ann_id)}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={getAnnouncementTypeColor(announcement.ann_type)}>{announcement.ann_type}</Badge>
                          <Badge className={getImportanceBadge(announcement.importance)}>{announcement.importance}</Badge>
                          {announcement.file_url && <Badge variant="outline">PDF</Badge>}
                        </div>
                        <div className="font-medium text-foreground leading-6">{announcement.title}</div>
                        {announcement.summary && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{announcement.summary}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <button
                            type="button"
                            className="rounded-md bg-blue-50 px-2 py-1 text-blue-700 hover:bg-blue-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectStock?.(announcement.ts_code);
                            }}
                          >
                            {announcement.stock_name} {announcement.ts_code}
                          </button>
                          {announcement.source && <span>{announcement.source}</span>}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{announcement.ann_date}</div>
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

      <Sheet open={Boolean(selectedAnnId)} onOpenChange={(open) => !open && setSelectedAnnId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail?.title || '公告详情'}</SheetTitle>
            <SheetDescription>
              {detail ? `${detail.stock_name} ${detail.ts_code} · ${detail.ann_date}` : '正在加载公告详情'}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="px-4 pb-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={getAnnouncementTypeColor(detail.ann_type)}>{detail.ann_type}</Badge>
                <Badge className={getImportanceBadge(detail.importance)}>{detail.importance}</Badge>
                {detail.file_url && <Badge variant="outline">附件可下载</Badge>}
              </div>
              {detail.summary && <p className="text-sm text-muted-foreground leading-6">{detail.summary}</p>}
              <div className="rounded-lg bg-muted/40 p-4 text-sm text-foreground leading-7 whitespace-pre-wrap">
                {detail.content || '当前仅同步到公告摘要，完整正文可通过原始 PDF 查看。'}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => onSelectStock?.(detail.ts_code)}>
                  查看个股详情
                </Button>
                {detail.file_url && (
                  <Button asChild>
                    <a href={detail.file_url} target="_blank" rel="noreferrer">
                      <FileText className="w-4 h-4 mr-2" />查看附件
                    </a>
                  </Button>
                )}
              </div>
              {detail.related_anns && detail.related_anns.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">相关公告</div>
                  <div className="flex flex-wrap gap-2">
                    {detail.related_anns.map((relatedId) => (
                      <Badge
                        key={relatedId}
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => setSelectedAnnId(relatedId)}
                      >
                        {relatedId}
                      </Badge>
                    ))}
                  </div>
                </div>
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