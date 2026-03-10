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
import { fetchResearchReportDetail, fetchResearchReports } from '@/services/newsService';
import type { ResearchDateRange, ResearchRating, ResearchReportType } from '@/types';
import { FileText, Search, TrendingUp } from 'lucide-react';

interface ResearchReportPanelProps {
  onSelectStock?: (tsCode: string) => void;
  initialStockCode?: string | null;
}

function getRatingColor(rating?: string | null) {
  switch (rating) {
    case '买入':
      return 'bg-red-100 text-red-700';
    case '增持':
    case '推荐':
      return 'bg-orange-100 text-orange-700';
    case '减持':
    case '卖出':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function ResearchReportPanel({ onSelectStock, initialStockCode }: ResearchReportPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [stockCodeFilter, setStockCodeFilter] = useState(initialStockCode || '');
  const [rating, setRating] = useState<'all' | ResearchRating>('all');
  const [reportType, setReportType] = useState<'all' | ResearchReportType>('all');
  const [dateRange, setDateRange] = useState<ResearchDateRange>('30d');
  const [pageSize, setPageSize] = useState(20);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    ['news:research-reports', keyword, stockCodeFilter, rating, reportType, dateRange, pageSize],
    () => fetchResearchReports({
      keyword,
      stockCode: stockCodeFilter || undefined,
      rating,
      reportType,
      dateRange,
      page: 1,
      pageSize,
    }),
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  useEffect(() => {
    setStockCodeFilter(initialStockCode || '');
    setPageSize(20);
    setSelectedReportId(null);
  }, [initialStockCode]);

  const { data: detail } = useSWR(
    selectedReportId ? ['news:research-report-detail', selectedReportId] : null,
    () => fetchResearchReportDetail(selectedReportId as string),
    {
      dedupingInterval: 90_000,
      revalidateOnFocus: false,
    }
  );

  const reports = data?.items || [];

  return (
    <>
      <Card className="p-4 bg-background border-border">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-foreground">研究报告</h3>
            <span className="text-xs text-muted-foreground">已接入列表、评级、目标价和详情查看</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="relative xl:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索标题、机构、股票"
                className="pl-9"
              />
            </div>
            <Select value={rating} onValueChange={(value) => setRating(value as 'all' | ResearchRating)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="评级" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部评级</SelectItem>
                <SelectItem value="买入">买入</SelectItem>
                <SelectItem value="增持">增持</SelectItem>
                <SelectItem value="持有">持有</SelectItem>
                <SelectItem value="减持">减持</SelectItem>
                <SelectItem value="卖出">卖出</SelectItem>
                <SelectItem value="推荐">推荐</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Select value={reportType} onValueChange={(value) => setReportType(value as 'all' | ResearchReportType)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="研报类型" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="个股">个股</SelectItem>
                  <SelectItem value="行业">行业</SelectItem>
                  <SelectItem value="策略">策略</SelectItem>
                  <SelectItem value="宏观">宏观</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as ResearchDateRange)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="时间范围" /></SelectTrigger>
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
              <span>当前只展示该股票相关研报</span>
              <Button variant="ghost" size="sm" onClick={() => setStockCodeFilter('')}>清除筛选</Button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{data ? `共 ${data.total} 篇，当前展示 ${reports.length} 篇` : '正在获取研究报告'}</span>
            <Button variant="ghost" size="sm" onClick={() => mutate()}>刷新</Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileText className="size-5" /></EmptyMedia>
                <EmptyTitle>研报加载失败</EmptyTitle>
                <EmptyDescription>当前无法读取研究报告数据，请稍后重试。</EmptyDescription>
              </EmptyHeader>
              <Button onClick={() => mutate()}>重新加载</Button>
            </Empty>
          ) : reports.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileText className="size-5" /></EmptyMedia>
                <EmptyTitle>暂无匹配研报</EmptyTitle>
                <EmptyDescription>可以调整评级或时间范围后再试。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ScrollArea className="h-[460px] pr-2">
              <div className="space-y-3">
                {reports.map((report) => (
                  <button
                    type="button"
                    key={report.report_id}
                    className="w-full rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedReportId(report.report_id)}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {report.rating && <Badge className={getRatingColor(report.rating)}>{report.rating}</Badge>}
                          {report.rating_change && <Badge variant="outline">{report.rating_change}</Badge>}
                          {report.report_type && <Badge variant="outline">{report.report_type}</Badge>}
                        </div>
                        <div className="font-medium text-foreground leading-6">{report.title}</div>
                        {report.summary && <p className="text-sm text-muted-foreground line-clamp-2">{report.summary}</p>}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{report.org_name || '--'}</span>
                          {report.author && <span>{report.author}</span>}
                          {typeof report.target_price === 'number' && (
                            <span className="text-red-600 font-medium">目标价 {report.target_price}</span>
                          )}
                          {report.ts_code && (
                            <button
                              type="button"
                              className="rounded-md bg-purple-50 px-2 py-1 text-purple-700 hover:bg-purple-100"
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelectStock?.(report.ts_code as string);
                              }}
                            >
                              {report.stock_name || report.ts_code} {report.ts_code}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        <div>{report.report_date}</div>
                        <div>{report.read_count || 0} 阅读</div>
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

      <Sheet open={Boolean(selectedReportId)} onOpenChange={(open) => !open && setSelectedReportId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail?.title || '研报详情'}</SheetTitle>
            <SheetDescription>
              {detail ? `${detail.org_name || '--'} · ${detail.report_date}` : '正在加载研究报告详情'}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="px-4 pb-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {detail.rating && <Badge className={getRatingColor(detail.rating)}>{detail.rating}</Badge>}
                {detail.rating_change && <Badge variant="outline">{detail.rating_change}</Badge>}
                {detail.report_type && <Badge variant="outline">{detail.report_type}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-muted-foreground mb-1">机构 / 分析师</div>
                  <div className="text-foreground">{detail.org_name || '--'} / {detail.author || '--'}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-muted-foreground mb-1">评级 / 目标价</div>
                  <div className="text-foreground">{detail.rating || '--'} / {detail.target_price ?? '--'}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-muted-foreground mb-1">预测 EPS / PE</div>
                  <div className="text-foreground">{detail.eps_forecast ?? '--'} / {detail.pe_forecast ?? '--'}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-muted-foreground mb-1">阅读 / 下载</div>
                  <div className="text-foreground">{detail.read_count || 0} / {detail.download_count || 0}</div>
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-4 text-sm text-foreground leading-7 whitespace-pre-wrap">
                {detail.summary || '当前仅同步到研报摘要。'}
              </div>
              <div className="flex flex-wrap gap-3">
                {detail.ts_code && (
                  <Button variant="outline" onClick={() => onSelectStock?.(detail.ts_code as string)}>
                    查看个股详情
                  </Button>
                )}
                {detail.file_url && (
                  <Button asChild>
                    <a href={detail.file_url} target="_blank" rel="noreferrer">
                      <TrendingUp className="w-4 h-4 mr-2" />查看原文
                    </a>
                  </Button>
                )}
              </div>
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