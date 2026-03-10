import { useState, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { searchStocks } from '@/services/stockDetailService';
import { fetchUnreadAlertSummary, markAlertLogRead } from '@/services/stockPickerPersistenceService';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Search,
  Home,
  TrendingUp,
  BarChart3,
  Filter,
  Brain,
  Newspaper,
  User,
  Menu,
  X,
  Trophy,
  Bell,
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSelectStock?: (tsCode: string) => void;
}

const navItems = [
  { id: 'market', label: '市场概览', icon: Home },
  { id: 'stock', label: '个股详情', icon: TrendingUp },
  { id: 'sector', label: '板块热点', icon: BarChart3 },
  { id: 'dragon', label: '龙虎榜', icon: Trophy },
  { id: 'screener', label: '智能选股', icon: Filter },
  { id: 'ai', label: 'AI分析', icon: Brain },
  { id: 'news', label: '资讯中心', icon: Newspaper },
];

interface StockSearchResult {
  ts_code: string;
  name: string;
  industry: string;
}

export function Navigation({ activeTab, onTabChange, onSelectStock }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAlertSheetOpen, setIsAlertSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: unreadAlertSummary, mutate: mutateAlertSummary } = useSWR(
    'picker:unread-alert-summary',
    () => fetchUnreadAlertSummary(),
    {
      dedupingInterval: 30_000,
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );
  const unreadAlertCount = unreadAlertSummary?.unreadCount ?? 0;
  const unreadAlertLogs = unreadAlertSummary?.logs ?? [];

  // Debounced search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchStocks(query);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (result: StockSearchResult) => {
    setSearchQuery('');
    setShowDropdown(false);
    setSearchResults([]);
    onSelectStock?.(result.ts_code);
  };

  const handleOpenScreenerFromAlert = () => {
    setIsAlertSheetOpen(false);
    onTabChange('screener');
  };

  const handleMarkAlertRead = async (logId: number) => {
    const updated = await markAlertLogRead(logId);
    if (updated) {
      await mutateAlertSummary();
    }
  };

  const searchDropdown = showDropdown && (
    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 overflow-hidden min-w-[280px]">
      {searchResults.map((result) => (
        <button
          key={result.ts_code}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent text-sm transition-colors text-left"
          onClick={() => handleSelectResult(result)}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{result.name}</span>
            <span className="text-muted-foreground text-xs font-mono">{result.ts_code}</span>
          </div>
          {result.industry && (
            <span className="text-xs text-muted-foreground">{result.industry}</span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <nav className="sticky top-0 z-50 w-full bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground hidden sm:block">TOP.AlphaPulse</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'gap-1.5',
                    activeTab === item.id
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                  onClick={() => onTabChange(item.id)}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </Button>
              );
            })}
          </div>

          {/* Search & User & Theme */}
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block" ref={searchRef}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="搜索股票代码/名称..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                className="w-48 pl-9 h-8 bg-muted border-border text-foreground placeholder:text-muted-foreground text-sm"
              />
              {isSearching && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              )}
              {searchDropdown}
            </div>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
              onClick={() => setIsAlertSheetOpen(true)}
            >
              <Bell className="w-5 h-5" />
              {unreadAlertCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-[10px] leading-4 text-white">
                  {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <User className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-border">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={activeTab === item.id ? 'default' : 'ghost'}
                    className={cn(
                      'justify-start gap-2',
                      activeTab === item.id
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                    onClick={() => {
                      onTabChange(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </div>
            <div className="mt-3 sm:hidden">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="搜索股票代码/名称..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  className="w-full pl-9 h-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                {searchDropdown}
              </div>
            </div>
          </div>
        )}
      </div>
      <Sheet open={isAlertSheetOpen} onOpenChange={setIsAlertSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>预警通知</SheetTitle>
            <SheetDescription>
              {unreadAlertCount > 0 ? `当前有 ${unreadAlertCount} 条未读预警` : '当前没有未读预警'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 px-1 pb-6">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge variant="outline">智能选股</Badge>
                <span>定时扫描和手动扫描产生的新预警都会出现在这里</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleOpenScreenerFromAlert}>
                进入工作台
              </Button>
            </div>
            {unreadAlertLogs.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                暂无未读预警。后续新的扫描命中会自动在导航栏显示红点。
              </div>
            ) : (
              unreadAlertLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{log.alert_title ?? `${log.name ?? log.ts_code} 触发预警`}</div>
                      <div className="text-xs text-muted-foreground">{log.trade_date} · {log.ts_code}</div>
                      {log.alert_content && <div className="text-xs text-muted-foreground">{log.alert_content}</div>}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void handleMarkAlertRead(log.id)}>
                      已读
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
