import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { AuthPage } from '@/components/auth/AuthPage';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { WatchlistProvider } from '@/contexts/WatchlistContext';

type NewsTab = 'announcement' | 'report' | 'calendar';
type AppTab = 'market' | 'stock' | 'sector' | 'dragon' | 'screener' | 'ai' | 'news' | 'watchlist';

interface RouteState {
  activeTab: AppTab;
  stockNavigation: StockNavigationState | null;
  newsNavigation: NewsNavigationState | null;
}

interface NewsNavigationState {
  tab: NewsTab;
  stockCode?: string | null;
}

interface StockNavigationState {
  stockCode: string;
  sourceTab: Exclude<AppTab, 'stock'> | null;
}

const MarketOverview = lazy(() => import('@/sections/MarketOverview').then((m) => ({ default: m.MarketOverview })));
const StockDetail = lazy(() => import('@/sections/StockDetail').then((m) => ({ default: m.StockDetail })));
const SectorHeat = lazy(() => import('@/sections/SectorHeat').then((m) => ({ default: m.SectorHeat })));
const StockScreener = lazy(() => import('@/sections/StockScreener').then((m) => ({ default: m.StockScreener })));
const AIAnalysis = lazy(() => import('@/sections/AIAnalysis').then((m) => ({ default: m.AIAnalysis })));
const NewsCenter = lazy(() => import('@/sections/NewsCenter').then((m) => ({ default: m.NewsCenter })));
const DragonTigerPage = lazy(() => import('@/sections/DragonTigerPage').then((m) => ({ default: m.DragonTigerPage })));
const Watchlist = lazy(() => import('@/sections/Watchlist').then((m) => ({ default: m.Watchlist })));

const PROTECTED_TABS: AppTab[] = ['screener', 'ai', 'news', 'watchlist'];
const PROTECTED_TAB_LABELS: Record<AppTab, string> = {
  market: '市场概览',
  stock: '个股详情',
  sector: '板块热点',
  dragon: '龙虎榜',
  screener: '智能选股',
  ai: 'AI分析',
  news: '资讯中心',
  watchlist: '自选股',
};

const APP_TABS: AppTab[] = ['market', 'stock', 'sector', 'dragon', 'screener', 'ai', 'news', 'watchlist'];
const NEWS_TABS: NewsTab[] = ['announcement', 'report', 'calendar'];

function isAppTab(value: string | null): value is AppTab {
  return value !== null && APP_TABS.includes(value as AppTab);
}

function isNewsTab(value: string | null): value is NewsTab {
  return value !== null && NEWS_TABS.includes(value as NewsTab);
}

function isStockSourceTab(value: string | null): value is Exclude<AppTab, 'stock'> {
  return value !== null && value !== 'stock' && isAppTab(value);
}

function isStockNavigationEqual(left: StockNavigationState | null, right: StockNavigationState | null) {
  return left?.stockCode === right?.stockCode && left?.sourceTab === right?.sourceTab;
}

function isNewsNavigationEqual(left: NewsNavigationState | null, right: NewsNavigationState | null) {
  return left?.tab === right?.tab && left?.stockCode === right?.stockCode;
}

function parseRouteState(hash: string): RouteState {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const [tabSegment, queryString = ''] = normalizedHash.split('?');
  const activeTab = isAppTab(tabSegment) ? tabSegment : 'market';
  const params = new URLSearchParams(queryString);
  const stockCode = params.get('code');
  const sourceTab = params.get('from');
  const newsTab = params.get('tab');

  return {
    activeTab,
    stockNavigation: activeTab === 'stock' && stockCode
      ? {
          stockCode,
          sourceTab: isStockSourceTab(sourceTab) ? sourceTab : null,
        }
      : null,
    newsNavigation: activeTab === 'news' && isNewsTab(newsTab)
      ? {
          tab: newsTab,
          stockCode,
        }
      : null,
  };
}

function buildRouteHash(routeState: RouteState): string {
  const params = new URLSearchParams();

  if (routeState.activeTab === 'stock' && routeState.stockNavigation?.stockCode) {
    params.set('code', routeState.stockNavigation.stockCode);
    if (routeState.stockNavigation.sourceTab) {
      params.set('from', routeState.stockNavigation.sourceTab);
    }
  }

  if (routeState.activeTab === 'news' && routeState.newsNavigation?.tab) {
    params.set('tab', routeState.newsNavigation.tab);
    if (routeState.newsNavigation.stockCode) {
      params.set('code', routeState.newsNavigation.stockCode);
    }
  }

  const query = params.toString();
  return query ? `#${routeState.activeTab}?${query}` : `#${routeState.activeTab}`;
}

function SectionFallback() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

function AppShell() {
  const { user, isLoading: authLoading, isAuthDialogOpen, closeAuthDialog } = useAuth();
  const initialRouteState = useMemo(
    () => parseRouteState(typeof window === 'undefined' ? '' : window.location.hash),
    [],
  );
  const [activeTab, setActiveTab] = useState<AppTab>(initialRouteState.activeTab);
  const [stockNavigation, setStockNavigation] = useState<StockNavigationState | null>(initialRouteState.stockNavigation);
  const [newsNavigation, setNewsNavigation] = useState<NewsNavigationState | null>(initialRouteState.newsNavigation);

  const isProtectedTab = PROTECTED_TABS.includes(activeTab);
  const shouldShowAuthPage = !authLoading && !user && (isProtectedTab || isAuthDialogOpen);
  const authTargetLabel = useMemo(() => {
    if (!isProtectedTab) return null;
    return PROTECTED_TAB_LABELS[activeTab];
  }, [activeTab, isProtectedTab]);

  const syncRouteStateFromHash = useCallback((nextRouteState: RouteState) => {
    setActiveTab((currentTab) => (currentTab === nextRouteState.activeTab ? currentTab : nextRouteState.activeTab));
    setStockNavigation((currentNavigation) => (
      isStockNavigationEqual(currentNavigation, nextRouteState.stockNavigation)
        ? currentNavigation
        : nextRouteState.stockNavigation
    ));
    setNewsNavigation((currentNavigation) => (
      isNewsNavigationEqual(currentNavigation, nextRouteState.newsNavigation)
        ? currentNavigation
        : nextRouteState.newsNavigation
    ));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleHashChange = () => {
      syncRouteStateFromHash(parseRouteState(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [syncRouteStateFromHash]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const nextHash = buildRouteHash({
      activeTab,
      stockNavigation,
      newsNavigation,
    });

    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [activeTab, newsNavigation, stockNavigation]);

  const handleSelectStock = useCallback((tsCode: string) => {
    setStockNavigation({
      stockCode: tsCode,
      sourceTab: activeTab === 'stock' ? null : activeTab,
    });
    setActiveTab('stock');
  }, [activeTab]);

  const handleBackFromStockDetail = useCallback(() => {
    if (stockNavigation?.sourceTab) {
      setActiveTab(stockNavigation.sourceTab);
      setStockNavigation(null);
      return;
    }

    setStockNavigation(null);
  }, [stockNavigation]);

  const handleOpenNews = useCallback((tab: NewsTab, stockCode?: string | null) => {
    setNewsNavigation({ tab, stockCode: stockCode ?? null });
    setActiveTab('news');
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    const nextTab = isAppTab(tab) ? tab : 'market';

    if (nextTab !== 'stock') {
      setStockNavigation(null);
    }
    if (nextTab !== 'news') {
      setNewsNavigation(null);
    }

    setActiveTab(nextTab);
  }, []);

  const handleDismissAuthPage = useCallback(() => {
    closeAuthDialog();
    if (isProtectedTab) {
      setActiveTab('market');
    }
  }, [closeAuthDialog, isProtectedTab]);

  const renderContent = () => {
    if (shouldShowAuthPage) {
      return (
        <AuthPage
          title={authTargetLabel ? `登录后继续使用${authTargetLabel}` : '登录后使用完整功能'}
          description={authTargetLabel
            ? `${authTargetLabel} 页面已接入账号体系，请完成登录或注册后继续使用。`
            : '登录后可同步自选股、使用智能选股与 AI 分析，并接收专属资讯和预警。'}
          onDismiss={handleDismissAuthPage}
          dismissLabel={isProtectedTab ? '返回市场概览' : '返回当前页面'}
        />
      );
    }

    switch (activeTab) {
      case 'market':
        return <MarketOverview onSelectStock={handleSelectStock} />;
      case 'stock':
        return (
          <StockDetail
            initialStockCode={stockNavigation?.stockCode ?? null}
            onBack={stockNavigation?.sourceTab ? handleBackFromStockDetail : undefined}
            onOpenNews={handleOpenNews}
          />
        );
      case 'sector':
        return <SectorHeat onSelectStock={handleSelectStock} />;
      case 'dragon':
        return <DragonTigerPage onSelectStock={handleSelectStock} />;
      case 'screener':
        return <StockScreener onSelectStock={handleSelectStock} />;
      case 'ai':
        return <AIAnalysis />;
      case 'news':
        return (
          <NewsCenter
            onSelectStock={handleSelectStock}
            initialTab={newsNavigation?.tab}
            initialStockCode={newsNavigation?.stockCode ?? null}
          />
        );
      case 'watchlist':
        return <Watchlist onSelectStock={handleSelectStock} />;
      default:
        return <MarketOverview onSelectStock={handleSelectStock} />;
    }
  };

  return (
    <WatchlistProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Navigation activeTab={activeTab} onTabChange={handleTabChange} onSelectStock={handleSelectStock} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Suspense fallback={<SectionFallback />}>
            {renderContent()}
          </Suspense>
        </main>
        <Toaster />
      </div>
    </WatchlistProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
