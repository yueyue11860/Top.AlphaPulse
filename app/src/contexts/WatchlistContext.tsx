import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import type { AddWatchlistItemInput, WatchlistGroup, WatchlistItem, WatchlistOverview } from '@/types';
import { isCnMarketTradingSession } from '@/lib/marketTime';
import {
  addWatchlistItem,
  createWatchlistGroup,
  deleteWatchlistGroup,
  fetchWatchlistOverview,
  moveWatchlistItem,
  removeWatchlistItemByCode,
  renameWatchlistGroup,
  updateWatchlistItemNote,
} from '@/services/watchlistService';
import type { StockQuoteItem } from '@/services/stockDetailService';
import { useAuth } from '@/contexts/AuthContext';

interface WatchlistContextValue {
  overview: WatchlistOverview;
  groups: WatchlistGroup[];
  items: WatchlistItem[];
  count: number;
  defaultGroupId: number | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  contains: (tsCode: string) => boolean;
  openAuthDialog: () => void;
  refresh: () => Promise<void>;
  applySnapshotQuotes: (quotes: StockQuoteItem[]) => void;
  addItem: (input: AddWatchlistItemInput) => Promise<boolean>;
  removeItemByCode: (tsCode: string, stockName?: string) => Promise<boolean>;
  toggleItem: (input: AddWatchlistItemInput) => Promise<boolean>;
  createGroup: (name: string) => Promise<boolean>;
  renameGroup: (groupId: number, name: string) => Promise<boolean>;
  deleteGroup: (groupId: number) => Promise<boolean>;
  moveItem: (itemId: number, groupId: number) => Promise<boolean>;
  updateItemNote: (itemId: number, note: string) => Promise<boolean>;
}

const EMPTY_OVERVIEW: WatchlistOverview = {
  groups: [],
  items: [],
  defaultGroupId: null,
  updatedAt: null,
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading, openAuthDialog } = useAuth();
  const { data, isLoading, mutate } = useSWR(
    user ? ['watchlist:overview', user.id] : null,
    () => fetchWatchlistOverview(),
    {
      dedupingInterval: 10_000,
      refreshInterval: user && isCnMarketTradingSession() ? 15_000 : 0,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshWhenHidden: false,
      keepPreviousData: false,
    },
  );

  const overview = data ?? EMPTY_OVERVIEW;
  const isAuthenticated = Boolean(user);
  const stockCodeSet = useMemo(() => new Set(overview.items.map((item) => item.tsCode)), [overview.items]);

  const requireAuth = useCallback(() => {
    if (user) return true;
    toast.info('请先登录后再管理自选股');
    openAuthDialog();
    return false;
  }, [openAuthDialog, user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    await mutate();
  }, [mutate, user]);

  const applySnapshotQuotes = useCallback((quotes: StockQuoteItem[]) => {
    if (quotes.length === 0) return;

    const quoteMap = new Map(quotes.map((quote) => [quote.ts_code, quote]));
    void mutate((current) => {
      const base = current ?? EMPTY_OVERVIEW;
      let hasChanged = false;

      const items = base.items.map((item) => {
        const quote = quoteMap.get(item.tsCode);
        if (!quote) return item;

        const nextItem = {
          ...item,
          stockName: item.stockName || quote.name,
          latestTradeDate: quote.trade_date || item.latestTradeDate,
          latestPrice: quote.close,
          latestPctChg: quote.pct_chg,
          turnoverRate: quote.turnover_rate,
          totalMv: quote.total_mv,
        };

        if (
          nextItem.latestTradeDate !== item.latestTradeDate ||
          nextItem.latestPrice !== item.latestPrice ||
          nextItem.latestPctChg !== item.latestPctChg ||
          nextItem.turnoverRate !== item.turnoverRate ||
          nextItem.totalMv !== item.totalMv
        ) {
          hasChanged = true;
        }

        return nextItem;
      });

      if (!hasChanged) return base;
      return {
        ...base,
        items,
        updatedAt: new Date().toISOString(),
      };
    }, { revalidate: false });
  }, [mutate]);

  const addItemAction = useCallback(async (input: AddWatchlistItemInput) => {
    if (!requireAuth()) return false;
    try {
      await addWatchlistItem(input);
      await mutate();
      toast.success(`${input.stockName ?? input.tsCode} 已加入自选`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加入自选失败');
      return false;
    }
  }, [mutate, requireAuth]);

  const removeItemAction = useCallback(async (tsCode: string, stockName?: string) => {
    if (!requireAuth()) return false;
    try {
      await removeWatchlistItemByCode(tsCode);
      await mutate();
      toast.success(`${stockName ?? tsCode} 已移出自选`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '移除自选失败');
      return false;
    }
  }, [mutate, requireAuth]);

  const toggleItem = useCallback(async (input: AddWatchlistItemInput) => {
    if (stockCodeSet.has(input.tsCode)) {
      return removeItemAction(input.tsCode, input.stockName ?? undefined);
    }
    return addItemAction(input);
  }, [addItemAction, removeItemAction, stockCodeSet]);

  const createGroupAction = useCallback(async (name: string) => {
    if (!requireAuth()) return false;
    try {
      await createWatchlistGroup(name);
      await mutate();
      toast.success('分组已创建');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建分组失败');
      return false;
    }
  }, [mutate, requireAuth]);

  const renameGroupAction = useCallback(async (groupId: number, name: string) => {
    if (!requireAuth()) return false;
    try {
      await renameWatchlistGroup(groupId, name);
      await mutate();
      toast.success('分组已更新');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新分组失败');
      return false;
    }
  }, [mutate, requireAuth]);

  const deleteGroupAction = useCallback(async (groupId: number) => {
    if (!requireAuth()) return false;
    try {
      await deleteWatchlistGroup(groupId);
      await mutate();
      toast.success('分组已删除');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除分组失败');
      return false;
    }
  }, [mutate, requireAuth]);

  const moveItemAction = useCallback(async (itemId: number, groupId: number) => {
    if (!requireAuth()) return false;
    try {
      await moveWatchlistItem(itemId, groupId);
      await mutate();
      toast.success('已移动到新分组');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '移动分组失败');
      return false;
    }
  }, [mutate, requireAuth]);

  const updateItemNoteAction = useCallback(async (itemId: number, note: string) => {
    if (!requireAuth()) return false;
    try {
      await updateWatchlistItemNote(itemId, note);
      await mutate();
      toast.success('备注已更新');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新备注失败');
      return false;
    }
  }, [mutate, requireAuth]);

  const value = useMemo<WatchlistContextValue>(() => ({
    overview,
    groups: overview.groups,
    items: overview.items,
    count: overview.items.length,
    defaultGroupId: overview.defaultGroupId,
    isLoading: authLoading || (isAuthenticated && isLoading),
    isAuthenticated,
    contains: (tsCode: string) => stockCodeSet.has(tsCode),
    openAuthDialog,
    refresh,
    applySnapshotQuotes,
    addItem: addItemAction,
    removeItemByCode: removeItemAction,
    toggleItem,
    createGroup: createGroupAction,
    renameGroup: renameGroupAction,
    deleteGroup: deleteGroupAction,
    moveItem: moveItemAction,
    updateItemNote: updateItemNoteAction,
  }), [addItemAction, applySnapshotQuotes, authLoading, createGroupAction, deleteGroupAction, isAuthenticated, isLoading, moveItemAction, openAuthDialog, overview, refresh, removeItemAction, renameGroupAction, stockCodeSet, toggleItem, updateItemNoteAction]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist 必须在 WatchlistProvider 内使用');
  }
  return context;
}