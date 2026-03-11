import { memo, useMemo, useState } from 'react';
import useSWR from 'swr';
import { ArrowDown, ArrowUp, ArrowUpDown, Flame } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, getChangeColor } from '@/lib/utils';
import { fetchLimitStocksByBoardLevel, type LimitBoardLevel } from '@/services/marketService';
import type { LimitUpData } from '@/types';

type SortField = 'limit_times' | 'pct_chg' | 'limit_amount' | 'first_time' | 'open_times';
type SortOrder = 'asc' | 'desc';

interface LimitBoardStockPanelProps {
  level: LimitBoardLevel;
  expectedCount?: number;
  onSelectStock?: (tsCode: string) => void;
}

const LEVEL_LABEL: Record<LimitBoardLevel, string> = {
  1: '首板',
  2: '2板',
  3: '3板',
  4: '4板',
  5: '5板+',
};

function formatAmountToYi(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '-';
  return `${(amount / 100000000).toFixed(2)}亿`;
}

export const LimitBoardStockPanel = memo(function LimitBoardStockPanel({
  level,
  expectedCount,
  onSelectStock,
}: LimitBoardStockPanelProps) {
  const [sortBy, setSortBy] = useState<SortField>('limit_amount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { data, isLoading } = useSWR(
    `market:limit-board:level:${level}`,
    () => fetchLimitStocksByBoardLevel(level),
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const loading = isLoading && !data;
  const stocks = (data || []) as LimitUpData[];

  const sortedStocks = useMemo(() => {
    const next = [...stocks];
    next.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];

      if (sortBy === 'first_time') {
        const as = typeof av === 'string' ? av : '';
        const bs = typeof bv === 'string' ? bv : '';
        return sortOrder === 'desc' ? bs.localeCompare(as) : as.localeCompare(bs);
      }

      const na = Number(av) || 0;
      const nb = Number(bv) || 0;
      return sortOrder === 'desc' ? nb - na : na - nb;
    });
    return next;
  }, [stocks, sortBy, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortBy(field);
    setSortOrder('desc');
  };

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-muted-foreground" />;
    return sortOrder === 'desc'
      ? <ArrowDown className="w-3.5 h-3.5 ml-1 text-blue-500" />
      : <ArrowUp className="w-3.5 h-3.5 ml-1 text-blue-500" />;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between pl-4 pr-10 py-3 bg-muted border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-red-500" />
          <h3 className="text-base font-semibold text-foreground">{LEVEL_LABEL[level]} 股票列表</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          统计: <span className="font-medium text-foreground">{expectedCount ?? 0}</span> 只
          <span className="mx-1">|</span>
          实际: <span className="font-medium text-foreground">{stocks.length}</span> 只
        </div>
      </div>

      <div className={cn('flex-1 overflow-auto min-h-0 transition-opacity duration-200', isLoading && data ? 'opacity-50' : 'opacity-100')}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-[92px] text-xs sticky top-0 bg-muted z-10">代码</TableHead>
              <TableHead className="w-[84px] text-xs sticky top-0 bg-muted z-10">名称</TableHead>
              <TableHead
                className="w-20 text-right text-xs cursor-pointer sticky top-0 bg-muted z-10"
                onClick={() => handleSort('limit_times')}
              >
                <div className="flex items-center justify-end">连板{renderSortIcon('limit_times')}</div>
              </TableHead>
              <TableHead
                className="w-20 text-right text-xs cursor-pointer sticky top-0 bg-muted z-10"
                onClick={() => handleSort('pct_chg')}
              >
                <div className="flex items-center justify-end">涨跌幅{renderSortIcon('pct_chg')}</div>
              </TableHead>
              <TableHead
                className="w-24 text-right text-xs cursor-pointer sticky top-0 bg-muted z-10"
                onClick={() => handleSort('limit_amount')}
              >
                <div className="flex items-center justify-end">封单额{renderSortIcon('limit_amount')}</div>
              </TableHead>
              <TableHead
                className="w-24 text-right text-xs cursor-pointer sticky top-0 bg-muted z-10"
                onClick={() => handleSort('first_time')}
              >
                <div className="flex items-center justify-end">首封时间{renderSortIcon('first_time')}</div>
              </TableHead>
              <TableHead
                className="w-20 text-right text-xs cursor-pointer sticky top-0 bg-muted z-10"
                onClick={() => handleSort('open_times')}
              >
                <div className="flex items-center justify-end">开板次数{renderSortIcon('open_times')}</div>
              </TableHead>
              <TableHead className="w-24 text-xs sticky top-0 bg-muted z-10">行业</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : sortedStocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  当前档位暂无股票数据
                </TableCell>
              </TableRow>
            ) : (
              sortedStocks.map((stock) => (
                <TableRow
                  key={stock.ts_code}
                  className={cn(
                    'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors',
                    onSelectStock && 'active:bg-blue-100 dark:active:bg-blue-900/30'
                  )}
                  onClick={() => onSelectStock?.(stock.ts_code)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">{stock.ts_code}</TableCell>
                  <TableCell className="text-xs font-medium text-foreground">{stock.name}</TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">{stock.limit_times}板</TableCell>
                  <TableCell className={cn('text-right text-xs font-mono font-medium', getChangeColor(stock.pct_chg))}>
                    {stock.pct_chg > 0 ? '+' : ''}{stock.pct_chg.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">
                    {formatAmountToYi(stock.limit_amount)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">
                    {stock.first_time || '--:--:--'}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">
                    {stock.open_times}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{stock.tag || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});
