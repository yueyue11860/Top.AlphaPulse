import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Newspaper,
  Zap,
  Building2,
  FileText,
  Calendar as CalendarIcon,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { fetchRealTimeNews, NEWS_SOURCES } from '@/services/newsService';
import { FEATURED_NEWS_TABLES, subscribeToNewsTables, getActiveSubscriptionCount } from '@/lib/supabase';
import { classifyNews, type NewsImportance, type NewsCategory } from '@/lib/newsClassifier';
import { NewsSidebar, NewsMobileFilters } from '@/components/news/NewsSidebar';
import { NewsStream } from '@/components/news/NewsStream';
import { NewsDetailModal, ImageLightbox } from '@/components/news/NewsDetailModal';
import { NewsSearchBar } from '@/components/news/NewsSearchBar';
import { AnnouncementPanel } from '@/components/news/AnnouncementPanel';
import { ResearchReportPanel } from '@/components/news/ResearchReportPanel';
import { FinanceCalendarPanel } from '@/components/news/FinanceCalendarPanel';
import type { NewsCardItem } from '@/components/news/NewsItemCard';

// ── 表名 ↔ 来源 key 双向映射 ─────────────────────────────

const TABLE_TO_SOURCE_KEY: Record<string, string> = {
  'snowball_influencer_tb': 'snowball_influencer',
  'weibo_influencer_tb': 'weibo_influencer',
  'wechat_influencer_tb': 'wechat_influencer',
  'nitter_twitter_influencer_tb': 'twitter_influencer',
  'clscntelegraph_tb': 'cls',
  'eastmoney724_tb': 'eastmoney',
  'jin10data724_tb': 'jin10',
  'gelonghui724_tb': 'gelonghui',
  'sina724_tb': 'sina',
  'jqka724_tb': 'jqka',
  'jrj724_tb': 'jrj',
  'futunn724_tb': 'futunn',
  'ifeng724_tb': 'ifeng',
  'jin10qihuo724_tb': 'jin10qihuo',
  'snowball724_tb': 'snowball',
  'wallstreetcn_tb': 'wallstreetcn',
  'xuangutong724_tb': 'xuangutong',
  'yicai724_tb': 'yicai',
  'yuncaijing724_tb': 'yuncaijing',
};

const SOURCE_TO_TABLE_MAP: Record<string, string> = Object.entries(TABLE_TO_SOURCE_KEY).reduce(
  (acc, [tableName, sourceKey]) => { acc[sourceKey] = tableName; return acc; },
  {} as Record<string, string>
);

// ── 工具函数 ────────────────────────────────────────────

function formatNewsTime(timestamp: number): { time: string; date: string } {
  const d = new Date(timestamp * 1000);
  return {
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    date: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  };
}

// ══════════════════════════════════════════════════════════
//  NewsCenter — 主组件
// ══════════════════════════════════════════════════════════

export function NewsCenter({
  onSelectStock,
  initialTab,
  initialStockCode,
}: {
  onSelectStock?: (tsCode: string) => void;
  initialTab?: 'announcement' | 'report' | 'calendar';
  initialStockCode?: string | null;
}) {
  // ── Tab 切换 ──
  const [activeTab, setActiveTab] = useState(initialTab || 'flash');

  // ── 实时快讯数据 ──
  const [flashNews, setFlashNews] = useState<NewsCardItem[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentLimit, setCurrentLimit] = useState(200);

  // ── 筛选状态 ──
  const [searchKeyword, setSearchKeyword] = useState('');
  const [importanceFilter, setImportanceFilter] = useState<NewsImportance[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<NewsCategory[]>([]);

  // ── 模态框 ──
  const [selectedNews, setSelectedNews] = useState<NewsCardItem | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // ── Realtime ──
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const realtimeConnected = realtimeEnabled && getActiveSubscriptionCount() > 0;
  const selectedSources = selectedSource === 'all' ? undefined : [selectedSource];

  // ── SWR 数据拉取（不加日期限制，直接取最新数据） ──

  const { isLoading, mutate } = useSWR(
    ['news:realtime:v2', selectedSource, currentLimit],
    () => fetchRealTimeNews({
      sources: selectedSources,
      limit: selectedSource === 'all' ? 50 : 80,
      totalLimit: currentLimit,
    }),
    {
      dedupingInterval: 5_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: activeTab === 'flash' && !realtimeEnabled ? 30_000 : 0,
      onSuccess: (news) => {
        const enriched = enrichNews(news as unknown as Record<string, unknown>[]);
        setFlashNews(enriched);
        setHasMore(news.length >= currentLimit);
        setLoadingMore(false);
      },
    }
  );

  /** 给原始数据附加 importance(三级) + categories */
  const enrichNews = useCallback((items: Array<Record<string, unknown>>): NewsCardItem[] => {
    return (items as unknown as NewsCardItem[]).map(item => {
      const { importance, categories } = classifyNews(item.title, item.content, item.sourceKey);
      return { ...item, importance, categories };
    });
  }, []);

  // ── Realtime 订阅：新数据直接插入主列表 ──

  useEffect(() => {
    if (!realtimeEnabled) {
      if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
      return;
    }

    const targetTables = selectedSource === 'all'
      ? FEATURED_NEWS_TABLES
      : (SOURCE_TO_TABLE_MAP[selectedSource] ? [SOURCE_TO_TABLE_MAP[selectedSource]] : []);

    if (targetTables.length === 0) return;

    const unsubscribe = subscribeToNewsTables(targetTables, (tableName, payload) => {
      const newData = payload.new as Record<string, unknown>;
      const sourceKey = TABLE_TO_SOURCE_KEY[tableName] || 'unknown';
      const sourceName = NEWS_SOURCES.find(s => s.key === sourceKey)?.name || tableName;
      const { time, date } = formatNewsTime(newData.display_time as number);
      const { importance, categories } = classifyNews(
        (newData.title as string) || '',
        (newData.content as string) || '',
        sourceKey,
      );

      let parsedImages: string[] | undefined;
      if (typeof newData.images === 'string' && (newData.images as string).trim()) {
        try { parsedImages = JSON.parse(newData.images as string); } catch { /* noop */ }
      }

      const newsItem: NewsCardItem = {
        id: `${sourceKey}_${newData.id}`,
        title: (newData.title as string) || '',
        content: (newData.content as string) || '',
        source: sourceName,
        sourceKey,
        display_time: newData.display_time as number,
        time,
        date,
        importance,
        categories,
        images: parsedImages,
        author: newData.author as string | undefined,
      };

      if (selectedSource !== 'all' && sourceKey !== selectedSource) return;

      // 直接插入主列表顶部（去重）
      setFlashNews(prev => {
        if (prev.some(n => n.id === newsItem.id)) return prev;
        return [newsItem, ...prev];
      });

      // 标记为新条目（用于高亮动画），3 秒后移除标记
      setNewItemIds(prev => new Set(prev).add(newsItem.id));
      setTimeout(() => {
        setNewItemIds(prev => {
          const next = new Set(prev);
          next.delete(newsItem.id);
          return next;
        });
      }, 3000);

      logger.log('[Realtime] 自动合并新新闻:', newsItem.title || newsItem.content.substring(0, 50));
    });

    unsubscribeRef.current = unsubscribe;
    logger.log('[Realtime] 已启用实时订阅，订阅数:', getActiveSubscriptionCount(), '订阅表:', targetTables);

    return () => {
      if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
    };
  }, [realtimeEnabled, selectedSource]);

  // ── 前端筛选（只展示最近 7 天数据） ──

  const filteredNews = useMemo(() => {
    // 计算 7 天前的时间戳（秒）
    const now = new Date();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
    const sevenDaysAgoTs = Math.floor(sevenDaysAgo.getTime() / 1000);

    // 先按 7 天筛选
    let result = flashNews.filter(n => n.display_time >= sevenDaysAgoTs);

    // 来源筛选（兜底，避免切换来源时短暂出现其他来源数据）
    if (selectedSource !== 'all') {
      result = result.filter(n => n.sourceKey === selectedSource);
    }

    // 关键词搜索
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(kw) || n.content.toLowerCase().includes(kw)
      );
    }

    // 重要性筛选（多选 OR）
    if (importanceFilter.length > 0) {
      result = result.filter(n => importanceFilter.includes(n.importance));
    }

    // 分类筛选（多选 OR：只要新闻包含任一选中分类即可）
    if (categoryFilter.length > 0) {
      result = result.filter(n =>
        n.categories.some(c => categoryFilter.includes(c as NewsCategory))
      );
    }

    return result;
  }, [flashNews, selectedSource, searchKeyword, importanceFilter, categoryFilter]);

  // ── 加载更多 ──
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setCurrentLimit(prev => prev + 200);
  }, [loadingMore, hasMore]);

  // ── 切换来源时重置 ──
  const handleSourceChange = useCallback((source: string) => {
    setSelectedSource(source);
    setCurrentLimit(200);
  }, []);

  const loading = isLoading && flashNews.length === 0;

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // ═══════════════════════════════════════════════════════
  //  渲染
  // ═══════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-foreground">财经资讯</h2>
        </div>
        {/* Realtime 状态 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRealtimeEnabled(!realtimeEnabled)}
            className={cn('gap-1 text-xs', realtimeConnected ? 'text-green-600' : 'text-muted-foreground')}
          >
            {realtimeConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                实时连接中
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                实时已关闭
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tab 切换 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-muted overflow-x-auto">
          <TabsTrigger value="flash" className="data-[state=active]:bg-white gap-1">
            <Zap className="w-4 h-4" />
            实时快讯
          </TabsTrigger>
          <TabsTrigger value="announcement" className="data-[state=active]:bg-white gap-1">
            <Building2 className="w-4 h-4" />
            公司公告
          </TabsTrigger>
          <TabsTrigger value="report" className="data-[state=active]:bg-white gap-1">
            <FileText className="w-4 h-4" />
            研究报告
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-white gap-1">
            <CalendarIcon className="w-4 h-4" />
            财经日历
          </TabsTrigger>
        </TabsList>

        {/* ═══ 实时快讯 Tab ═══ */}
        <TabsContent value="flash" className="mt-4">
          {/* 头部：标题 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              <h3 className="text-lg font-semibold text-foreground">7×24小时快讯</h3>
              <span className="text-xs text-muted-foreground">
                {filteredNews.length > 0 && `(最近7天 · ${filteredNews.length}条)`}
              </span>
            </div>
          </div>

          {/* 移动端搜索框 + 来源 Badge（md 以下显示） */}
          <div className="md:hidden space-y-3 mb-4">
            <NewsSearchBar
              value={searchKeyword}
              onChange={setSearchKeyword}
              resultCount={searchKeyword ? filteredNews.length : undefined}
            />
            <NewsMobileFilters
              sources={NEWS_SOURCES}
              selectedSource={selectedSource}
              onSourceChange={handleSourceChange}
            />
          </div>

          {/* 双栏布局：侧边栏 + 新闻流 */}
          <div className="flex gap-4">
            {/* 左侧侧边栏（桌面端） */}
            <div className="hidden md:block">
              <NewsSidebar
                searchKeyword={searchKeyword}
                onSearchChange={setSearchKeyword}
                searchResultCount={searchKeyword ? filteredNews.length : undefined}
                sources={NEWS_SOURCES}
                selectedSource={selectedSource}
                onSourceChange={handleSourceChange}
                importanceFilter={importanceFilter}
                onImportanceFilterChange={setImportanceFilter}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={setCategoryFilter}
              />
            </div>

            {/* 右侧新闻流 */}
            <Card className="flex-1 p-4 bg-background border-border min-w-0">
              <NewsStream
                news={filteredNews}
                loading={loading}
                hasMore={hasMore && !searchKeyword}
                loadingMore={loadingMore}
                searchKeyword={searchKeyword}
                newItemIds={newItemIds}
                onLoadMore={loadMore}
                onRetry={() => mutate()}
                onSelectNews={setSelectedNews}
                onZoomImage={setZoomedImage}
              />
            </Card>
          </div>
        </TabsContent>

        {/* ═══ 公司公告 Tab ═══ */}
        <TabsContent value="announcement" className="mt-4">
          <AnnouncementPanel onSelectStock={onSelectStock} initialStockCode={initialStockCode} />
        </TabsContent>

        {/* ═══ 研究报告 Tab ═══ */}
        <TabsContent value="report" className="mt-4">
          <ResearchReportPanel onSelectStock={onSelectStock} initialStockCode={initialStockCode} />
        </TabsContent>

        {/* ═══ 财经日历 Tab ═══ */}
        <TabsContent value="calendar" className="mt-4">
          <FinanceCalendarPanel onSelectStock={onSelectStock} initialStockCode={initialStockCode} />
        </TabsContent>
      </Tabs>

      {/* 新闻详情模态框 */}
      {selectedNews && (
        <NewsDetailModal
          news={selectedNews}
          onClose={() => setSelectedNews(null)}
          onZoomImage={setZoomedImage}
        />
      )}

      {/* 图片放大 */}
      {zoomedImage && (
        <ImageLightbox src={zoomedImage} onClose={() => setZoomedImage(null)} />
      )}
    </div>
  );
}
