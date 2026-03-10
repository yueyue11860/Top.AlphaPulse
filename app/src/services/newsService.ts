import {
  requestWithCache,
  stableStringify,
  supabaseNews,
  logger,
} from './serviceUtils';
import {
  NEWS_SOURCES,
  fetchRealTimeNews,
  fetchNewsBySource,
} from './stockService';
import type {
  AnnouncementDetail,
  AnnouncementItem,
  AnnouncementQuery,
  ContentImportance,
  FinanceCalendarEvent,
  FinanceCalendarQuery,
  PaginatedResult,
  ResearchReportDetail,
  ResearchReportItem,
  ResearchReportQuery,
} from '@/types';
import type {
  AnnouncementRow,
  FinanceCalendarRow,
  ResearchReportRow,
} from '@/types/database';

function mapImportance(value: number | string | null | undefined): ContentImportance {
  if (value === 'urgent' || value === 'high' || value === 'normal' || value === 'low') {
    return value;
  }

  switch (value) {
    case 1:
      return 'urgent';
    case 2:
      return 'high';
    case 4:
      return 'low';
    case 3:
    default:
      return 'normal';
  }
}

function mapCalendarStatus(value: number | string | null | undefined): 'upcoming' | 'ongoing' | 'done' {
  if (value === 'upcoming' || value === 'ongoing' || value === 'done') {
    return value;
  }

  switch (value) {
    case 1:
      return 'ongoing';
    case 2:
      return 'done';
    case 0:
    default:
      return 'upcoming';
  }
}

function getDateFromRange(range: 'today' | '7d' | '30d' | '90d' | 'all' | undefined): string | null {
  if (!range || range === 'all') return null;

  const now = new Date();
  const days = range === 'today' ? 0 : Number(range.replace('d', '')) - 1;
  now.setDate(now.getDate() - days);
  return now.toISOString().slice(0, 10);
}

function escapeKeyword(keyword: string): string {
  return keyword.replace(/[%(),]/g, ' ').trim();
}

function mapAnnouncement(row: AnnouncementRow): AnnouncementItem {
  return {
    ann_id: row.ann_id,
    ts_code: row.ts_code,
    stock_name: row.stock_name || '--',
    title: row.title,
    ann_type: row.ann_type || '其他公告',
    ann_sub_type: row.ann_sub_type,
    ann_date: row.ann_date,
    importance: mapImportance(row.importance),
    source: row.source,
    file_url: row.file_url,
    summary: row.summary,
  };
}

function mapResearchReport(row: ResearchReportRow): ResearchReportItem {
  return {
    report_id: row.report_id,
    title: row.title,
    summary: row.summary,
    org_name: row.org_name,
    author: row.author,
    rating: row.rating as ResearchReportItem['rating'],
    rating_change: row.rating_change as ResearchReportItem['rating_change'],
    target_price: row.target_price,
    report_type: row.report_type as ResearchReportItem['report_type'],
    report_date: row.report_date,
    ts_code: row.ts_code || undefined,
    stock_name: row.stock_name || undefined,
    industry: row.industry,
    file_url: row.file_url,
    read_count: row.read_count,
  };
}

function mapFinanceCalendar(row: FinanceCalendarRow): FinanceCalendarEvent {
  return {
    event_id: row.event_id,
    event_type: row.event_type,
    event_name: row.event_name,
    event_desc: row.event_desc,
    ts_code: row.ts_code || undefined,
    stock_name: row.stock_name || undefined,
    event_date: row.event_date,
    event_time: row.event_time,
    importance: mapImportance(row.importance === 1 ? 2 : row.importance === 3 ? 4 : 3),
    status: mapCalendarStatus(row.status),
    extra_data: row.extra_data,
  };
}

async function executePagedQuery<T>(
  key: string,
  metricName: string,
  fetcher: (signal: AbortSignal) => Promise<PaginatedResult<T>>,
  ttlMs: number,
): Promise<PaginatedResult<T>> {
  return requestWithCache(key, metricName, fetcher, { ttlMs });
}

export async function fetchAnnouncements(query: AnnouncementQuery = {}): Promise<PaginatedResult<AnnouncementItem>> {
  const normalized = {
    page: query.page || 1,
    pageSize: query.pageSize || 20,
    keyword: query.keyword?.trim() || '',
    stockCode: query.stockCode?.trim() || '',
    annType: query.annType || '',
    importance: query.importance || 'all',
    hasAttachment: query.hasAttachment ?? null,
    dateRange: query.dateRange || '30d',
  };

  const cacheKey = `news:announcements:${stableStringify(normalized)}`;
  return executePagedQuery(cacheKey, 'fetchAnnouncements', async (signal) => {
    const from = (normalized.page - 1) * normalized.pageSize;
    const to = from + normalized.pageSize - 1;

    let builder = supabaseNews
      .from('announcement')
      .select('*', { count: 'exact' })
      .order('ann_date', { ascending: false })
      .order('importance', { ascending: true })
      .range(from, to)
      .abortSignal(signal);

    if (normalized.stockCode) {
      builder = builder.eq('ts_code', normalized.stockCode);
    }
    if (normalized.annType && normalized.annType !== 'all') {
      builder = builder.eq('ann_type', normalized.annType);
    }
    if (normalized.importance !== 'all') {
      const levelMap: Record<string, number> = { urgent: 1, high: 2, normal: 3, low: 4 };
      builder = builder.eq('importance', levelMap[normalized.importance]);
    }
    if (normalized.hasAttachment === true) {
      builder = builder.not('file_url', 'is', null);
    }
    if (normalized.hasAttachment === false) {
      builder = builder.is('file_url', null);
    }

    const dateFrom = getDateFromRange(normalized.dateRange);
    if (dateFrom) {
      builder = builder.gte('ann_date', dateFrom);
    }

    if (normalized.keyword) {
      const keyword = escapeKeyword(normalized.keyword);
      builder = builder.or(`title.ilike.%${keyword}%,summary.ilike.%${keyword}%,stock_name.ilike.%${keyword}%`);
    }

    const { data, error, count } = await builder;
    if (error) {
      logger.error('获取公司公告失败:', error);
      throw error;
    }

    const items = (data || []).map((row) => mapAnnouncement(row as AnnouncementRow));
    const total = count || 0;
    return {
      items,
      total,
      page: normalized.page,
      pageSize: normalized.pageSize,
      hasMore: normalized.page * normalized.pageSize < total,
    };
  }, 45_000);
}

export async function fetchAnnouncementDetail(annId: string): Promise<AnnouncementDetail | null> {
  const cacheKey = `news:announcement:detail:${annId}`;
  return requestWithCache(cacheKey, 'fetchAnnouncementDetail', async (signal) => {
    const { data, error } = await supabaseNews
      .from('announcement')
      .select('*')
      .eq('ann_id', annId)
      .abortSignal(signal)
      .maybeSingle();

    if (error) {
      logger.error('获取公告详情失败:', error);
      throw error;
    }
    if (!data) return null;

    const row = data as AnnouncementRow;
    return {
      ...mapAnnouncement(row),
      content: row.content,
      related_anns: Array.isArray(row.related_anns) ? (row.related_anns as string[]) : [],
    };
  }, { ttlMs: 60_000 });
}

export async function fetchResearchReports(query: ResearchReportQuery = {}): Promise<PaginatedResult<ResearchReportItem>> {
  const normalized = {
    page: query.page || 1,
    pageSize: query.pageSize || 20,
    keyword: query.keyword?.trim() || '',
    stockCode: query.stockCode?.trim() || '',
    orgName: query.orgName?.trim() || '',
    author: query.author?.trim() || '',
    rating: query.rating || 'all',
    reportType: query.reportType || 'all',
    dateRange: query.dateRange || '30d',
  };

  const cacheKey = `news:research-reports:${stableStringify(normalized)}`;
  return executePagedQuery(cacheKey, 'fetchResearchReports', async (signal) => {
    const from = (normalized.page - 1) * normalized.pageSize;
    const to = from + normalized.pageSize - 1;

    let builder = supabaseNews
      .from('research_report')
      .select('*', { count: 'exact' })
      .order('report_date', { ascending: false })
      .order('read_count', { ascending: false })
      .range(from, to)
      .abortSignal(signal);

    if (normalized.stockCode) builder = builder.eq('ts_code', normalized.stockCode);
    if (normalized.orgName) builder = builder.ilike('org_name', `%${escapeKeyword(normalized.orgName)}%`);
    if (normalized.author) builder = builder.ilike('author', `%${escapeKeyword(normalized.author)}%`);
    if (normalized.rating !== 'all') builder = builder.eq('rating', normalized.rating);
    if (normalized.reportType !== 'all') builder = builder.eq('report_type', normalized.reportType);

    const dateFrom = getDateFromRange(normalized.dateRange);
    if (dateFrom) builder = builder.gte('report_date', dateFrom);

    if (normalized.keyword) {
      const keyword = escapeKeyword(normalized.keyword);
      builder = builder.or(`title.ilike.%${keyword}%,summary.ilike.%${keyword}%,org_name.ilike.%${keyword}%,stock_name.ilike.%${keyword}%`);
    }

    const { data, error, count } = await builder;
    if (error) {
      logger.error('获取研究报告失败:', error);
      throw error;
    }

    const items = (data || []).map((row) => mapResearchReport(row as ResearchReportRow));
    const total = count || 0;
    return {
      items,
      total,
      page: normalized.page,
      pageSize: normalized.pageSize,
      hasMore: normalized.page * normalized.pageSize < total,
    };
  }, 60_000);
}

export async function fetchResearchReportDetail(reportId: string): Promise<ResearchReportDetail | null> {
  const cacheKey = `news:research-report:detail:${reportId}`;
  return requestWithCache(cacheKey, 'fetchResearchReportDetail', async (signal) => {
    const { data, error } = await supabaseNews
      .from('research_report')
      .select('*')
      .eq('report_id', reportId)
      .abortSignal(signal)
      .maybeSingle();

    if (error) {
      logger.error('获取研究报告详情失败:', error);
      throw error;
    }
    if (!data) return null;

    const row = data as ResearchReportRow;
    return {
      ...mapResearchReport(row),
      pre_rating: row.pre_rating,
      pre_target_price: row.pre_target_price,
      eps_forecast: row.eps_forecast,
      pe_forecast: row.pe_forecast,
      pages: row.pages,
      download_count: row.download_count,
    };
  }, { ttlMs: 90_000 });
}

export async function fetchFinanceCalendar(query: FinanceCalendarQuery = {}): Promise<PaginatedResult<FinanceCalendarEvent>> {
  const normalized = {
    page: query.page || 1,
    pageSize: query.pageSize || 20,
    keyword: query.keyword?.trim() || '',
    stockCode: query.stockCode?.trim() || '',
    eventType: query.eventType || 'all',
    status: query.status || 'all',
    importance: query.importance || 'all',
    dateRange: query.dateRange || '7d',
  };

  const cacheKey = `news:finance-calendar:${stableStringify(normalized)}`;
  return executePagedQuery(cacheKey, 'fetchFinanceCalendar', async (signal) => {
    const from = (normalized.page - 1) * normalized.pageSize;
    const to = from + normalized.pageSize - 1;

    let builder = supabaseNews
      .from('finance_calendar')
      .select('*', { count: 'exact' })
      .order('event_date', { ascending: true })
      .order('importance', { ascending: true })
      .range(from, to)
      .abortSignal(signal);

    if (normalized.stockCode) builder = builder.eq('ts_code', normalized.stockCode);
    if (normalized.eventType !== 'all') builder = builder.eq('event_type', normalized.eventType);
    if (normalized.status !== 'all') {
      const statusMap: Record<string, number> = { upcoming: 0, ongoing: 1, done: 2 };
      builder = builder.eq('status', statusMap[normalized.status]);
    }
    if (normalized.importance !== 'all') {
      const levelMap: Record<string, number> = { urgent: 1, high: 1, normal: 2, low: 3 };
      builder = builder.eq('importance', levelMap[normalized.importance]);
    }

    const dateFrom = getDateFromRange(normalized.dateRange);
    if (dateFrom) builder = builder.gte('event_date', dateFrom);

    if (normalized.keyword) {
      const keyword = escapeKeyword(normalized.keyword);
      builder = builder.or(`event_name.ilike.%${keyword}%,event_desc.ilike.%${keyword}%,stock_name.ilike.%${keyword}%`);
    }

    const { data, error, count } = await builder;
    if (error) {
      logger.error('获取财经日历失败:', error);
      throw error;
    }

    const items = (data || []).map((row) => mapFinanceCalendar(row as FinanceCalendarRow));
    const total = count || 0;
    return {
      items,
      total,
      page: normalized.page,
      pageSize: normalized.pageSize,
      hasMore: normalized.page * normalized.pageSize < total,
    };
  }, 180_000);
}

export async function fetchFinanceCalendarDetail(eventId: string): Promise<FinanceCalendarEvent | null> {
  const cacheKey = `news:finance-calendar:detail:${eventId}`;
  return requestWithCache(cacheKey, 'fetchFinanceCalendarDetail', async (signal) => {
    const { data, error } = await supabaseNews
      .from('finance_calendar')
      .select('*')
      .eq('event_id', eventId)
      .abortSignal(signal)
      .maybeSingle();

    if (error) {
      logger.error('获取财经日历详情失败:', error);
      throw error;
    }

    return data ? mapFinanceCalendar(data as FinanceCalendarRow) : null;
  }, { ttlMs: 180_000 });
}

export {
  NEWS_SOURCES,
  fetchRealTimeNews,
  fetchNewsBySource,
};
