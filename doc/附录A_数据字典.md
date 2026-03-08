# Top.AlphaPulse 附录A 数据字典

## 1. 文档说明

本文档用于补充主需求文档中的数据对象、核心表、主要字段口径与模块映射关系，供前端、后端、数据和测试协同使用。

## 2. 数据源分层说明

### 2.1 股票数据源

股票数据源主要承载以下数据域：

- 股票基础信息。
- 股票日线与估值指标。
- 指数基础信息与指数日线。
- 板块基础信息、板块日线、板块成员股。
- 涨跌停、龙虎榜、资金流向等市场行为数据。

### 2.2 资讯数据源

资讯数据源主要承载以下数据域：

- 财经快讯与资讯流。
- 多平台新闻源聚合数据。
- 后续扩展的公告、研报、财经日历等内容数据。

### 2.3 数据建模现状

- 股票数据源当前以结构化表为主，类型定义较明确。
- 资讯数据源当前存在统一资讯设计与多来源分表实现并存的情况。
- 后续需要将资讯主表、快讯表、公告表、研报表和财经日历表统一纳入规范模型。

---

## 3. 核心领域对象字典

### 3.1 股票基础对象 StockBasic

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| ts_code | string | 证券唯一代码，如 600519.SH | 全局主键 |
| symbol | string | 证券短代码 | 搜索与显示 |
| name | string | 股票名称 | 显示与搜索 |
| industry | string | 所属行业 | 分类展示 |
| market | string | 所属市场 | 筛选维度 |
| list_date | string | 上市日期 | 基础属性 |

主要使用模块：全局搜索、个股详情、智能选股、板块成员股展示。

### 3.2 日线行情对象 DailyData

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| ts_code | string | 股票代码 | 关联键 |
| trade_date | string | 交易日期 | 时间维度 |
| open | number | 开盘价 | K 线展示 |
| high | number | 最高价 | K 线展示 |
| low | number | 最低价 | K 线展示 |
| close | number | 收盘价 | K 线展示 |
| pre_close | number | 昨收价 | 涨跌计算 |
| change | number | 涨跌额 | 展示 |
| pct_chg | number | 涨跌幅 | 展示与排序 |
| vol | number | 成交量 | 图表与统计 |
| amount | number | 成交额 | 图表与统计 |

主要使用模块：个股详情、智能选股、市场统计。

### 3.3 指数对象 IndexData

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| code | string | 指数代码 | 关联键 |
| name | string | 指数名称 | 展示 |
| current | number | 当前点位 | 首页卡片 |
| change | number | 涨跌点数 | 首页卡片 |
| pct_change | number | 涨跌幅 | 首页卡片 |
| volume | number | 成交量 | 指数统计 |
| amount | number | 成交额 | 指数统计 |
| high | number | 最高点位 | 扩展展示 |
| low | number | 最低点位 | 扩展展示 |
| open | number | 开盘点位 | 扩展展示 |
| pre_close | number | 昨收点位 | 计算使用 |
| volume_ratio | number | 量比，可选 | 扩展展示 |

主要使用模块：市场概览。

### 3.4 板块对象 SectorData

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| ts_code | string | 板块代码 | 关联键 |
| name | string | 板块名称 | 展示 |
| pct_change | number | 板块涨跌幅 | 排行 |
| volume | number | 成交量 | 热度参考 |
| amount | number | 成交额 | 热度参考 |
| up_count | number | 上涨家数 | 板块宽度 |
| down_count | number | 下跌家数 | 板块宽度 |
| limit_up_count | number | 涨停家数 | 热点判断 |
| net_inflow | number | 净流入 | 资金热度 |
| heat_score | number | 热度得分 | 综合排序 |
| turnover_rate | number | 换手率，可选 | 活跃度参考 |

主要使用模块：市场概览、板块热点。

### 3.5 资金流向对象 MoneyFlowData

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| ts_code | string | 股票代码 | 关联键 |
| trade_date | string | 交易日期 | 时间维度 |
| net_mf_amount | number | 净流入金额 | 主指标 |
| buy_sm_amount | number | 小单买入额 | 结构分析 |
| sell_sm_amount | number | 小单卖出额 | 结构分析 |
| buy_md_amount | number | 中单买入额 | 结构分析 |
| sell_md_amount | number | 中单卖出额 | 结构分析 |
| buy_lg_amount | number | 大单买入额 | 结构分析 |
| sell_lg_amount | number | 大单卖出额 | 结构分析 |
| buy_elg_amount | number | 特大单买入额 | 结构分析 |
| sell_elg_amount | number | 特大单卖出额 | 结构分析 |

主要使用模块：个股详情、AI 分析、市场概览扩展分析。

### 3.6 涨跌停对象 LimitUpData

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| ts_code | string | 股票代码 | 关联键 |
| name | string | 股票名称 | 展示 |
| trade_date | string | 交易日期 | 时间维度 |
| close | number | 收盘价 | 展示 |
| pct_chg | number | 涨跌幅 | 展示 |
| limit_amount | number | 封单额 | 强度判断 |
| first_time | string | 首次封板时间 | 行为分析 |
| last_time | string | 最后封板时间 | 行为分析 |
| open_times | number | 开板次数 | 情绪分析 |
| limit_times | number | 涨停次数 | 强度分析 |
| tag | string | 标签 | 业务标记 |
| theme | string | 题材 | 题材归类 |

主要使用模块：市场概览、板块热点、龙虎榜扩展联动。

### 3.7 新闻对象 NewsItem

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| id | string | 新闻唯一标识 | 主键 |
| title | string | 标题 | 列表显示 |
| content | string | 正文或摘要 | 详情展示 |
| source | string | 来源名称 | 来源过滤 |
| publish_time | string | 发布时间 | 排序 |
| importance | enum | 重要级别 | 高亮标记 |
| related_stocks | string[] | 关联股票列表 | 联动分析 |
| category | string | 分类 | 分类过滤 |

主要使用模块：资讯中心、AI 分析扩展能力。

### 3.8 快讯对象 FlashNewsItem

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| id | string | 快讯唯一标识 | 主键 |
| title | string | 标题 | 列表展示 |
| content | string | 内容 | 详情展示 |
| source | string | 来源平台名称 | 来源过滤 |
| sourceKey | string | 来源标识 | 数据映射 |
| display_time | number | 时间戳 | 排序 |
| time | string | 格式化时间 | 展示 |
| date | string | 格式化日期 | 展示 |
| importance | enum | 重要性 | 高亮 |
| categories | string[] | 分类标签 | 分类过滤 |
| images | string[] | 配图，可选 | 详情扩展 |

主要使用模块：资讯中心。

### 3.9 AI 分析结果对象 AIAnalysisResult

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| overall_score | number | 综合评分 | 总览展示 |
| overall_rating | string | 综合评级 | 总览展示 |
| technical_analysis | object | 技术面分析结果 | 结果页 |
| fundamental_analysis | object | 基本面分析结果 | 结果页 |
| capital_analysis | object | 资金面分析结果 | 结果页 |
| confidence_level | number | 置信度 | 可信度展示 |

主要使用模块：AI 分析。

### 3.10 市场情绪对象 MarketSentiment

| 字段 | 类型 | 说明 | 用途 |
| --- | --- | --- | --- |
| overall | number | 综合情绪分值 | 首页核心指标 |
| label | string | 情绪标签 | 展示 |
| up_down_ratio | number | 涨跌比 | 情绪计算 |
| avg_change | number | 平均涨跌幅 | 情绪计算 |
| limit_up_success_rate | number | 涨停成功率 | 情绪计算 |

主要使用模块：市场概览、AI 市场风险扩展能力。

---

## 4. 主要数据库表字典

### 4.1 股票基础与估值类

#### stock_basic

用途：存储股票基础信息，是股票主数据表。

关键字段：

- ts_code
- symbol
- name
- area
- industry
- market
- list_date

依赖模块：全局搜索、个股详情、智能选股、板块成员股。

#### daily_basic

用途：存储每日估值与流通指标数据。

关键字段：

- ts_code
- trade_date
- close
- turnover_rate
- volume_ratio
- pe
- pe_ttm
- pb
- ps
- total_mv
- circ_mv

依赖模块：个股详情、智能选股、AI 基本面分析。

### 4.2 指数类

#### index_basic

用途：存储指数基础定义信息。

关键字段：

- ts_code
- name
- market
- category
- list_date

依赖模块：市场概览。

#### index_daily

用途：存储指数日线行情。

关键字段：

- ts_code
- trade_date
- close
- open
- high
- low
- pre_close
- change
- pct_chg
- vol
- amount

依赖模块：市场概览。

### 4.3 板块类

#### ths_index

用途：存储同花顺板块基础信息。

关键字段：

- ts_code
- name
- count
- type

依赖模块：板块热点、市场概览。

#### ths_daily

用途：存储同花顺板块日线行情与活跃度指标。

关键字段：

- ts_code
- trade_date
- close
- pct_change
- vol
- turnover_rate
- total_mv
- float_mv

依赖模块：板块热点、市场概览。

#### ths_member

用途：存储板块与成分股映射。

关键字段：

- ts_code
- con_code
- con_name

依赖模块：板块热点、个股联动。

### 4.4 市场行为类

#### limit_list_d

用途：存储每日涨跌停明细。

关键字段：

- trade_date
- ts_code
- name
- industry
- close
- pct_chg
- limit_amount
- first_time
- last_time
- open_times
- limit_times
- limit

依赖模块：市场概览、板块热点、题材分析。

#### stk_limit

用途：存储个股涨跌停价格上下限。

关键字段：

- trade_date
- ts_code
- up_limit
- down_limit

依赖模块：个股详情扩展分析、涨跌停计算。

#### top_list

用途：存储龙虎榜相关数据。

关键字段：

- trade_date
- ts_code
- name
- close
- pct_change

依赖模块：龙虎榜。

注：当前类型定义显示了主表存在，但详细席位字段仍需结合真实查询与表结构继续补完。

---

## 5. 资讯模型建议字典

### 5.1 统一资讯主表建议字段

建议保留以下基础字段：

- news_id
- title
- summary
- content
- source_type
- source_name
- source_url
- publish_time
- importance
- tags
- stocks
- industries
- concepts

### 5.2 快讯表建议字段

- flash_id
- content
- source_name
- category
- related_stocks
- publish_time
- push_status

### 5.3 公告表建议字段

- ann_id
- ts_code
- stock_name
- title
- ann_type
- file_url
- ann_date

### 5.4 研报表建议字段

- report_id
- ts_code
- stock_name
- title
- org_name
- author
- rating
- target_price
- report_date

### 5.5 财经日历表建议字段

- event_id
- event_type
- event_name
- event_date
- event_time
- importance
- status

---

## 6. 数据字典治理建议

- 为股票、板块、资讯建立统一主键命名规范。
- 对涨跌幅、成交额、资金净流入等关键字段统一单位和格式。
- 对资讯来源建立标准化 sourceKey 与展示名称映射表。
- 对 AI 分析输出字段建立统一协议，避免不同模型返回结构不一致。
- 对仍处于规划阶段的表结构单独标注“设计态”，避免与当前数据库现状混淆。