import { logger, supabaseStock } from './serviceUtils';
import type { AddWatchlistItemInput, WatchlistGroup, WatchlistItem, WatchlistOverview } from '@/types';

type RawWatchlistPayload = {
  groups?: Array<{
    id: number;
    name: string;
    isDefault: boolean;
    sortOrder: number;
    itemCount: number;
    createdAt: string;
  }>;
  items?: Array<{
    id: number;
    groupId: number;
    groupName: string;
    tsCode: string;
    stockName: string;
    market: string | null;
    note: string | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    latestTradeDate: string | null;
    latestPrice: number | null;
    latestPctChg: number | null;
    turnoverRate: number | null;
    totalMv: number | null;
  }>;
  defaultGroupId?: number | null;
  updatedAt?: string | null;
};

const EMPTY_OVERVIEW: WatchlistOverview = {
  groups: [],
  items: [],
  defaultGroupId: null,
  updatedAt: null,
};

function normalizeOverview(payload: RawWatchlistPayload | null | undefined): WatchlistOverview {
  if (!payload) return EMPTY_OVERVIEW;

  return {
    groups: (payload.groups ?? []) as WatchlistGroup[],
    items: (payload.items ?? []) as WatchlistItem[],
    defaultGroupId: payload.defaultGroupId ?? null,
    updatedAt: payload.updatedAt ?? null,
  };
}

async function requireUserId() {
  const {
    data: { user },
    error,
  } = await supabaseStock.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error('请先登录后再使用自选股');
  return user.id;
}

export async function ensureDefaultWatchlistGroup(): Promise<number> {
  await requireUserId();
  const client = supabaseStock as any;
  const { data, error } = await client.rpc('ensure_default_watchlist_group');
  if (error) throw error;
  return Number(data);
}

export async function fetchWatchlistOverview(): Promise<WatchlistOverview> {
  await requireUserId();
  const client = supabaseStock as any;

  try {
    const { data, error } = await client.rpc('get_watchlist_overview');
    if (error) throw error;

    const payload = typeof data === 'string' ? JSON.parse(data) : data;
    const overview = normalizeOverview(payload as RawWatchlistPayload);

    if (overview.groups.length === 0) {
      await ensureDefaultWatchlistGroup();
      const fallback = await client.rpc('get_watchlist_overview');
      const fallbackPayload = typeof fallback.data === 'string' ? JSON.parse(fallback.data) : fallback.data;
      return normalizeOverview(fallbackPayload as RawWatchlistPayload);
    }

    return overview;
  } catch (error) {
    logger.error('获取自选股总览失败:', error);
    throw error;
  }
}

async function getGroupSortOrder(userId: string): Promise<number> {
  const client = supabaseStock as any;
  const { data, error } = await client
    .from('watchlist_groups')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.sort_order ?? -1) + 1;
}

export async function createWatchlistGroup(name: string): Promise<void> {
  const userId = await requireUserId();
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('分组名称不能为空');
  }

  const client = supabaseStock as any;
  const sortOrder = await getGroupSortOrder(userId);
  const { error } = await client.from('watchlist_groups').insert({
    user_id: userId,
    name: normalizedName,
    sort_order: sortOrder,
  });

  if (error) throw error;
}

export async function renameWatchlistGroup(groupId: number, name: string): Promise<void> {
  await requireUserId();
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('分组名称不能为空');
  }

  const client = supabaseStock as any;
  const { error } = await client.from('watchlist_groups').update({ name: normalizedName }).eq('id', groupId);
  if (error) throw error;
}

export async function deleteWatchlistGroup(groupId: number): Promise<void> {
  await requireUserId();
  const client = supabaseStock as any;

  const { data: group, error: groupError } = await client
    .from('watchlist_groups')
    .select('id, is_default')
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) throw groupError;
  if (!group) throw new Error('分组不存在');
  if (group.is_default) {
    throw new Error('默认分组不能删除');
  }

  const { count, error: countError } = await client
    .from('watchlist_items')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);

  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error('请先移出该分组中的股票，再删除分组');
  }

  const { error } = await client.from('watchlist_groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function addWatchlistItem(input: AddWatchlistItemInput): Promise<void> {
  const userId = await requireUserId();
  const client = supabaseStock as any;
  const groupId = input.groupId ?? await ensureDefaultWatchlistGroup();

  const { error } = await client.from('watchlist_items').upsert(
    {
      user_id: userId,
      group_id: groupId,
      ts_code: input.tsCode,
      stock_name: input.stockName ?? null,
      market: input.market ?? null,
      note: input.note ?? null,
    },
    {
      onConflict: 'user_id,ts_code',
    },
  );

  if (error) throw error;
}

export async function removeWatchlistItemByCode(tsCode: string): Promise<void> {
  const userId = await requireUserId();
  const client = supabaseStock as any;
  const { error } = await client.from('watchlist_items').delete().eq('user_id', userId).eq('ts_code', tsCode);
  if (error) throw error;
}

export async function moveWatchlistItem(itemId: number, groupId: number): Promise<void> {
  await requireUserId();
  const client = supabaseStock as any;
  const { error } = await client.from('watchlist_items').update({ group_id: groupId }).eq('id', itemId);
  if (error) throw error;
}

export async function updateWatchlistItemNote(itemId: number, note: string): Promise<void> {
  await requireUserId();
  const client = supabaseStock as any;
  const { error } = await client.from('watchlist_items').update({ note }).eq('id', itemId);
  if (error) throw error;
}