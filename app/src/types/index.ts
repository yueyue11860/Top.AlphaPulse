// 股票基础信息
export interface StockBasic {
  ts_code: string;
  symbol: string;
  name: string;
  industry: string;
  market: string;
  list_date: string;
}

// 日线数据
export interface DailyData {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pre_close: number;
  change: number;
  pct_chg: number;
  vol: number;
  amount: number;
}

// 指数数据
export interface IndexData {
  code: string;
  name: string;
  current: number;
  change: number;
  pct_change: number;
  volume: number;
  amount: number;
  high: number;
  low: number;
  open: number;
  pre_close: number;
  volume_ratio?: number; // 量比
}

// 板块数据
export interface SectorData {
  ts_code: string;
  name: string;
  pct_change: number;
  volume: number;
  amount: number;
  up_count: number;
  down_count: number;
  limit_up_count: number;
  net_inflow: number;
  heat_score: number;
  turnover_rate?: number; // 换手率
}

// 资金流向
export interface MoneyFlowData {
  ts_code: string;
  trade_date: string;
  net_mf_amount: number;
  buy_sm_amount: number;
  sell_sm_amount: number;
  buy_md_amount: number;
  sell_md_amount: number;
  buy_lg_amount: number;
  sell_lg_amount: number;
  buy_elg_amount: number;
  sell_elg_amount: number;
}

// 涨跌停数据
export interface LimitUpData {
  ts_code: string;
  name: string;
  trade_date: string;
  close: number;
  pct_chg: number;
  limit_amount: number;
  first_time: string;
  last_time: string;
  open_times: number;
  limit_times: number;
  tag: string;
  theme: string;
}

// 技术指标
export interface TechnicalIndicator {
  ts_code: string;
  trade_date: string;
  macd_dif: number;
  macd_dea: number;
  macd: number;
  kdj_k: number;
  kdj_d: number;
  kdj_j: number;
  rsi_6: number;
  rsi_12: number;
  rsi_24: number;
  boll_upper: number;
  boll_mid: number;
  boll_lower: number;
}

// 新闻资讯
export interface NewsItem {
  id: string;
  title: string;
  content: string;
  source: string;
  publish_time: string;
  importance: 'high' | 'normal' | 'low';
  related_stocks: string[];
  category: string;
}

// 实时快讯（来自多平台聚合）
export interface FlashNewsItem {
  id: string;
  title: string;
  content: string;
  source: string;      // 来源平台：财联社、东方财富、金十数据等
  sourceKey: string;   // 来源表标识
  display_time: number; // Unix 时间戳
  time: string;        // 格式化后的时间 HH:mm
  date: string;        // 格式化后的日期 MM-DD
  importance: 'urgent' | 'high' | 'normal';
  categories: string[];  // 内容分类标签
  images?: string[];
}

export type ContentImportance = 'urgent' | 'high' | 'normal' | 'low';

export interface StockReference {
  ts_code: string;
  stock_name: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type AnnouncementDateRange = '7d' | '30d' | '90d' | 'all';

export interface AnnouncementItem extends StockReference {
  ann_id: string;
  title: string;
  ann_type: string;
  ann_sub_type?: string | null;
  ann_date: string;
  importance: ContentImportance;
  source?: string | null;
  file_url?: string | null;
  summary?: string | null;
}

export interface AnnouncementDetail extends AnnouncementItem {
  content?: string | null;
  related_anns?: string[];
}

export interface AnnouncementQuery {
  keyword?: string;
  stockCode?: string;
  annType?: string;
  importance?: ContentImportance | 'all';
  hasAttachment?: boolean;
  dateRange?: AnnouncementDateRange;
  page?: number;
  pageSize?: number;
}

export type ResearchRating = '买入' | '增持' | '持有' | '减持' | '卖出' | '推荐';
export type RatingChange = '升级' | '维持' | '下调' | '首次覆盖';
export type ResearchReportType = '个股' | '行业' | '策略' | '宏观';
export type ResearchDateRange = AnnouncementDateRange;

export interface ResearchReportItem extends Partial<StockReference> {
  report_id: string;
  title: string;
  summary?: string | null;
  org_name?: string | null;
  author?: string | null;
  rating?: ResearchRating | null;
  rating_change?: RatingChange | null;
  target_price?: number | null;
  report_type?: ResearchReportType | null;
  report_date: string;
  industry?: string | null;
  file_url?: string | null;
  read_count?: number | null;
}

export interface ResearchReportDetail extends ResearchReportItem {
  pre_rating?: string | null;
  pre_target_price?: number | null;
  eps_forecast?: number | null;
  pe_forecast?: number | null;
  pages?: number | null;
  download_count?: number | null;
}

export interface ResearchReportQuery {
  keyword?: string;
  stockCode?: string;
  orgName?: string;
  author?: string;
  rating?: ResearchRating | 'all';
  reportType?: ResearchReportType | 'all';
  dateRange?: ResearchDateRange;
  page?: number;
  pageSize?: number;
}

export type CalendarEventType = '财报披露' | '股东大会' | '新股申购' | '宏观数据' | '解禁预告' | '融资融券' | '其他';
export type CalendarEventStatus = 'upcoming' | 'ongoing' | 'done';
export type CalendarDateRange = 'today' | '7d' | '30d' | 'all';

export interface FinanceCalendarEvent extends Partial<StockReference> {
  event_id: string;
  event_type: CalendarEventType | string;
  event_name: string;
  event_desc?: string | null;
  event_date: string;
  event_time?: string | null;
  importance: ContentImportance;
  status: CalendarEventStatus;
  extra_data?: Record<string, unknown> | null;
}

export interface FinanceCalendarQuery {
  keyword?: string;
  stockCode?: string;
  eventType?: CalendarEventType | 'all';
  status?: CalendarEventStatus | 'all';
  importance?: ContentImportance | 'all';
  dateRange?: CalendarDateRange;
  page?: number;
  pageSize?: number;
}

// 新闻源配置
export interface NewsSource {
  key: string;         // 表名标识
  name: string;        // 中文名称
  tableName: string;   // 数据库表名
  color: string;       // 主题色
}

// 选股条件
export interface StockFilter {
  field: string;
  operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  value: any;
  value2?: any;
}

// 选股策略
export interface StockStrategy {
  id: string;
  name: string;
  description: string;
  filters: StockFilter[];
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// AI分析结果
export interface AIAnalysisResult {
  overall_score: number;
  overall_rating: string;
  technical_analysis: {
    score: number;
    summary: string;
    key_signals: string[];
  };
  fundamental_analysis: {
    score: number;
    summary: string;
    strengths: string[];
    concerns: string[];
  };
  capital_analysis: {
    score: number;
    summary: string;
    flow_trend: string;
  };
  confidence_level: number;
}

// 市场情绪
export interface MarketSentiment {
  overall: number;
  label: string;
  up_down_ratio: number;
  avg_change: number;
  limit_up_success_rate: number;
}

// 开盘啦题材数据
export interface KplConceptData {
  ts_code: string;
  name: string;
  limit_up_count: number;
  up_count: number;
  trade_date?: string;
  heat_score?: number;
  leading_stock?: string;
  leading_change?: number;
}
