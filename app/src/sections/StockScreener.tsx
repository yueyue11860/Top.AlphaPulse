import { lazy, Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn, formatLargeNumber, formatNumber, formatVolumeHand, getChangeColor } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { WatchlistToggleButton } from '@/components/stock/WatchlistToggleButton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { deleteStrategy, fetchStrategies, saveStrategy, updateStrategy } from '@/services/stockService';
import { generateScreenerDraft, } from '@/services/aiScreenerGateway';
import { runAlertScan } from '@/services/alertExecutionService';
import type { AIScreenerDraft } from '@/services/aiScreenerAssistant';
import { runQuickBacktest, type QuickBacktestResult } from '@/services/backtestService';
import {
  createAlertRule,
  createDefaultAlertRule,
  fetchBacktestDetail,
  fetchAlertRules,
  fetchRecentAlertLogs,
  fetchRecentBacktests,
  fetchRecentResultSnapshots,
  markAlertLogRead,
  saveQuickBacktestSummary,
  saveScreenerResultsSnapshot,
  type AlertType,
  updateAlertRuleStatus,
} from '@/services/stockPickerPersistenceService';
import {
  buildScreenerStrategyFilters,
  formatScreenerTradeDate,
  getUnsupportedScreenerFilters,
  parseScreenerStrategyConfig,
  runStockScreener,
  type ScreenerSortBy,
  type StockScreenerParams,
  type StockScreenerResultItem,
} from '@/services/screenerService';
import type {
  PickerAlertLogRow,
  PickerAlertRuleRow,
  PickerBacktestDailyRow,
  PickerBacktestRow,
  PickerBacktestTradeRow,
  PickerResultRow,
  PickerStrategyRow,
} from '@/types/database';
import {
  Filter,
  Search,
  Save,
  RotateCcw,
  TrendingUp,
  BarChart3,
  DollarSign,
  Activity,
  Brain,
  Bell,
  ExternalLink,
  Eye,
  Siren,
} from 'lucide-react';

const BacktestDetailCharts = lazy(() => import('@/components/stock/BacktestDetailCharts'));

interface FilterCondition {
  id: string;
  name: string;
  type: 'market' | 'price' | 'change' | 'volume' | 'technical' | 'fundamental' | 'capital';
  options?: { value: string; label: string }[];
}

const filterConditions: FilterCondition[] = [
  {
    id: 'market',
    name: '市场',
    type: 'market',
    options: [
      { value: 'all', label: '全部' },
      { value: 'sh', label: '沪市' },
      { value: 'sz', label: '深市' },
      { value: 'cy', label: '创业板' },
      { value: 'kc', label: '科创板' },
      { value: 'bj', label: '北交所' },
    ],
  },
];

const technicalConditions = [
  { id: 'macd_golden', name: 'MACD金叉', icon: Activity },
  { id: 'kdj_oversold', name: 'KDJ超卖', icon: TrendingUp },
  { id: 'ma_bull', name: '均线多头', icon: TrendingUp },
  { id: 'boll_break', name: '布林突破', icon: BarChart3 },
  { id: 'volume_burst', name: '放量上涨', icon: Activity },
  { id: 'break_high', name: '突破新高', icon: TrendingUp },
];

const fundamentalConditions = [
  { id: 'pe_low', name: 'PE<20', icon: DollarSign },
  { id: 'roe_high', name: 'ROE>15%', icon: BarChart3 },
  { id: 'growth', name: '净利润增长>20%', icon: TrendingUp },
  { id: 'low_debt', name: '负债率<50%', icon: Activity },
];

const capitalConditions = [
  { id: 'main_inflow', name: '主力净流入', icon: TrendingUp },
  { id: 'big_order', name: '大单占比>30%', icon: BarChart3 },
  { id: 'high_turnover', name: '换手率>5%', icon: Activity },
];

function parseNumericInput(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getResultScoreClass(score: number): string {
  if (score >= 90) return 'bg-red-100 text-red-700';
  if (score >= 80) return 'bg-yellow-100 text-yellow-700';
  return 'bg-blue-100 text-blue-700';
}

function getSelectedFilterCount(selectedFilters: string[], marketFilter: string, ranges: string[]): number {
  const rangeCount = ranges.filter((item) => item.trim()).length;
  return selectedFilters.length + (marketFilter !== 'all' ? 1 : 0) + rangeCount;
}

function summarizeAlertRule(rule: PickerAlertRuleRow): string {
  const condition = (rule.condition_config ?? {}) as Record<string, unknown>;
  const parts: string[] = [];

  if (condition.threshold !== null && condition.threshold !== undefined) {
    parts.push(`阈值 ${condition.threshold}`);
  }
  if (condition.rankThreshold !== null && condition.rankThreshold !== undefined) {
    parts.push(`排名前 ${condition.rankThreshold}`);
  }
  if (condition.lookbackDays !== null && condition.lookbackDays !== undefined) {
    parts.push(`回看 ${condition.lookbackDays} 天`);
  }
  if (condition.technicalSignal) {
    parts.push(`信号 ${String(condition.technicalSignal)}`);
  }

  return parts.length > 0 ? parts.join(' · ') : '默认条件';
}

export function StockScreener({ onSelectStock }: { onSelectStock?: (tsCode: string) => void }) {
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [marketFilter, setMarketFilter] = useState('all');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [changeRange, setChangeRange] = useState({ min: '', max: '' });
  const [volumeRange, setVolumeRange] = useState({ min: '', max: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<StockScreenerResultItem[]>([]);
  const [sortBy, setSortBy] = useState<ScreenerSortBy>('score');
  const [hasSearched, setHasSearched] = useState(false);
  const [latestTradeDate, setLatestTradeDate] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMockResult, setIsMockResult] = useState(false);
  const [savedStrategies, setSavedStrategies] = useState<PickerStrategyRow[]>([]);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);
  const [activeStrategyId, setActiveStrategyId] = useState<number | null>(null);
  const [activeStrategyName, setActiveStrategyName] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [lastAIDraft, setLastAIDraft] = useState<AIScreenerDraft | null>(null);
  const [backtestConfig, setBacktestConfig] = useState({ startDate: '2025-12-01', endDate: '2026-03-10', holdingDays: '5', topN: '5' });
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestResult, setBacktestResult] = useState<QuickBacktestResult | null>(null);
  const [resultSnapshots, setResultSnapshots] = useState<PickerResultRow[]>([]);
  const [backtestHistory, setBacktestHistory] = useState<PickerBacktestRow[]>([]);
  const [alertRules, setAlertRules] = useState<PickerAlertRuleRow[]>([]);
  const [alertLogs, setAlertLogs] = useState<PickerAlertLogRow[]>([]);
  const [isLoadingStrategyWorkspace, setIsLoadingStrategyWorkspace] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [isSubmittingAlertRule, setIsSubmittingAlertRule] = useState(false);
  const [alertForm, setAlertForm] = useState({
    name: '',
    alertType: 'new_match' as AlertType,
    threshold: '',
    rankThreshold: '',
    lookbackDays: '1',
    technicalSignal: 'macd_golden',
    checkInterval: '300',
    cooldown: '60',
    inApp: true,
  });
  const [selectedBacktest, setSelectedBacktest] = useState<PickerBacktestRow | null>(null);
  const [backtestTradeDetails, setBacktestTradeDetails] = useState<PickerBacktestTradeRow[]>([]);
  const [backtestDailyDetails, setBacktestDailyDetails] = useState<PickerBacktestDailyRow[]>([]);
  const [isLoadingBacktestDetail, setIsLoadingBacktestDetail] = useState(false);
  const [isRunningAlertScan, setIsRunningAlertScan] = useState(false);

  const buildCurrentParams = (): StockScreenerParams => ({
    market: marketFilter,
    priceMin: parseNumericInput(priceRange.min),
    priceMax: parseNumericInput(priceRange.max),
    changeMin: parseNumericInput(changeRange.min),
    changeMax: parseNumericInput(changeRange.max),
    volumeMin: parseNumericInput(volumeRange.min),
    volumeMax: parseNumericInput(volumeRange.max),
    selectedFilters,
    sortBy,
    limit: 50,
  });

  const applyParamsToState = (params: Partial<StockScreenerParams>) => {
    setMarketFilter(params.market ?? 'all');
    setPriceRange({
      min: params.priceMin !== undefined ? String(params.priceMin) : '',
      max: params.priceMax !== undefined ? String(params.priceMax) : '',
    });
    setChangeRange({
      min: params.changeMin !== undefined ? String(params.changeMin) : '',
      max: params.changeMax !== undefined ? String(params.changeMax) : '',
    });
    setVolumeRange({
      min: params.volumeMin !== undefined ? String(params.volumeMin) : '',
      max: params.volumeMax !== undefined ? String(params.volumeMax) : '',
    });
    setSelectedFilters(params.selectedFilters ?? []);
    setSortBy(params.sortBy ?? 'score');
  };

  const loadStrategyWorkspace = async (strategyId: number) => {
    setIsLoadingStrategyWorkspace(true);
    try {
      const [snapshots, backtests, rules, logs] = await Promise.all([
        fetchRecentResultSnapshots(strategyId),
        fetchRecentBacktests(strategyId),
        fetchAlertRules(strategyId),
        fetchRecentAlertLogs(strategyId),
      ]);
      setResultSnapshots(snapshots);
      setBacktestHistory(backtests);
      setAlertRules(rules);
      setAlertLogs(logs);
    } finally {
      setIsLoadingStrategyWorkspace(false);
    }
  };

  const clearStrategyWorkspace = () => {
    setResultSnapshots([]);
    setBacktestHistory([]);
    setAlertRules([]);
    setAlertLogs([]);
  };

  useEffect(() => {
    if (activeStrategyId === null) {
      clearStrategyWorkspace();
      return;
    }
    void loadStrategyWorkspace(activeStrategyId);
  }, [activeStrategyId]);

  const executeSearch = async (params: StockScreenerParams, strategyId: number | null = activeStrategyId) => {
    setIsSearching(true);
    setHasSearched(true);
    setErrorMessage(null);

    try {
      const response = await runStockScreener(params);

      setResults(response.items);
      setLatestTradeDate(formatScreenerTradeDate(response.latestTradeDate));
      setWarnings(response.warnings);
      setIsMockResult(response.isMock);

      if (strategyId !== null) {
        await saveScreenerResultsSnapshot({
          strategyId,
          tradeDate: response.latestTradeDate,
          items: response.items,
        });
        await loadStrategyWorkspace(strategyId);
      }

      if (response.items.length === 0) {
        toast.info('当前条件下未筛选到候选股票，可以适当放宽条件后重试。');
      } else if (getUnsupportedScreenerFilters(params.selectedFilters).length > 0) {
        toast.warning('部分条件因数据未接入被跳过，已在结果区给出说明。');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '智能选股执行失败，请稍后重试。';
      setResults([]);
      setWarnings([]);
      setIsMockResult(false);
      setErrorMessage(message);
      toast.error('智能选股执行失败');
    } finally {
      setIsSearching(false);
    }
  };

  const loadSavedStrategies = async () => {
    setIsLoadingStrategies(true);
    try {
      const data = await fetchStrategies();
      setSavedStrategies((data as PickerStrategyRow[]) || []);
    } finally {
      setIsLoadingStrategies(false);
    }
  };

  useEffect(() => {
    void loadSavedStrategies();
  }, []);

  const toggleFilter = (filterId: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId]
    );
  };

  const handleSearch = async () => {
    setActiveStrategyId(null);
    setActiveStrategyName(null);
    clearStrategyWorkspace();
    await executeSearch(buildCurrentParams(), null);
  };

  const handleSaveStrategy = async () => {
    const strategyFilters = buildScreenerStrategyFilters({
      market: marketFilter,
      priceMin: parseNumericInput(priceRange.min),
      priceMax: parseNumericInput(priceRange.max),
      changeMin: parseNumericInput(changeRange.min),
      changeMax: parseNumericInput(changeRange.max),
      volumeMin: parseNumericInput(volumeRange.min),
      volumeMax: parseNumericInput(volumeRange.max),
      selectedFilters,
      sortBy,
    });

    if (strategyFilters.length === 0) {
      toast.error('请先设置至少一个筛选条件，再保存策略。');
      return;
    }

    const suggestedName = selectedFilters.length > 0 ? `策略-${selectedFilters.length}条件组合` : '基础条件选股';
    const strategyName = window.prompt('请输入策略名称', suggestedName)?.trim();
    if (!strategyName) return;

    setIsSaving(true);

    try {
      await saveStrategy({
        name: strategyName,
        description: `智能选股页保存，排序方式：${sortBy === 'score' ? '综合评分' : '涨跌幅'}`,
        category: 'custom',
        filters: strategyFilters,
      });
      await loadSavedStrategies();
      toast.success('策略已保存，可作为后续回测和预警的基础。');
    } catch {
      toast.error('策略保存失败，请检查数据表和权限配置。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedFilters([]);
    setMarketFilter('all');
    setPriceRange({ min: '', max: '' });
    setChangeRange({ min: '', max: '' });
    setVolumeRange({ min: '', max: '' });
    setResults([]);
    setWarnings([]);
    setErrorMessage(null);
    setHasSearched(false);
    setLatestTradeDate(null);
    setIsMockResult(false);
    setActiveStrategyId(null);
    setActiveStrategyName(null);
    setLastAIDraft(null);
    clearStrategyWorkspace();
  };

  const handleApplyStrategy = async (strategy: PickerStrategyRow) => {
    const parsed = parseScreenerStrategyConfig(strategy);
    const params: StockScreenerParams = {
      ...parsed,
      sortBy,
      limit: 50,
    };

    applyParamsToState(params);
    setActiveStrategyId(strategy.id);
    setActiveStrategyName(strategy.name);
    toast.success(`已回填策略：${strategy.name}`);
    await executeSearch(params, strategy.id);
  };

  const handleAIGenerate = async () => {
    setIsGeneratingAI(true);
    try {
      const draft = await generateScreenerDraft(aiPrompt);
      setLastAIDraft(draft);

      const params: StockScreenerParams = {
        market: draft.params.market ?? 'all',
        priceMin: draft.params.priceMin,
        priceMax: draft.params.priceMax,
        changeMin: draft.params.changeMin,
        changeMax: draft.params.changeMax,
        volumeMin: draft.params.volumeMin,
        volumeMax: draft.params.volumeMax,
        selectedFilters: draft.params.selectedFilters ?? [],
        sortBy: draft.params.sortBy ?? 'score',
        limit: 50,
      };

      applyParamsToState(params);
      setActiveStrategyId(null);
      setActiveStrategyName(null);
      clearStrategyWorkspace();

      if (draft.warnings.length > 0) {
        toast.warning(draft.warnings[0]);
      }

      await executeSearch(params);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleRenameStrategy = async (strategy: PickerStrategyRow) => {
    const nextName = window.prompt('请输入新的策略名称', strategy.name)?.trim();
    if (!nextName || nextName === strategy.name) return;

    try {
      await updateStrategy(strategy.id, { name: nextName });
      if (activeStrategyId === strategy.id) {
        setActiveStrategyName(nextName);
      }
      await loadSavedStrategies();
      toast.success('策略名称已更新。');
    } catch {
      toast.error('策略重命名失败。');
    }
  };

  const handleDeleteStrategy = async (strategy: PickerStrategyRow) => {
    const confirmed = window.confirm(`确认删除策略“${strategy.name}”吗？`);
    if (!confirmed) return;

    try {
      await deleteStrategy(strategy.id);
      if (activeStrategyId === strategy.id) {
        setActiveStrategyId(null);
        setActiveStrategyName(null);
        clearStrategyWorkspace();
      }
      await loadSavedStrategies();
      toast.success('策略已删除。');
    } catch {
      toast.error('策略删除失败。');
    }
  };

  const handleQuickBacktest = async () => {
    setIsBacktesting(true);
    try {
      const result = await runQuickBacktest({
        strategy: buildCurrentParams(),
        startDate: backtestConfig.startDate,
        endDate: backtestConfig.endDate,
        holdingDays: Number(backtestConfig.holdingDays) || 5,
        topN: Number(backtestConfig.topN) || 5,
      });
      setBacktestResult(result);
      if (activeStrategyId !== null) {
        await saveQuickBacktestSummary({
          strategyId: activeStrategyId,
          startDate: backtestConfig.startDate,
          endDate: backtestConfig.endDate,
          holdingDays: Number(backtestConfig.holdingDays) || 5,
          topN: Number(backtestConfig.topN) || 5,
          result,
        });
        await loadStrategyWorkspace(activeStrategyId);
      }
      if (result.rebalanceCount === 0) {
        toast.info('该时间段内未生成可用回测样本，可以放宽条件或扩大区间。');
      }
    } catch {
      toast.error('快速回测执行失败。');
    } finally {
      setIsBacktesting(false);
    }
  };

  const activeConditionCount = getSelectedFilterCount(selectedFilters, marketFilter, [
    priceRange.min,
    priceRange.max,
    changeRange.min,
    changeRange.max,
    volumeRange.min,
    volumeRange.max,
  ]);
  const unsupportedSelectedFilters = getUnsupportedScreenerFilters(selectedFilters);
  const sortedResults = [...results].sort((left, right) => {
    if (sortBy === 'change') {
      return right.change - left.change || right.score - left.score;
    }
    return right.score - left.score || right.change - left.change;
  });

  const handleCreateAlertRule = async () => {
    if (activeStrategyId === null || !activeStrategyName) {
      toast.info('请先回填一个已保存策略，再创建预警规则。');
      return;
    }
    setAlertForm((prev) => ({
      ...prev,
      name: `${activeStrategyName}-${prev.alertType === 'new_match' ? '新命中提醒' : '规则提醒'}`,
    }));
    setIsAlertDialogOpen(true);
  };

  const handleToggleAlertRule = async (rule: PickerAlertRuleRow) => {
    const updated = await updateAlertRuleStatus(rule.id, !rule.is_active);
    if (!updated) {
      toast.error('预警规则更新失败。');
      return;
    }

    if (activeStrategyId !== null) {
      await loadStrategyWorkspace(activeStrategyId);
    }
  };

  const handleMarkAlertRead = async (log: PickerAlertLogRow) => {
    if (log.is_read) return;
    const updated = await markAlertLogRead(log.id);
    if (!updated) {
      toast.error('预警记录状态更新失败。');
      return;
    }

    if (activeStrategyId !== null) {
      await loadStrategyWorkspace(activeStrategyId);
    }
  };

  const handleCreateDefaultAlertRule = async () => {
    if (activeStrategyId === null || !activeStrategyName) return;

    const created = await createDefaultAlertRule(activeStrategyId, activeStrategyName);
    if (!created) {
      toast.error('默认预警创建失败。');
      return;
    }

    await loadStrategyWorkspace(activeStrategyId);
    toast.success('已创建默认新命中提醒。');
  };

  const handleSubmitAlertRule = async () => {
    if (activeStrategyId === null) return;
    if (!alertForm.name.trim()) {
      toast.error('请输入规则名称。');
      return;
    }

    setIsSubmittingAlertRule(true);
    try {
      const created = await createAlertRule({
        strategyId: activeStrategyId,
        name: alertForm.name.trim(),
        alertType: alertForm.alertType,
        threshold: parseNumericInput(alertForm.threshold),
        rankThreshold: parseNumericInput(alertForm.rankThreshold),
        lookbackDays: parseNumericInput(alertForm.lookbackDays),
        technicalSignal: alertForm.technicalSignal,
        checkInterval: parseNumericInput(alertForm.checkInterval),
        cooldown: parseNumericInput(alertForm.cooldown),
        inApp: alertForm.inApp,
      });

      if (!created) {
        toast.error('预警规则创建失败，请检查数据表和权限。');
        return;
      }

      await loadStrategyWorkspace(activeStrategyId);
      setIsAlertDialogOpen(false);
      toast.success('预警规则已创建。');
    } finally {
      setIsSubmittingAlertRule(false);
    }
  };

  const handleViewBacktestDetail = async (backtest: PickerBacktestRow) => {
    setSelectedBacktest(backtest);
    setIsLoadingBacktestDetail(true);
    try {
      const detail = await fetchBacktestDetail(backtest.id);
      setBacktestTradeDetails(detail.trades);
      setBacktestDailyDetails(detail.daily);
    } finally {
      setIsLoadingBacktestDetail(false);
    }
  };

  const groupedSnapshots = resultSnapshots.reduce<Record<string, PickerResultRow[]>>((acc, item) => {
    if (!acc[item.trade_date]) acc[item.trade_date] = [];
    acc[item.trade_date].push(item);
    return acc;
  }, {});
  const snapshotDates = Object.keys(groupedSnapshots).sort((left, right) => right.localeCompare(left));
  const latestSnapshotItems = snapshotDates[0] ? groupedSnapshots[snapshotDates[0]] : [];
  const previousSnapshotItems = snapshotDates[1] ? groupedSnapshots[snapshotDates[1]] : [];
  const latestSnapshotMap = new Map(latestSnapshotItems.map((item) => [item.ts_code, item]));
  const previousSnapshotMap = new Map(previousSnapshotItems.map((item) => [item.ts_code, item]));
  const addedSnapshotItems = latestSnapshotItems.filter((item) => !previousSnapshotMap.has(item.ts_code));
  const removedSnapshotItems = previousSnapshotItems.filter((item) => !latestSnapshotMap.has(item.ts_code));
  const stayedSnapshotCount = latestSnapshotItems.filter((item) => previousSnapshotMap.has(item.ts_code)).length;
  const changedReasonItems = latestSnapshotItems.flatMap((item) => {
    const previous = previousSnapshotMap.get(item.ts_code);
    if (!previous) return [];
    const latestMetadata = (item.metadata ?? {}) as Record<string, unknown>;
    const previousMetadata = (previous.metadata ?? {}) as Record<string, unknown>;
    const latestReasons = new Set((Array.isArray(latestMetadata.reasons) ? latestMetadata.reasons : []).map(String));
    const previousReasons = new Set((Array.isArray(previousMetadata.reasons) ? previousMetadata.reasons : []).map(String));
    const addedReasons = [...latestReasons].filter((reason) => !previousReasons.has(reason));
    const removedReasons = [...previousReasons].filter((reason) => !latestReasons.has(reason));
    const scoreDiff = (item.score ?? 0) - (previous.score ?? 0);
    if (addedReasons.length === 0 && removedReasons.length === 0 && scoreDiff === 0) return [];
    return [{
      code: item.ts_code,
      name: item.name ?? item.ts_code,
      addedReasons,
      removedReasons,
      scoreDiff,
      latestRank: item.rank_num,
      previousRank: previous.rank_num,
    }];
  });
  const backtestEquitySeries = backtestDailyDetails.map((item) => ({
    date: item.trade_date.slice(5),
    totalValue: Number(item.total_value.toFixed(2)),
    cumulativeReturn: Number(((item.cumulative_return ?? 0) * 100).toFixed(2)),
    drawdown: Number(((item.drawdown ?? 0) * 100).toFixed(2)),
  }));
  const cycleReturnSeries = backtestTradeDetails
    .filter((item) => item.action === 'SELL')
    .map((item) => {
      const buyTrade = backtestTradeDetails.find((trade) => trade.action === 'BUY' && trade.ts_code === item.ts_code && trade.trade_date <= item.trade_date);
      const returnPct = buyTrade ? ((item.price - buyTrade.price) / buyTrade.price) * 100 : 0;
      return {
        code: item.ts_code,
        name: item.name ?? item.ts_code,
        returnPct: Number(returnPct.toFixed(2)),
      };
    });

  const handleRunAlertScan = async () => {
    if (activeStrategyId === null) {
      toast.info('请先激活一个已保存策略。');
      return;
    }

    setIsRunningAlertScan(true);
    try {
      const result = await runAlertScan(activeStrategyId);
      await loadStrategyWorkspace(activeStrategyId);
      if (result.insertedLogs > 0) {
        toast.success(`本次扫描新增 ${result.insertedLogs} 条预警，命中 ${result.triggeredRules} 条规则。`);
      } else {
        toast.info(`已扫描 ${result.scannedRules} 条规则，当前没有新增预警。`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '预警扫描失败';
      toast.error(message);
    } finally {
      setIsRunningAlertScan(false);
    }
  };

  const renderLoadingState = () => (
    <Card className="p-4 bg-background border-border">
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-72" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderEmptyState = () => (
    <Card className="p-6 bg-background border-border">
      <div className="text-center space-y-2">
        <div className="text-lg font-semibold text-foreground">未筛选到候选股票</div>
        <div className="text-sm text-muted-foreground">
          当前条件组合较严格，建议先放宽涨跌幅、成交量或减少技术面约束后重试。
        </div>
      </div>
    </Card>
  );

  const renderErrorState = () => (
    <Card className="p-6 bg-background border-border">
      <div className="space-y-2">
        <div className="text-lg font-semibold text-foreground">选股执行失败</div>
        <div className="text-sm text-muted-foreground">{errorMessage}</div>
      </div>
    </Card>
  );

  const renderResults = () => (
    <Card className="p-4 bg-background border-border">
      <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            选股结果 <span className="text-sm text-muted-foreground">(共 {sortedResults.length} 只)</span>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {latestTradeDate && <span>交易日：{latestTradeDate}</span>}
            <span>启用条件：{activeConditionCount}</span>
            {isMockResult && <Badge variant="outline" className="border-amber-300 text-amber-600">模拟结果</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn('border-border text-muted-foreground hover:bg-muted', sortBy === 'change' && 'border-blue-500 text-blue-600')}
            onClick={() => setSortBy('change')}
          >
            按涨幅
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn('border-border text-muted-foreground hover:bg-muted', sortBy === 'score' && 'border-blue-500 text-blue-600')}
            onClick={() => setSortBy('score')}
          >
            按评分
          </Button>
        </div>
      </div>

      {(warnings.length > 0 || unsupportedSelectedFilters.length > 0) && (
        <div className="mb-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          {warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      )}

      <ScrollArea className="h-[28rem]">
        <div className="space-y-2">
          {sortedResults.map((stock, index) => (
            <div
              key={stock.code}
              className="rounded-lg border border-border bg-muted/50 p-3 transition-colors hover:bg-muted"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-3">
                  <span className={cn(
                    'mt-0.5 flex h-6 w-6 items-center justify-center rounded text-xs font-bold',
                    index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-background text-muted-foreground'
                  )}>
                    {index + 1}
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground">{stock.name}</div>
                      <Badge variant="outline" className="text-[11px]">{stock.industry}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{stock.code} · {stock.market}</div>
                    <div className="flex flex-wrap gap-1">
                      {stock.reasons.map((reason) => (
                        <Badge key={`${stock.code}-${reason}`} variant="secondary" className="text-[11px]">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                    {onSelectStock && (
                      <div className="pt-1 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="h-8 border-border text-muted-foreground hover:bg-muted" onClick={() => onSelectStock(stock.code)}>
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          查看详情
                        </Button>
                        <WatchlistToggleButton
                          tsCode={stock.code}
                          stockName={stock.name}
                          market={stock.market}
                          size="sm"
                          variant="outline"
                          showLabel
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 xl:flex xl:items-center xl:gap-6">
                  <div className="text-right">
                    <div className="text-muted-foreground">现价</div>
                    <div className="font-mono text-foreground">{formatNumber(stock.price)}</div>
                  </div>
                  <div className={cn('text-right font-mono', getChangeColor(stock.change))}>
                    <div className="text-muted-foreground">涨跌幅</div>
                    <div>{stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}%</div>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <div>成交量</div>
                    <div>{formatVolumeHand(stock.volume)}</div>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <div>总市值</div>
                    <div>{formatLargeNumber(stock.marketCap, 'wan')}</div>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <div>PE / PB</div>
                    <div>{stock.pe > 0 ? stock.pe.toFixed(1) : '--'} / {stock.pb > 0 ? stock.pb.toFixed(1) : '--'}</div>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <div>换手率</div>
                    <div>{stock.turnoverRate.toFixed(2)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">综合分</div>
                    <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold', getResultScoreClass(stock.score))}>
                      {stock.score}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <div className="rounded-md bg-background px-3 py-2">技术面 {stock.technicalScore}</div>
                <div className="rounded-md bg-background px-3 py-2">基本面 {stock.fundamentalScore}{stock.peForecast ? ` · 预测PE ${stock.peForecast.toFixed(1)}` : ''}</div>
                <div className="rounded-md bg-background px-3 py-2">资金面 {stock.capitalScore}</div>
              </div>
              {(stock.roe !== null || stock.profitYoy !== null || stock.debtToAssets !== null) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {stock.roe !== null && <Badge variant="outline">ROE {stock.roe.toFixed(1)}%</Badge>}
                  {stock.profitYoy !== null && <Badge variant="outline">利润同比 {stock.profitYoy.toFixed(1)}%</Badge>}
                  {stock.debtToAssets !== null && <Badge variant="outline">负债率 {stock.debtToAssets.toFixed(1)}%</Badge>}
                </div>
              )}
              {(stock.rating || stock.targetPrice || stock.epsForecast) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {stock.rating && <Badge variant="outline">研报评级 {stock.rating}</Badge>}
                  {stock.targetPrice && <Badge variant="outline">目标价 {stock.targetPrice.toFixed(2)}</Badge>}
                  {stock.epsForecast && <Badge variant="outline">EPS预测 {stock.epsForecast.toFixed(2)}</Badge>}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-foreground">智能选股</h2>
          <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-600 text-xs">MVP</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 border-border text-muted-foreground hover:bg-muted"
            onClick={handleSaveStrategy}
            disabled={isSaving}
          >
            <Save className="w-4 h-4" />
            {isSaving ? '保存中...' : '保存策略'}
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-background border-border">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-foreground">AI 辅助生成条件</h3>
          <span className="text-xs text-muted-foreground">当前为模型优先、规则回退模式，未配置网关时自动降级</span>
        </div>
        <div className="space-y-3">
          <Textarea
            placeholder="例如：找创业板里主力净流入、放量突破、PE 不高、适合短线的股票"
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            className="min-h-20"
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleAIGenerate} disabled={isGeneratingAI || !aiPrompt.trim()} className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
              {isGeneratingAI ? '生成中...' : '生成条件并执行'}
            </Button>
            <span className="text-xs text-muted-foreground">支持识别市场、低估值、主力流入、放量、突破、趋势、超卖、价格和涨幅区间</span>
          </div>
          {lastAIDraft && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="font-medium text-foreground">{lastAIDraft.title}</div>
                <Badge variant="outline" className="text-[11px]">{lastAIDraft.source === 'model' ? '模型输出' : '本地回退'}</Badge>
              </div>
              {lastAIDraft.explanations.length > 0 && (
                <div className="mt-2 space-y-1 text-muted-foreground">
                  {lastAIDraft.explanations.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              )}
              {lastAIDraft.warnings.length > 0 && (
                <div className="mt-2 space-y-1 text-amber-600 dark:text-amber-300">
                  {lastAIDraft.warnings.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4 bg-background border-border">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">已保存策略</h3>
            <div className="text-xs text-muted-foreground">支持一键回填并直接执行，便于后续做回测和预警</div>
          </div>
          <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted" onClick={() => void loadSavedStrategies()} disabled={isLoadingStrategies}>
            刷新列表
          </Button>
        </div>
        {isLoadingStrategies ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : savedStrategies.length === 0 ? (
          <div className="text-sm text-muted-foreground">暂无已保存策略。你可以先设置条件后点击“保存策略”。</div>
        ) : (
          <div className="space-y-2">
            {savedStrategies.slice(0, 6).map((strategy) => {
              const parsed = parseScreenerStrategyConfig(strategy);
              const filterCount = parsed.selectedFilters.length + (parsed.market !== 'all' ? 1 : 0) + [parsed.priceMin, parsed.priceMax, parsed.changeMin, parsed.changeMax, parsed.volumeMin, parsed.volumeMax].filter((item) => item !== undefined).length;
              return (
                <div key={strategy.id} className={cn('flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-center lg:justify-between', activeStrategyId === strategy.id ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/10' : 'border-border bg-muted/30')}>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground">{strategy.name}</div>
                      <Badge variant="outline" className="text-[11px]">{strategy.category}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{strategy.description || '无描述'} · 条件数 {filterCount} · 更新时间 {strategy.updated_at.slice(0, 10)}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted" onClick={() => void handleApplyStrategy(strategy)}>
                      回填并执行
                    </Button>
                    <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted" onClick={() => void handleRenameStrategy(strategy)}>
                      改名
                    </Button>
                    <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/20" onClick={() => void handleDeleteStrategy(strategy)}>
                      删除
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {activeStrategyId !== null && activeStrategyName && (
        <Card className="p-4 bg-background border-border">
          <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-foreground">策略工作台</h3>
                <Badge variant="outline" className="text-[11px]">{activeStrategyName}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">查看最近落库结果、快速回测历史和应用内预警状态</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted" onClick={() => void loadStrategyWorkspace(activeStrategyId)}>
                刷新工作台
              </Button>
              <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted" onClick={() => void handleRunAlertScan()} disabled={isRunningAlertScan}>
                <Siren className="mr-1 h-3.5 w-3.5" />
                {isRunningAlertScan ? '扫描中...' : '立即扫描'}
              </Button>
              <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted" onClick={() => void handleCreateDefaultAlertRule()}>
                默认预警
              </Button>
              <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted" onClick={() => void handleCreateAlertRule()}>
                新建预警
              </Button>
            </div>
          </div>

          {isLoadingStrategyWorkspace ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-40 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-medium text-foreground">最近结果快照</div>
                  <span className="text-xs text-muted-foreground">{resultSnapshots.length} 条</span>
                </div>
                {snapshotDates.length >= 2 && (
                  <div className="mb-3 rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
                    <div>{snapshotDates[0]} 对比 {snapshotDates[1]}</div>
                    <div className="mt-1 flex flex-wrap gap-3">
                      <span>新增 {addedSnapshotItems.length}</span>
                      <span>剔除 {removedSnapshotItems.length}</span>
                      <span>延续 {stayedSnapshotCount}</span>
                    </div>
                    {(addedSnapshotItems.length > 0 || removedSnapshotItems.length > 0) && (
                      <div className="mt-2 space-y-1">
                        {addedSnapshotItems.slice(0, 3).map((item) => (
                          <div key={`added-${item.ts_code}`} className="text-emerald-600 dark:text-emerald-300">新增: {item.name ?? item.ts_code}</div>
                        ))}
                        {removedSnapshotItems.slice(0, 3).map((item) => (
                          <div key={`removed-${item.ts_code}`} className="text-rose-600 dark:text-rose-300">剔除: {item.name ?? item.ts_code}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {changedReasonItems.length > 0 && (
                  <div className="mb-3 rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">原因变化</div>
                    <div className="mt-2 space-y-2">
                      {changedReasonItems.slice(0, 4).map((item) => (
                        <div key={`reason-${item.code}`} className="rounded-md border border-border px-2 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-foreground">{item.name}</div>
                            <div className={cn('text-xs', item.scoreDiff >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300')}>
                              分数 {item.scoreDiff >= 0 ? '+' : ''}{item.scoreDiff.toFixed(0)}
                            </div>
                          </div>
                          <div className="mt-1">排名 {item.previousRank ?? '--'}{' -> '}{item.latestRank ?? '--'}</div>
                          {item.addedReasons.length > 0 && <div className="mt-1 text-emerald-600 dark:text-emerald-300">新增因子: {item.addedReasons.join('、')}</div>}
                          {item.removedReasons.length > 0 && <div className="mt-1 text-rose-600 dark:text-rose-300">消失因子: {item.removedReasons.join('、')}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  {resultSnapshots.length === 0 ? (
                    <div className="text-muted-foreground">暂无快照。回填策略并执行后会自动保存。</div>
                  ) : resultSnapshots.slice(0, 6).map((item) => (
                    <div key={`${item.trade_date}-${item.ts_code}-${item.rank_num}`} className="rounded-md bg-background px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">#{item.rank_num ?? '--'} {item.name ?? item.ts_code}</div>
                          <div className="text-xs text-muted-foreground">{item.trade_date} · {item.ts_code}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-foreground">{item.score?.toFixed(0) ?? '--'} 分</div>
                          <div className={cn('text-xs', getChangeColor(item.pct_chg ?? 0))}>{(item.pct_chg ?? 0) > 0 ? '+' : ''}{(item.pct_chg ?? 0).toFixed(2)}%</div>
                        </div>
                      </div>
                      {onSelectStock && (
                        <div className="mt-2">
                          <Button variant="outline" size="sm" className="h-7 border-border text-muted-foreground hover:bg-muted" onClick={() => onSelectStock(item.ts_code)}>
                            查看详情
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-medium text-foreground">最近回测记录</div>
                  <span className="text-xs text-muted-foreground">{backtestHistory.length} 条</span>
                </div>
                <div className="space-y-2 text-sm">
                  {backtestHistory.length === 0 ? (
                    <div className="text-muted-foreground">暂无回测记录。激活策略后执行快速回测会自动落库。</div>
                  ) : backtestHistory.map((item) => (
                    <div key={item.id} className="rounded-md bg-background px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">{item.start_date}{' -> '}{item.end_date}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            总收益 {((item.total_return ?? 0) * 100).toFixed(2)}% · 夏普 {(item.sharpe_ratio ?? 0).toFixed(2)} · 最大回撤 {((item.max_drawdown ?? 0) * 100).toFixed(2)}%
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{item.created_at.slice(0, 16).replace('T', ' ')}</div>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 border-border text-muted-foreground hover:bg-muted" onClick={() => void handleViewBacktestDetail(item)}>
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          明细
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-medium text-foreground">预警规则</div>
                    <span className="text-xs text-muted-foreground">{alertRules.length} 条</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {alertRules.length === 0 ? (
                      <div className="text-muted-foreground">暂无预警规则。可以先创建默认新命中提醒。</div>
                    ) : alertRules.map((rule) => (
                      <div key={rule.id} className="rounded-md bg-background px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{rule.name}</div>
                            <div className="text-xs text-muted-foreground">类型 {rule.alert_type} · 触发 {rule.trigger_count} 次</div>
                            <div className="mt-1 text-xs text-muted-foreground">{summarizeAlertRule(rule)}</div>
                          </div>
                          <Button variant="outline" size="sm" className="h-7 border-border text-muted-foreground hover:bg-muted" onClick={() => void handleToggleAlertRule(rule)}>
                            {rule.is_active ? '停用' : '启用'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-medium text-foreground">最近预警</div>
                    <span className="text-xs text-muted-foreground">{alertLogs.length} 条</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {alertLogs.length === 0 ? (
                      <div className="text-muted-foreground">暂无预警日志。等规则跑出命中后会在这里展示。</div>
                    ) : alertLogs.map((log) => (
                      <div key={log.id} className={cn('rounded-md px-3 py-2', log.is_read ? 'bg-background' : 'bg-blue-50 dark:bg-blue-950/20')}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{log.alert_title ?? `${log.name ?? log.ts_code} 触发预警`}</div>
                            <div className="text-xs text-muted-foreground">{log.trade_date} · {log.ts_code}</div>
                          </div>
                          {!log.is_read && (
                            <Button variant="outline" size="sm" className="h-7 border-border text-muted-foreground hover:bg-muted" onClick={() => void handleMarkAlertRead(log)}>
                              标为已读
                            </Button>
                          )}
                        </div>
                        {log.alert_content && <div className="mt-1 text-xs text-muted-foreground">{log.alert_content}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4 bg-background border-border">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">快速回测入口</h3>
            <div className="text-xs text-muted-foreground">按当前选股条件做轻量历史回放，观察平均收益和胜率</div>
          </div>
          <Button onClick={handleQuickBacktest} disabled={isBacktesting} className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
            {isBacktesting ? '回测中...' : '执行快速回测'}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input type="date" value={backtestConfig.startDate} onChange={(event) => setBacktestConfig((prev) => ({ ...prev, startDate: event.target.value }))} />
          <Input type="date" value={backtestConfig.endDate} onChange={(event) => setBacktestConfig((prev) => ({ ...prev, endDate: event.target.value }))} />
          <Input type="number" placeholder="持有天数" value={backtestConfig.holdingDays} onChange={(event) => setBacktestConfig((prev) => ({ ...prev, holdingDays: event.target.value }))} />
          <Input type="number" placeholder="每次取前 N 只" value={backtestConfig.topN} onChange={(event) => setBacktestConfig((prev) => ({ ...prev, topN: event.target.value }))} />
        </div>
        {backtestResult && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
              <div className="rounded-lg bg-muted/40 p-3">回放次数 {backtestResult.rebalanceCount}</div>
              <div className="rounded-lg bg-muted/40 p-3">总样本 {backtestResult.totalSignals}</div>
              <div className="rounded-lg bg-muted/40 p-3">平均收益 {backtestResult.averageReturn.toFixed(2)}%</div>
              <div className="rounded-lg bg-muted/40 p-3">胜率 {backtestResult.winRate.toFixed(1)}%</div>
              <div className="rounded-lg bg-muted/40 p-3">最好/最差 {backtestResult.bestReturn.toFixed(2)}% / {backtestResult.worstReturn.toFixed(2)}%</div>
            </div>
            <div className="space-y-2">
              {backtestResult.trades.slice(0, 6).map((trade) => (
                <div key={`${trade.entryDate}-${trade.exitDate}`} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <div className="font-medium text-foreground">{trade.entryDate}{' -> '}{trade.exitDate}</div>
                  <div className="mt-1 text-muted-foreground">样本 {trade.sampleSize} · 平均收益 {trade.averageReturn.toFixed(2)}% · 最优 {trade.bestReturn.toFixed(2)}% · 最差 {trade.worstReturn.toFixed(2)}%{trade.topStock ? ` · 当期首位 ${trade.topStock}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-background border-border">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">筛选条件</h3>
          <span className="text-xs text-muted-foreground">当前已接入真实价格、涨跌幅、成交量、技术近似指标、资金流、PE/PB、研报预测以及可选财务表字段</span>
        </div>

        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2">市场</div>
          <div className="flex flex-wrap gap-2">
            {filterConditions[0].options?.map((option) => (
              <Button
                key={option.value}
                variant={marketFilter === option.value ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'text-xs',
                  marketFilter === option.value
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
                onClick={() => setMarketFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2">价格区间</div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="最低价"
              value={priceRange.min}
              onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
              className="w-24 h-8 bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="最高价"
              value={priceRange.max}
              onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
              className="w-24 h-8 bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2">涨跌幅</div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="最小%"
              value={changeRange.min}
              onChange={(e) => setChangeRange({ ...changeRange, min: e.target.value })}
              className="w-24 h-8 bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
            />
            <span className="text-muted-foreground">%</span>
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="最大%"
              value={changeRange.max}
              onChange={(e) => setChangeRange({ ...changeRange, max: e.target.value })}
              className="w-24 h-8 bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
            />
            <span className="text-muted-foreground">%</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2">成交量</div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="最小手数"
              value={volumeRange.min}
              onChange={(e) => setVolumeRange({ ...volumeRange, min: e.target.value })}
              className="w-28 h-8 bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="最大手数"
              value={volumeRange.max}
              onChange={(e) => setVolumeRange({ ...volumeRange, max: e.target.value })}
              className="w-28 h-8 bg-background border-border text-foreground text-sm placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2">技术指标</div>
          <div className="flex flex-wrap gap-2">
            {technicalConditions.map((condition) => {
              const Icon = condition.icon;
              return (
                <Badge
                  key={condition.id}
                  variant={selectedFilters.includes(condition.id) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer gap-1 py-1.5 px-2',
                    selectedFilters.includes(condition.id)
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                  onClick={() => toggleFilter(condition.id)}
                >
                  <Icon className="w-3 h-3" />
                  {condition.name}
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2">基本面</div>
          <div className="flex flex-wrap gap-2">
            {fundamentalConditions.map((condition) => {
              const Icon = condition.icon;
              return (
                <Badge
                  key={condition.id}
                  variant={selectedFilters.includes(condition.id) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer gap-1 py-1.5 px-2',
                    selectedFilters.includes(condition.id)
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                  onClick={() => toggleFilter(condition.id)}
                >
                  <Icon className="w-3 h-3" />
                  {condition.name}
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2">资金面</div>
          <div className="flex flex-wrap gap-2">
            {capitalConditions.map((condition) => {
              const Icon = condition.icon;
              return (
                <Badge
                  key={condition.id}
                  variant={selectedFilters.includes(condition.id) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer gap-1 py-1.5 px-2',
                    selectedFilters.includes(condition.id)
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'border-border text-muted-foreground hover:text-white hover:bg-secondary'
                  )}
                  onClick={() => toggleFilter(condition.id)}
                >
                  <Icon className="w-3 h-3" />
                  {condition.name}
                </Badge>
              );
            })}
          </div>
        </div>

        {unsupportedSelectedFilters.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            当前仍有部分筛选条件依赖的数据源未完全就绪，系统会自动降级并在结果区提示具体原因。
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={handleSearch}
            disabled={isSearching}
          >
            <Search className="w-4 h-4 mr-1" />
            {isSearching ? '搜索中...' : '开始选股'}
          </Button>
          <Button variant="outline" onClick={handleReset} className="border-border text-muted-foreground hover:bg-muted">
            <RotateCcw className="w-4 h-4 mr-1" />
            重置
          </Button>
        </div>
      </Card>

      {isSearching && renderLoadingState()}
      {!isSearching && errorMessage && renderErrorState()}
      {!isSearching && !errorMessage && hasSearched && sortedResults.length === 0 && renderEmptyState()}
      {!isSearching && !errorMessage && sortedResults.length > 0 && renderResults()}

      <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>新建预警规则</DialogTitle>
            <DialogDescription>为当前激活策略配置应用内预警条件。</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <div className="text-sm text-muted-foreground">规则名称</div>
              <Input value={alertForm.name} onChange={(event) => setAlertForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="例如：评分突破提醒" />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">预警类型</div>
              <Select value={alertForm.alertType} onValueChange={(value) => setAlertForm((prev) => ({ ...prev, alertType: value as AlertType }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择预警类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_match">新命中</SelectItem>
                  <SelectItem value="score_change">评分变化</SelectItem>
                  <SelectItem value="price_threshold">价格阈值</SelectItem>
                  <SelectItem value="technical_signal">技术信号</SelectItem>
                  <SelectItem value="volume_spike">成交量放大</SelectItem>
                  <SelectItem value="rank_change">排名变化</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">回看天数</div>
              <Input type="number" value={alertForm.lookbackDays} onChange={(event) => setAlertForm((prev) => ({ ...prev, lookbackDays: event.target.value }))} />
            </div>
            {(alertForm.alertType === 'score_change' || alertForm.alertType === 'price_threshold' || alertForm.alertType === 'volume_spike') && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">阈值</div>
                <Input type="number" value={alertForm.threshold} onChange={(event) => setAlertForm((prev) => ({ ...prev, threshold: event.target.value }))} placeholder="例如：5" />
              </div>
            )}
            {alertForm.alertType === 'rank_change' && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">排名阈值</div>
                <Input type="number" value={alertForm.rankThreshold} onChange={(event) => setAlertForm((prev) => ({ ...prev, rankThreshold: event.target.value }))} placeholder="例如：10" />
              </div>
            )}
            {alertForm.alertType === 'technical_signal' && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">技术信号</div>
                <Select value={alertForm.technicalSignal} onValueChange={(value) => setAlertForm((prev) => ({ ...prev, technicalSignal: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择技术信号" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="macd_golden">MACD金叉</SelectItem>
                    <SelectItem value="kdj_oversold">KDJ超卖</SelectItem>
                    <SelectItem value="ma_bull">均线多头</SelectItem>
                    <SelectItem value="boll_break">布林突破</SelectItem>
                    <SelectItem value="volume_burst">放量上涨</SelectItem>
                    <SelectItem value="break_high">突破新高</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">检查间隔（秒）</div>
              <Input type="number" value={alertForm.checkInterval} onChange={(event) => setAlertForm((prev) => ({ ...prev, checkInterval: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">冷却时间（分钟）</div>
              <Input type="number" value={alertForm.cooldown} onChange={(event) => setAlertForm((prev) => ({ ...prev, cooldown: event.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 md:col-span-2">
              <div>
                <div className="text-sm text-foreground">应用内提醒</div>
                <div className="text-xs text-muted-foreground">当前默认只启用站内提醒</div>
              </div>
              <Switch checked={alertForm.inApp} onCheckedChange={(checked) => setAlertForm((prev) => ({ ...prev, inApp: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAlertDialogOpen(false)} className="border-border text-muted-foreground hover:bg-muted">取消</Button>
            <Button onClick={() => void handleSubmitAlertRule()} disabled={isSubmittingAlertRule} className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
              {isSubmittingAlertRule ? '提交中...' : '创建规则'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedBacktest !== null} onOpenChange={(open) => {
        if (!open) {
          setSelectedBacktest(null);
          setBacktestTradeDetails([]);
          setBacktestDailyDetails([]);
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>回测明细</DialogTitle>
            <DialogDescription>
              {selectedBacktest ? `${selectedBacktest.start_date} -> ${selectedBacktest.end_date}` : '查看选股回测的交易与净值变化'}
            </DialogDescription>
          </DialogHeader>
          {isLoadingBacktestDetail ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                <div className="rounded-lg bg-muted/40 p-3">交易笔数 {backtestTradeDetails.length}</div>
                <div className="rounded-lg bg-muted/40 p-3">净值点数 {backtestDailyDetails.length}</div>
                <div className="rounded-lg bg-muted/40 p-3">平均卖出收益 {cycleReturnSeries.length > 0 ? (cycleReturnSeries.reduce((sum, item) => sum + item.returnPct, 0) / cycleReturnSeries.length).toFixed(2) : '0.00'}%</div>
                <div className="rounded-lg bg-muted/40 p-3">胜率 {cycleReturnSeries.length > 0 ? ((cycleReturnSeries.filter((item) => item.returnPct > 0).length / cycleReturnSeries.length) * 100).toFixed(1) : '0.0'}%</div>
              </div>
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <BacktestDetailCharts
                  equitySeries={backtestEquitySeries}
                  cycleReturnSeries={cycleReturnSeries}
                />
              </Suspense>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-3 font-medium text-foreground">交易记录</div>
                <ScrollArea className="h-72">
                  <div className="space-y-2 text-sm">
                    {backtestTradeDetails.length === 0 ? (
                      <div className="text-muted-foreground">暂无交易明细。若历史记录早于本次升级，可能只有汇总数据。</div>
                    ) : backtestTradeDetails.map((item) => (
                      <div key={item.id} className="rounded-md bg-background px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{item.name ?? item.ts_code} · {item.action}</div>
                            <div className="text-xs text-muted-foreground">{item.trade_date} · {item.ts_code}</div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <div>价格 {item.price.toFixed(2)}</div>
                            <div>数量 {item.shares}</div>
                          </div>
                        </div>
                        {item.reason && <div className="mt-1 text-xs text-muted-foreground">{item.reason}</div>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-3 font-medium text-foreground">净值轨迹</div>
                <ScrollArea className="h-72">
                  <div className="space-y-2 text-sm">
                    {backtestDailyDetails.length === 0 ? (
                      <div className="text-muted-foreground">暂无净值明细。后续新生成的回测会自动带上每日轨迹。</div>
                    ) : backtestDailyDetails.map((item) => (
                      <div key={item.id} className="rounded-md bg-background px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{item.trade_date}</div>
                            <div className="text-xs text-muted-foreground">持仓 {item.position_count ?? 0} 只</div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <div>总资产 {item.total_value.toFixed(2)}</div>
                            <div>累计 {((item.cumulative_return ?? 0) * 100).toFixed(2)}%</div>
                            <div>回撤 {((item.drawdown ?? 0) * 100).toFixed(2)}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
