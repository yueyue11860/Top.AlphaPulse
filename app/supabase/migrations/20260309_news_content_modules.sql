-- 资讯中心扩展内容表
-- 公司公告、研究报告、财经日历

CREATE TABLE IF NOT EXISTS public.announcement (
  ann_id text PRIMARY KEY,
  ts_code text NOT NULL,
  stock_name text,
  title text NOT NULL,
  ann_type text,
  ann_sub_type text,
  content text,
  summary text,
  file_url text,
  source text,
  ann_date date NOT NULL,
  importance smallint DEFAULT 3,
  related_anns jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcement_ts_code ON public.announcement(ts_code);
CREATE INDEX IF NOT EXISTS idx_announcement_ann_date ON public.announcement(ann_date DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_ann_type ON public.announcement(ann_type);
CREATE INDEX IF NOT EXISTS idx_announcement_importance ON public.announcement(importance);
CREATE INDEX IF NOT EXISTS idx_announcement_stock_date ON public.announcement(ts_code, ann_date DESC);

CREATE TABLE IF NOT EXISTS public.research_report (
  report_id text PRIMARY KEY,
  title text NOT NULL,
  summary text,
  org_name text,
  author text,
  rating text,
  rating_change text,
  pre_rating text,
  target_price numeric(10, 2),
  pre_target_price numeric(10, 2),
  eps_forecast numeric(10, 4),
  pe_forecast numeric(10, 2),
  ts_code text,
  stock_name text,
  industry text,
  report_type text,
  report_date date NOT NULL,
  pages integer,
  file_url text,
  read_count integer DEFAULT 0,
  download_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_report_ts_code ON public.research_report(ts_code);
CREATE INDEX IF NOT EXISTS idx_research_report_date ON public.research_report(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_research_report_org_name ON public.research_report(org_name);
CREATE INDEX IF NOT EXISTS idx_research_report_rating ON public.research_report(rating);
CREATE INDEX IF NOT EXISTS idx_research_report_type ON public.research_report(report_type);

CREATE TABLE IF NOT EXISTS public.finance_calendar (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  event_name text NOT NULL,
  event_desc text,
  ts_code text,
  stock_name text,
  event_date date NOT NULL,
  event_time time,
  importance smallint DEFAULT 2,
  status smallint DEFAULT 0,
  remind_time timestamptz,
  remind_sent boolean DEFAULT false,
  extra_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_calendar_event_date ON public.finance_calendar(event_date ASC);
CREATE INDEX IF NOT EXISTS idx_finance_calendar_event_type ON public.finance_calendar(event_type);
CREATE INDEX IF NOT EXISTS idx_finance_calendar_ts_code ON public.finance_calendar(ts_code);
CREATE INDEX IF NOT EXISTS idx_finance_calendar_status ON public.finance_calendar(status);
CREATE INDEX IF NOT EXISTS idx_finance_calendar_importance ON public.finance_calendar(importance);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcement_set_updated_at ON public.announcement;
CREATE TRIGGER announcement_set_updated_at
BEFORE UPDATE ON public.announcement
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS research_report_set_updated_at ON public.research_report;
CREATE TRIGGER research_report_set_updated_at
BEFORE UPDATE ON public.research_report
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS finance_calendar_set_updated_at ON public.finance_calendar;
CREATE TRIGGER finance_calendar_set_updated_at
BEFORE UPDATE ON public.finance_calendar
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.announcement TO anon, authenticated;
GRANT SELECT ON public.research_report TO anon, authenticated;
GRANT SELECT ON public.finance_calendar TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.announcement TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.research_report TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.finance_calendar TO service_role;