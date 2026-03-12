import { useMemo, useState } from 'react';
import { FolderPlus, LogIn, MoreHorizontal, Pencil, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatLargeNumber, formatNumber, getChangeColor } from '@/lib/utils';
import { useWatchlist } from '@/contexts/WatchlistContext';

type SortKey = 'added_desc' | 'added_asc' | 'change_desc' | 'change_asc' | 'name_asc';

export function Watchlist({ onSelectStock }: { onSelectStock?: (tsCode: string) => void }) {
  const {
    groups,
    items,
    isLoading,
    isAuthenticated,
    openAuthDialog,
    refresh,
    createGroup,
    renameGroup,
    deleteGroup,
    moveItem,
    removeItemByCode,
  } = useWatchlist();
  const [activeGroupId, setActiveGroupId] = useState<number | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('added_desc');
  const [groupDialogMode, setGroupDialogMode] = useState<'create' | 'rename' | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    let nextItems = items.filter((item) => activeGroupId === 'all' || item.groupId === activeGroupId);

    if (normalizedKeyword) {
      nextItems = nextItems.filter((item) => {
        const haystacks = [item.stockName, item.tsCode, item.groupName].filter(Boolean).join(' ').toLowerCase();
        return haystacks.includes(normalizedKeyword);
      });
    }

    nextItems = [...nextItems].sort((left, right) => {
      switch (sortKey) {
        case 'added_asc':
          return left.createdAt.localeCompare(right.createdAt);
        case 'change_desc':
          return (right.latestPctChg ?? -999) - (left.latestPctChg ?? -999);
        case 'change_asc':
          return (left.latestPctChg ?? 999) - (right.latestPctChg ?? 999);
        case 'name_asc':
          return left.stockName.localeCompare(right.stockName, 'zh-CN');
        case 'added_desc':
        default:
          return right.createdAt.localeCompare(left.createdAt);
      }
    });

    return nextItems;
  }, [activeGroupId, items, keyword, sortKey]);

  const activeGroup = groups.find((group) => group.id === editingGroupId) ?? null;

  const handleOpenCreateGroup = () => {
    setGroupDialogMode('create');
    setEditingGroupId(null);
    setGroupNameInput('');
  };

  const handleOpenRenameGroup = (groupId: number) => {
    const target = groups.find((group) => group.id === groupId);
    if (!target) return;
    setGroupDialogMode('rename');
    setEditingGroupId(groupId);
    setGroupNameInput(target.name);
  };

  const handleSubmitGroupDialog = async () => {
    if (groupDialogMode === 'create') {
      const created = await createGroup(groupNameInput);
      if (created) {
        setGroupDialogMode(null);
        setGroupNameInput('');
      }
      return;
    }

    if (groupDialogMode === 'rename' && editingGroupId !== null) {
      const renamed = await renameGroup(editingGroupId, groupNameInput);
      if (renamed) {
        setGroupDialogMode(null);
        setEditingGroupId(null);
        setGroupNameInput('');
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <Card className="border-border p-8">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <Badge variant="outline">账号同步版</Badge>
          <h2 className="text-2xl font-semibold text-foreground">登录后即可跨会话保存自选股</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            第一版自选股使用 Supabase Auth 隔离用户数据。登录后，你可以从个股详情、市场概览、板块热点和智能选股直接加入自选，并按分组管理。
          </p>
          <Button onClick={openAuthDialog} className="gap-2">
            <LogIn className="h-4 w-4" />
            登录并开始使用
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">自选股</h2>
          <p className="mt-1 text-sm text-muted-foreground">集中管理高频跟踪股票，减少每日重复筛选和跳转。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Button size="sm" className="gap-2" onClick={handleOpenCreateGroup}>
            <FolderPlus className="h-4 w-4" />
            新建分组
          </Button>
        </div>
      </div>

      <Card className="border-border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeGroupId === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveGroupId('all')}
            >
              全部
              <Badge variant="secondary" className="ml-1">{items.length}</Badge>
            </Button>
            {groups.map((group) => (
              <Button
                key={group.id}
                variant={activeGroupId === group.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveGroupId(group.id)}
              >
                {group.name}
                <Badge variant="secondary" className="ml-1">{group.itemCount}</Badge>
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-[16rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索名称/代码/分组" className="pl-9" />
            </div>
            <div className="flex gap-2">
              <Button variant={sortKey === 'added_desc' ? 'default' : 'outline'} size="sm" onClick={() => setSortKey('added_desc')}>最新加入</Button>
              <Button variant={sortKey === 'change_desc' ? 'default' : 'outline'} size="sm" onClick={() => setSortKey('change_desc')}>涨幅优先</Button>
              <Button variant={sortKey === 'name_asc' ? 'default' : 'outline'} size="sm" onClick={() => setSortKey('name_asc')}>名称排序</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)
        ) : filteredItems.length === 0 ? (
          <Card className="border-border p-10 text-center text-sm text-muted-foreground">
            当前条件下暂无自选股。你可以先从个股详情、市场概览、板块热点或智能选股加入。
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} className="border-border p-4 transition-colors hover:bg-muted/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => onSelectStock?.(item.tsCode)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-lg font-semibold text-foreground">{item.stockName}</div>
                    <div className="font-mono text-sm text-muted-foreground">{item.tsCode}</div>
                    <Badge variant="outline">{item.groupName}</Badge>
                    {item.market ? <Badge variant="secondary">{item.market}</Badge> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>加入时间 {item.createdAt.slice(0, 10)}</span>
                    <span>最新交易日 {item.latestTradeDate ?? '-'}</span>
                    {item.note ? <span>备注 {item.note}</span> : null}
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">最新价</div>
                    <div className="font-mono text-foreground">{item.latestPrice !== null ? formatNumber(item.latestPrice) : '-'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">涨跌幅</div>
                    <div className={cn('font-mono', getChangeColor(item.latestPctChg ?? 0))}>
                      {item.latestPctChg !== null ? `${item.latestPctChg > 0 ? '+' : ''}${item.latestPctChg.toFixed(2)}%` : '-'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">换手率</div>
                    <div className="font-mono text-foreground">{item.turnoverRate !== null ? `${item.turnoverRate.toFixed(2)}%` : '-'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">总市值</div>
                    <div className="font-mono text-foreground">{item.totalMv !== null ? formatLargeNumber(item.totalMv, 'wan') : '-'}</div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>管理自选股</DropdownMenuLabel>
                      {groups.map((group) => (
                        <DropdownMenuItem
                          key={`${item.id}-${group.id}`}
                          disabled={group.id === item.groupId}
                          onClick={() => void moveItem(item.id, group.id)}
                        >
                          移动到 {group.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => void removeItemByCode(item.tsCode, item.stockName)}>
                        <Trash2 className="h-4 w-4" />
                        移出自选
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="border-border p-4">
        <div className="mb-3 text-sm font-medium text-foreground">分组管理</div>
        <div className="space-y-2">
          {groups.map((group) => (
            <div key={group.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{group.name}</span>
                  {group.isDefault ? <Badge variant="secondary">默认</Badge> : null}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{group.itemCount} 只股票</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleOpenRenameGroup(group.id)}>
                  <Pencil className="h-4 w-4" />
                  重命名
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={group.isDefault} onClick={() => void deleteGroup(group.id)}>
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={groupDialogMode !== null} onOpenChange={(open) => !open && setGroupDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{groupDialogMode === 'create' ? '新建分组' : '重命名分组'}</DialogTitle>
            <DialogDescription>
              {groupDialogMode === 'create' ? '创建新的自选股分组，用于区分观察、持仓和候选池。' : `更新 ${activeGroup?.name ?? ''} 的分组名称。`}
            </DialogDescription>
          </DialogHeader>
          <Input value={groupNameInput} onChange={(event) => setGroupNameInput(event.target.value)} placeholder="例如：观察池 / 持仓 / 次日跟踪" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogMode(null)}>取消</Button>
            <Button onClick={() => void handleSubmitGroupDialog()}>{groupDialogMode === 'create' ? '创建' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}