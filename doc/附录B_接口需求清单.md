# Top.AlphaPulse 附录B 接口需求清单

## 1. 文档说明

本文档用于补充主需求文档中的接口需求视图，区分当前已具备的前端服务接口、基于数据层的查询能力，以及目标态规划接口。

## 2. 接口分层说明

### 2.1 当前接口形态

当前项目以“前端服务函数 + Supabase 查询/RPC”为主要接口形态，尚未完全形成独立后端 REST API 体系。

### 2.2 目标接口形态

目标态将逐步演进为统一 API 服务，建议按模块形成可版本化的 REST 风格接口，并保留必要的实时订阅与异步任务接口。

### 2.3 状态标记

- 已具备：当前前端服务已存在，页面可直接消费。
- 建议固化：当前能力存在，但仍需整理为正式 API 契约。
- 规划中：来源于设计文档，尚未接入正式实现。

### 2.4 字段规范说明

为避免后续接口实现时出现字段歧义，本文档中的字段说明统一遵循以下规则：

| 规则项 | 说明 |
| --- | --- |
| 时间字段 | 未特别说明时统一使用字符串日期或 Unix 秒级时间戳 |
| 金额字段 | 默认使用 number，单位需在字段说明中明确 |
| 比例字段 | 百分比字段使用 number，默认以百分数表达，例如 5.23 表示 5.23% |
| 可空字段 | 文档中标记“可空”表示允许返回 null；未标记时默认不应为空 |
| 列表字段 | 无数据时返回空数组，不返回 null |
| 聚合对象 | 局部失败时允许字段为 null，但应保持主结构稳定 |

### 2.5 通用枚举规范

#### 2.5.1 排序方向 order

| 值 | 含义 |
| --- | --- |
| asc | 升序 |
| desc | 降序 |

#### 2.5.2 选股比较运算符 operator

| 值 | 含义 |
| --- | --- |
| eq | 等于 |
| gt | 大于 |
| gte | 大于等于 |
| lt | 小于 |
| lte | 小于等于 |
| between | 区间 |

#### 2.5.3 龙虎榜筛选 filter

| 值 | 含义 |
| --- | --- |
| all | 全部 |
| net_buy | 仅净买入 |
| net_sell | 仅净卖出 |

#### 2.5.4 龙虎榜席位方向 side

| 值 | 含义 |
| --- | --- |
| 0 | 买入席位 |
| 1 | 卖出席位 |

#### 2.5.5 新闻重要性 importance

当前实现存在两套口径，接口标准化时需显式区分：

| 场景 | 值 | 含义 |
| --- | --- | --- |
| 实时资讯聚合 | high | 高优先级资讯 |
| 实时资讯聚合 | normal | 普通资讯 |
| 资讯中心扩展模型 | urgent | 紧急 |
| 资讯中心扩展模型 | high | 重要 |
| 资讯中心扩展模型 | normal | 普通 |

建议：正式统一 API 中保留 urgent、high、normal 三档；当前只支持两档的数据源可映射为 high、normal。

#### 2.5.6 AI 明细级别 detail_level

| 值 | 含义 |
| --- | --- |
| brief | 简版结果，适合列表或快速预览 |
| standard | 标准结果，适合普通分析页 |
| full | 完整结果，适合深度分析 |

---

## 3. 市场概览接口需求

| 接口名称 | 方法 | 用途 | 当前状态 |
| --- | --- | --- | --- |
| fetchIndices | 前端服务函数 | 获取主要指数数据 | 已具备 |
| fetchHotSectors | 前端服务函数 | 获取热门板块 | 已具备 |
| fetchAllSectors | 前端服务函数 | 获取全部板块 | 已具备 |
| fetchLimitUpList | 前端服务函数 | 获取涨停列表 | 已具备 |
| fetchLimitDownList | 前端服务函数 | 获取跌停列表 | 已具备 |
| fetchUpDownDistribution | 前端服务函数 | 获取涨跌分布统计 | 已具备 |
| fetchEnhancedSentiment | 前端服务函数 | 获取增强版市场情绪 | 已具备 |
| fetchMarketSentiment | 前端服务函数 | 获取基础市场情绪 | 已具备 |
| fetchNorthFlow | 前端服务函数 | 获取北向资金流向 | 已具备 |
| fetchMarketOverviewBundle | 前端服务函数 | 获取首页聚合数据包 | 已具备 |

目标接口建议：

- GET /api/v1/market/overview
- GET /api/v1/market/indices
- GET /api/v1/market/sentiment
- GET /api/v1/market/limit-stats
- GET /api/v1/market/north-flow

### 3.1 字段级接口定义

#### 3.1.1 GET /api/v1/market/overview

用途：返回市场概览页首屏所需聚合数据，优先作为市场概览页面单接口入口。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| force_refresh | boolean | 否 | false | 是否跳过缓存并强制刷新 |

响应 data 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| indices | IndexData[] | 主要指数列表 |
| sectors | SectorData[] | 热门板块列表 |
| limitUpList | LimitUpData[] | 涨停或强势股列表 |
| upDownDistribution | object \| null | 涨跌分布统计 |
| enhancedSentiment | object \| null | 增强版市场情绪 |
| northFlow | object \| null | 北向资金信息 |
| hsgtTop10 | object[] | 沪深股通 Top10 |
| updateTime | string | 更新时间 |

upDownDistribution 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| up_count | number | 上涨家数 |
| down_count | number | 下跌家数 |
| flat_count | number | 平盘家数 |
| limit_up | number | 涨停家数 |
| limit_down | number | 跌停家数 |
| distribution | array | 涨跌区间分布列表 |
| lianbanStats | object | 连板统计，可选 |
| zhabanCount | number | 炸板数，可选 |
| fengbanRate | number | 封板率，可选 |
| maxLianban | number | 最高连板数，可选 |

enhancedSentiment 字段要求：

- 应包含总体分数、情绪标签、关键因子摘要。
- 可扩展返回风险偏好级别、情绪变化方向和组成因子。

northFlow 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| net_inflow | number | 当日净流入，单位建议为亿元 |
| sh_inflow | number | 沪股通净流入，单位建议为亿元 |
| sz_inflow | number | 深股通净流入，单位建议为亿元 |
| cumulative_30d | number | 30日累计净流入，单位建议为亿元 |
| time_series | array | 资金时间序列，不可为 null |

time_series 列表字段建议：

| 字段 | 类型 | 可空 | 单位 | 说明 |
| --- | --- | --- | --- | --- |
| date | string | 否 | - | 日期 |
| amount | number | 否 | 亿元 | 净流入金额 |
| hgt | number | 是 | 亿元 | 沪股通明细 |
| sgt | number | 是 | 亿元 | 深股通明细 |

错误语义：

- 当聚合接口局部数据失败时，应尽量返回其余可用字段，不应整包失败。
- 当全部依赖失败时，返回空结构和失败说明，前端可进入降级模式。

#### 3.1.2 GET /api/v1/market/indices

用途：返回首页指数卡片和指数概览所需数据。

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| code | string | 指数代码 |
| name | string | 指数名称 |
| current | number | 当前点位 |
| change | number | 涨跌点数 |
| pct_change | number | 涨跌幅，单位 % |
| volume | number | 成交量，单位以数据源口径为准 |
| amount | number | 成交额，单位以数据源口径为准 |
| high | number | 最高 |
| low | number | 最低 |
| open | number | 开盘 |
| pre_close | number | 昨收 |

#### 3.1.3 GET /api/v1/market/sentiment

用途：独立获取市场情绪模块所需数据，便于首页分块刷新。

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| mode | string | 否 | basic 或 enhanced |

响应字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| overall | number | 综合分数 |
| label | string | 情绪标签 |
| up_down_ratio | number | 涨跌比 |
| avg_change | number | 平均涨跌幅，单位 % |
| limit_up_success_rate | number | 涨停成功率，单位 % |
| summary | string | 简要描述 |

label 建议枚举：

| 值 | 含义 |
| --- | --- |
| 极度恐慌 | 风险偏好极低 |
| 恐慌 | 风险偏好偏低 |
| 中性 | 情绪平衡 |
| 乐观 | 风险偏好偏高 |
| 极度乐观 | 风险偏好极高 |

#### 3.1.4 GET /api/v1/market/north-flow

用途：返回北向资金卡片和趋势图数据。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| days | number | 否 | 30 | 返回时间序列长度 |

响应字段应至少包括 net_inflow、sh_inflow、sz_inflow、cumulative_30d、time_series。

### 3.2 标准 JSON 响应示例

#### 3.2.1 市场概览聚合响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": {
		"indices": [
			{
				"code": "000001.SH",
				"name": "上证指数",
				"current": 3288.45,
				"change": 18.32,
				"pct_change": 0.56,
				"volume": 425000000,
				"amount": 523400000000,
				"high": 3294.2,
				"low": 3266.12,
				"open": 3272.15,
				"pre_close": 3270.13
			}
		],
		"sectors": [
			{
				"ts_code": "885621.TI",
				"name": "算力概念",
				"pct_change": 3.42,
				"volume": 12500000,
				"amount": 8650000000,
				"up_count": 21,
				"down_count": 4,
				"limit_up_count": 3,
				"net_inflow": 5.68,
				"heat_score": 87,
				"turnover_rate": 4.26
			}
		],
		"limitUpList": [
			{
				"ts_code": "603019.SH",
				"name": "中科曙光",
				"trade_date": "2026-03-08",
				"close": 68.21,
				"pct_chg": 10.01,
				"limit_amount": 326000000,
				"first_time": "09:33:15",
				"last_time": "14:51:20",
				"open_times": 2,
				"limit_times": 1,
				"tag": "算力",
				"theme": "AI基础设施"
			}
		],
		"upDownDistribution": {
			"up_count": 3562,
			"down_count": 1284,
			"flat_count": 93,
			"limit_up": 78,
			"limit_down": 4,
			"distribution": [
				{ "range": ">9%", "count": 78 },
				{ "range": "3%~9%", "count": 562 },
				{ "range": "0%~3%", "count": 2922 }
			],
			"lianbanStats": {
				"oneBoard": 45,
				"twoBoard": 19,
				"threeBoard": 8,
				"fourBoard": 4,
				"fivePlus": 2
			},
			"zhabanCount": 16,
			"fengbanRate": 82.98,
			"maxLianban": 5
		},
		"enhancedSentiment": {
			"overall": 76,
			"label": "乐观",
			"summary": "上涨家数明显占优，北向资金净流入维持强势"
		},
		"northFlow": {
			"net_inflow": 38.62,
			"sh_inflow": 22.45,
			"sz_inflow": 16.17,
			"cumulative_30d": 268.4,
			"time_series": [
				{ "date": "2026-03-04", "amount": 12.3 },
				{ "date": "2026-03-05", "amount": 18.6 },
				{ "date": "2026-03-06", "amount": 38.62 }
			]
		},
		"hsgtTop10": [
			{
				"ts_code": "600519.SH",
				"name": "贵州茅台",
				"amount": 1250000000,
				"close": 1688.0,
				"change": 1.25,
				"rank": 1,
				"market_type": "沪股通",
				"net_amount": 268000000
			}
		],
		"updateTime": "2026-03-08 15:08:00"
	},
	"timestamp": 1772963280,
	"request_id": "req_market_overview_001"
}
```

---

## 4. 个股详情接口需求

| 接口名称 | 方法 | 用途 | 当前状态 |
| --- | --- | --- | --- |
| searchStocks | 前端服务函数 | 全局股票搜索 | 已具备 |
| fetchStockDetail | 前端服务函数 | 获取股票基础详情 | 已具备 |
| fetchKLineData | 前端服务函数 | 获取 K 线数据 | 已具备 |
| fetchTimeSeriesData | 前端服务函数 | 获取分时数据 | 已具备 |
| fetchStockMoneyFlow | 前端服务函数 | 获取个股资金流向 | 已具备 |
| fetchStockFullDetail | 前端服务函数 | 获取个股完整详情包 | 已具备 |

目标接口建议：

- GET /api/v1/stocks/search?q={keyword}
- GET /api/v1/stocks/{ts_code}
- GET /api/v1/stocks/{ts_code}/kline
- GET /api/v1/stocks/{ts_code}/timeseries
- GET /api/v1/stocks/{ts_code}/moneyflow
- GET /api/v1/stocks/{ts_code}/fundamentals
- GET /api/v1/stocks/{ts_code}/announcements

接口要求：

- 支持以 ts_code 作为统一主键。
- K 线接口应支持周期、复权类型和时间范围参数。
- 详情聚合接口应支持按面板拆分拉取，避免首屏过重。

### 4.1 字段级接口定义

#### 4.1.1 GET /api/v1/stocks/search

用途：支持全局股票搜索和快速跳转。

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| q | string | 是 | 股票代码、名称、拼音简称 |
| limit | number | 否 | 默认 10 |

响应 data 列表字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| ts_code | string | 股票代码 |
| name | string | 股票名称 |
| industry | string | 所属行业，允许空字符串 |

约束：

- 关键字为空时应直接返回空数组。
- 模糊匹配应覆盖 ts_code、name、symbol、cnspell。

#### 4.1.2 GET /api/v1/stocks/{ts_code}

用途：返回股票基础详情。

路径参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ts_code | string | 是 | 股票代码 |

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| ts_code | string | 股票代码 |
| symbol | string | 短代码 |
| name | string | 股票名称 |
| industry | string | 行业，允许空字符串 |
| market | string | 市场，允许空字符串 |
| list_date | string | 上市日期，允许空字符串 |

#### 4.1.3 GET /api/v1/stocks/{ts_code}/full-detail

用途：返回详情页首屏所需的聚合基础数据。

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| ts_code | string | 股票代码 |
| symbol | string | 短代码 |
| name | string | 股票名称 |
| industry | string | 行业 |
| market | string | 市场 |
| area | string | 地区 |
| list_date | string | 上市日期 |
| trade_date | string | 最新交易日 |
| open | number | 开盘价 |
| high | number | 最高价 |
| low | number | 最低价 |
| close | number | 收盘价 |
| pre_close | number | 昨收 |
| change | number | 涨跌额 |
| pct_chg | number | 涨跌幅，单位 % |
| vol | number | 成交量，当前口径为手 |
| amount | number | 成交额，当前口径为千元 |
| turnover_rate | number | 换手率，单位 % |
| turnover_rate_f | number | 自由流通换手率，单位 % |
| volume_ratio | number | 量比 |
| pe | number | 市盈率 |
| pe_ttm | number | TTM 市盈率 |
| pb | number | 市净率 |
| ps | number | 市销率 |
| ps_ttm | number | TTM 市销率 |
| dv_ratio | number | 股息率 |
| dv_ttm | number | TTM 股息率 |
| total_share | number | 总股本 |
| float_share | number | 流通股本 |
| free_share | number | 自由流通股本 |
| total_mv | number | 总市值，当前口径为万元 |
| circ_mv | number | 流通市值，当前口径为万元 |

说明：

- 当主股票表缺失数据时，允许从新股表做降级补齐名称与市场属性。

#### 4.1.4 GET /api/v1/stocks/{ts_code}/kline

用途：返回 K 线图所需时序数据。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| days | number | 否 | 60 | 返回最近交易日数量 |
| adjust | string | 否 | none | 复权类型，预留 |
| period | string | 否 | 1d | 周期，预留 |

响应 data 列表字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| date | string | 交易日期 |
| open | number | 开盘价 |
| high | number | 最高价 |
| low | number | 最低价 |
| close | number | 收盘价或最新价 |
| volume | number | 成交量，当前口径为手 |

period 预留枚举建议：

| 值 | 含义 |
| --- | --- |
| 1d | 日线 |
| 1w | 周线 |
| 1m | 月线 |

adjust 预留枚举建议：

| 值 | 含义 |
| --- | --- |
| none | 不复权 |
| qfq | 前复权 |
| hfq | 后复权 |

说明：

- 当前实现会融合历史日线和实时行情，若实时日期等于最新交易日则覆盖最新 bar。

#### 4.1.5 GET /api/v1/stocks/{ts_code}/timeseries

用途：返回分时图数据。

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| pre_close | number | 否 | 昨收价，主要用于降级模拟数据 |

响应 data 列表字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| time | string | 时间，格式 HH:MM |
| price | number | 当前价格 |
| volume | number | 当前成交量 |
| avg_price | number | 截止当前均价 |

#### 4.1.6 GET /api/v1/stocks/{ts_code}/moneyflow

用途：返回个股资金流向结构。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| days | number | 否 | 5 | 返回最近交易日数量 |

响应 data 列表字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| trade_date | string | 交易日期 |
| buy_sm_amount | number | 小单买入额，单位以原表口径为准 |
| sell_sm_amount | number | 小单卖出额，单位以原表口径为准 |
| net_sm_amount | number | 小单净额 |
| buy_md_amount | number | 中单买入额 |
| sell_md_amount | number | 中单卖出额 |
| net_md_amount | number | 中单净额 |
| buy_lg_amount | number | 大单买入额 |
| sell_lg_amount | number | 大单卖出额 |
| net_lg_amount | number | 大单净额 |
| buy_elg_amount | number | 特大单买入额 |
| sell_elg_amount | number | 特大单卖出额 |
| net_elg_amount | number | 特大单净额 |
| net_main_amount | number | 主力净额，等于大单净额加特大单净额 |
| net_mf_amount | number | 总净流入 |

#### 4.1.7 GET /api/v1/stocks/{ts_code}/bundle

用途：返回详情页聚合包，减少首屏请求数。

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| detail | object \| null | 股票完整详情 |
| kLineData | array | K 线数据 |
| moneyFlowData | array | 资金流向数据 |
| timeSeriesData | array | 分时数据 |

### 4.2 标准 JSON 响应示例

#### 4.2.1 股票搜索响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": [
		{
			"ts_code": "600519.SH",
			"name": "贵州茅台",
			"industry": "酿酒行业"
		},
		{
			"ts_code": "000858.SZ",
			"name": "五粮液",
			"industry": "酿酒行业"
		}
	],
	"timestamp": 1772963280,
	"request_id": "req_stock_search_001"
}
```

#### 4.2.2 个股完整详情响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": {
		"ts_code": "600519.SH",
		"symbol": "600519",
		"name": "贵州茅台",
		"industry": "酿酒行业",
		"market": "沪市主板",
		"area": "贵州",
		"list_date": "2001-08-27",
		"trade_date": "2026-03-08",
		"open": 1668.0,
		"high": 1692.6,
		"low": 1661.2,
		"close": 1688.0,
		"pre_close": 1667.2,
		"change": 20.8,
		"pct_chg": 1.25,
		"vol": 32568,
		"amount": 548230,
		"turnover_rate": 0.42,
		"turnover_rate_f": 0.61,
		"volume_ratio": 1.18,
		"pe": 28.3,
		"pe_ttm": 27.6,
		"pb": 9.82,
		"ps": 12.14,
		"ps_ttm": 11.95,
		"dv_ratio": 1.72,
		"dv_ttm": 1.68,
		"total_share": 125619.78,
		"float_share": 125619.78,
		"free_share": 53318.2,
		"total_mv": 212050000,
		"circ_mv": 89980000
	},
	"timestamp": 1772963280,
	"request_id": "req_stock_detail_001"
}
```

#### 4.2.3 个股详情聚合包响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": {
		"detail": {
			"ts_code": "600519.SH",
			"name": "贵州茅台",
			"close": 1688.0,
			"pct_chg": 1.25,
			"pe_ttm": 27.6
		},
		"kLineData": [
			{ "date": "2026-03-04", "open": 1650.0, "high": 1668.5, "low": 1648.3, "close": 1661.2, "volume": 28640 },
			{ "date": "2026-03-05", "open": 1662.4, "high": 1692.6, "low": 1661.2, "close": 1688.0, "volume": 32568 }
		],
		"moneyFlowData": [
			{
				"trade_date": "2026-03-08",
				"buy_sm_amount": 126000,
				"sell_sm_amount": 138000,
				"net_sm_amount": -12000,
				"buy_md_amount": 186000,
				"sell_md_amount": 172000,
				"net_md_amount": 14000,
				"buy_lg_amount": 268000,
				"sell_lg_amount": 214000,
				"net_lg_amount": 54000,
				"buy_elg_amount": 312000,
				"sell_elg_amount": 241000,
				"net_elg_amount": 71000,
				"net_main_amount": 125000,
				"net_mf_amount": 127000
			}
		],
		"timeSeriesData": [
			{ "time": "09:31", "price": 1669.5, "volume": 3200, "avg_price": 1668.9 },
			{ "time": "09:32", "price": 1671.2, "volume": 2800, "avg_price": 1670.1 }
		]
	},
	"timestamp": 1772963280,
	"request_id": "req_stock_bundle_001"
}
```

---

## 5. 板块热点接口需求

### 5.1 当前能力

| 接口名称 | 方法 | 用途 | 当前状态 |
| --- | --- | --- | --- |
| fetchThsHot | 前端服务函数 | 获取热点题材数据 | 已具备 |
| fetchIndustryHotList | 前端服务函数 | 获取行业热度排行 | 已具备 |
| fetchConceptHotList | 前端服务函数 | 获取概念热度排行 | 已具备 |
| fetchHotStockList | 前端服务函数 | 获取热股排行 | 已具备 |
| fetchSectorMembers | 前端服务函数 | 获取板块成员股 | 已具备 |
| fetchSectorHeatBundle | 前端服务函数 | 获取板块聚合数据包 | 已具备 |

### 5.2 目标接口建议

- GET /api/v1/sectors
- GET /api/v1/sectors/rank
- GET /api/v1/sectors/{ts_code}/quote
- GET /api/v1/sectors/{ts_code}/stocks
- GET /api/v1/sectors/heatmap
- GET /api/v1/sectors/rotation
- GET /api/v1/sectors/correlation
- GET /api/v1/sectors/kpl-concepts

### 5.3 接口要求

- 支持板块类型筛选，如行业、概念、地区。
- 支持按涨跌幅、资金流向、热度分值、涨停数排序。
- 板块成分股接口应返回板块基础信息与股票列表。
- 高级分析接口如轮动和相关性允许作为后续阶段性接口。

### 5.4 字段级接口定义

#### 5.4.1 GET /api/v1/sectors/bundle

用途：返回板块热点页首屏聚合数据。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| limit | number | 否 | 30 | 热力图或排行聚合数量 |

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| heatmapData | array | 热力图数据 |
| industryHotList | SectorHotData[] | 行业热榜 |
| conceptHotList | SectorHotData[] | 概念热榜 |
| hotStockList | HotStockData[] | 热股列表 |
| kplConcepts | array | 开盘啦题材列表 |

heatmapData 列表字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 板块名称 |
| value | number | 涨跌幅或热力值，当前通常使用涨跌幅 % |
| size | number | 热力图尺寸权重 |
| type | string | industry 或 concept |

type 枚举：

| 值 | 含义 |
| --- | --- |
| industry | 行业板块 |
| concept | 概念板块 |

industryHotList 与 conceptHotList 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| ts_code | string | 板块代码 |
| ts_name | string | 板块名称 |
| rank | number | 排名 |
| pct_change | number | 涨跌幅，单位 % |
| hot | number | 热度值 |

hotStockList 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| ts_code | string | 股票代码 |
| ts_name | string | 股票名称 |
| rank | number | 排名 |
| pct_change | number | 涨跌幅 |
| hot | number | 热度值 |
| concepts | string[] | 关联概念 |

#### 5.4.2 GET /api/v1/sectors/{ts_code}/stocks

用途：返回板块成分股和板块基础信息。

响应字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| sector | object | 板块基础信息 |
| stocks | array | 成分股列表 |

sector 字段建议包括 tsCode、name、sectorType、stockCount。

stocks 列表字段建议包括 stockCode、stockName、weight、isLeader、pctChange、amount。

sectorType 枚举建议：

| 值 | 含义 |
| --- | --- |
| industry | 行业板块 |
| concept | 概念板块 |
| region | 地域板块 |

#### 5.4.3 GET /api/v1/sectors/rank

用途：返回板块排行列表。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| sortBy | string | 是 | - | pct_change、net_inflow、heat_score、limit_up_count |
| order | string | 否 | desc | asc 或 desc |
| sectorType | string | 否 | all | 行业、概念等 |
| limit | number | 否 | 20 | 返回数量 |

### 5.5 标准 JSON 响应示例

#### 5.5.1 板块聚合包响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": {
		"heatmapData": [
			{ "name": "算力概念", "value": 3.42, "size": 96, "type": "concept" },
			{ "name": "半导体", "value": 2.86, "size": 88, "type": "industry" }
		],
		"industryHotList": [
			{ "ts_code": "885431.TI", "ts_name": "半导体", "rank": 1, "pct_change": 2.86, "hot": 92 }
		],
		"conceptHotList": [
			{ "ts_code": "885621.TI", "ts_name": "算力概念", "rank": 1, "pct_change": 3.42, "hot": 95 }
		],
		"hotStockList": [
			{ "ts_code": "603019.SH", "ts_name": "中科曙光", "rank": 1, "pct_change": 10.01, "hot": 98, "concepts": ["算力", "液冷服务器"] }
		],
		"kplConcepts": [
			{ "name": "AI基础设施", "limit_up_count": 5, "up_count": 18, "trade_date": "2026-03-08", "heat_score": 93 }
		]
	},
	"timestamp": 1772963280,
	"request_id": "req_sector_bundle_001"
}
```

---

## 6. 龙虎榜接口需求

| 接口名称 | 方法 | 用途 | 当前状态 |
| --- | --- | --- | --- |
| fetchDragonTigerList | 前端服务函数 | 获取龙虎榜列表 | 已具备 |
| fetchDragonTigerDetail | 前端服务函数 | 获取龙虎榜详情 | 已具备 |

目标接口建议：

- GET /api/v1/dragon-tiger?trade_date={date}
- GET /api/v1/dragon-tiger/{ts_code}?trade_date={date}
- GET /api/v1/dragon-tiger/{ts_code}/history
- GET /api/v1/dragon-tiger/seats/{seat_name}

接口要求：

- 列表接口应支持交易日切换。
- 详情接口应支持返回买卖席位、机构统计、净买入等信息。
- 历史接口和席位画像接口属于后续增强能力。

### 6.1 字段级接口定义

#### 6.1.1 GET /api/v1/dragon-tiger

用途：返回指定交易日龙虎榜股票列表。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| trade_date | string | 否 | 最新交易日 | 交易日期 |
| filter | string | 否 | all | all、net_buy、net_sell |
| limit | number | 否 | 50 | 返回条数 |

响应 data 列表字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| trade_date | string | 交易日期 |
| ts_code | string | 股票代码 |
| name | string | 股票名称 |
| close | number | 收盘价 |
| pct_change | number | 涨跌幅，单位 % |
| turnover_rate | number | 换手率，单位 % |
| amount | number | 成交额，单位元 |
| l_buy | number | 榜单买入额，单位元 |
| l_sell | number | 榜单卖出额，单位元 |
| net_amount | number | 净买入额，单位元 |
| net_rate | number | 净买额占比，单位 % |
| reasons | string[] | 上榜理由列表 |

#### 6.1.2 GET /api/v1/dragon-tiger/{ts_code}

用途：返回单只股票龙虎榜席位明细。

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ts_code | string | 是 | 股票代码 |
| trade_date | string | 是 | 交易日期 |

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| buyers | DragonTigerInst[] | 买方席位 |
| sellers | DragonTigerInst[] | 卖方席位 |

DragonTigerInst 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| trade_date | string | 交易日期 |
| ts_code | string | 股票代码 |
| exalter | string | 营业部名称 |
| side | string | 0 买入，1 卖出 |
| buy | number | 买入金额，单位元 |
| buy_rate | number | 买入占比，单位 % |
| sell | number | 卖出金额，单位元 |
| sell_rate | number | 卖出占比，单位 % |
| net_buy | number | 净买入额，单位元 |
| reason | string | 上榜原因 |

### 6.2 标准 JSON 响应示例

#### 6.2.1 龙虎榜列表响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": [
		{
			"trade_date": "2026-03-08",
			"ts_code": "002261.SZ",
			"name": "拓维信息",
			"close": 24.68,
			"pct_change": 9.98,
			"turnover_rate": 18.32,
			"amount": 3526000000,
			"l_buy": 628000000,
			"l_sell": 411000000,
			"net_amount": 217000000,
			"net_rate": 6.15,
			"reasons": [
				"日涨幅偏离值达7%",
				"换手率异常"
			]
		}
	],
	"timestamp": 1772963280,
	"request_id": "req_dragon_list_001"
}
```

#### 6.2.2 龙虎榜详情响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": {
		"buyers": [
			{
				"trade_date": "2026-03-08",
				"ts_code": "002261.SZ",
				"exalter": "中信证券上海分公司",
				"side": "0",
				"buy": 168000000,
				"buy_rate": 4.76,
				"sell": 12000000,
				"sell_rate": 0.34,
				"net_buy": 156000000,
				"reason": "日涨幅偏离值达7%"
			}
		],
		"sellers": [
			{
				"trade_date": "2026-03-08",
				"ts_code": "002261.SZ",
				"exalter": "东方财富证券拉萨团结路第一营业部",
				"side": "1",
				"buy": 18000000,
				"buy_rate": 0.51,
				"sell": 96000000,
				"sell_rate": 2.72,
				"net_buy": -78000000,
				"reason": "日涨幅偏离值达7%"
			}
		]
	},
	"timestamp": 1772963280,
	"request_id": "req_dragon_detail_001"
}
```

---

## 7. 智能选股接口需求

### 7.1 当前能力

当前模块主要为前端筛选交互和结果展示，尚未形成完整正式接口体系。

### 7.2 目标接口建议

- POST /api/v1/picker/execute
- POST /api/v1/picker/strategy
- GET /api/v1/picker/strategies
- GET /api/v1/picker/results
- POST /api/v1/picker/backtest
- GET /api/v1/picker/backtest/{id}
- POST /api/v1/picker/backtest/compare
- POST /api/v1/picker/alert
- GET /api/v1/picker/alerts
- GET /api/v1/picker/alert-logs

### 7.3 接口要求

- 执行选股接口需支持多条件组合。
- 策略保存接口需支持名称、描述、筛选器、排序规则和模板标记。
- 回测接口需支持时间范围、调仓频率、初始资金、仓位参数。
- 预警接口需支持价格阈值、评分变更、技术信号、成交量异动等类型。

### 7.4 当前状态

规划中。

### 7.5 字段级接口定义建议

#### 7.5.1 POST /api/v1/picker/execute

请求体建议：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 否 | 本次筛选名称 |
| filters | array | 是 | 条件数组 |
| sort_by | string | 否 | 排序字段 |
| sort_order | string | 否 | asc 或 desc |
| page | number | 否 | 页码 |
| page_size | number | 否 | 每页数量 |

filters 列表字段建议：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| field | string | 是 | 字段名 |
| operator | string | 是 | eq、gt、gte、lt、lte、between |
| value | any | 是 | 条件值 |
| value2 | any | 否 | between 的第二值 |

field 建议枚举按模块分组维护，当前优先支持：

| 值 | 含义 |
| --- | --- |
| market | 市场 |
| price | 价格 |
| pct_chg | 涨跌幅 |
| volume | 成交量 |
| amount | 成交额 |
| turnover_rate | 换手率 |
| pe | 市盈率 |
| pb | 市净率 |

响应字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| strategy_id | string | 本次执行标识 |
| total | number | 总命中数 |
| list | array | 候选股票列表 |
| execution_ms | number | 执行耗时 |

list 列表建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| ts_code | string | 股票代码 |
| name | string | 股票名称 |
| score | number | 综合得分，可选 |
| matched_rules | string[] | 命中的规则说明，可选 |

#### 7.5.2 POST /api/v1/picker/backtest

请求体建议包括 strategy_id、date_range、initial_capital、position_size、max_positions、rebalance_frequency、commission、slippage。

响应字段建议包括 total_return、annual_return、max_drawdown、sharpe_ratio、win_rate、trades。

### 7.6 标准 JSON 请求/响应示例

#### 7.6.1 执行选股请求示例

```json
{
	"name": "低估值放量策略",
	"filters": [
		{ "field": "market", "operator": "eq", "value": "沪市主板" },
		{ "field": "pe", "operator": "lt", "value": 25 },
		{ "field": "turnover_rate", "operator": "gte", "value": 3 }
	],
	"sort_by": "pct_chg",
	"sort_order": "desc",
	"page": 1,
	"page_size": 20
}
```

#### 7.6.2 执行选股响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": {
		"strategy_id": "picker_exec_20260308_001",
		"total": 18,
		"list": [
			{
				"ts_code": "600309.SH",
				"name": "万华化学",
				"score": 84,
				"matched_rules": ["PE<25", "换手率>=3"]
			}
		],
		"execution_ms": 182
	},
	"timestamp": 1772963280,
	"request_id": "req_picker_execute_001"
}
```

---

## 8. AI 分析接口需求

### 8.1 目标接口清单

| 接口 | 方法 | 用途 | 当前状态 |
| --- | --- | --- | --- |
| /api/v1/ai/diagnosis/{ts_code} | GET | 获取单股综合诊断 | 规划中 |
| /api/v1/ai/diagnosis/batch | POST | 批量诊断 | 规划中 |
| /api/v1/ai/research/{ts_code} | GET | 获取研报分析 | 规划中 |
| /api/v1/ai/sentiment/{ts_code} | GET | 获取舆情分析 | 规划中 |
| /api/v1/ai/prediction/{ts_code} | GET | 获取趋势预测 | 规划中 |
| /api/v1/ai/risk/{ts_code} | GET | 获取风险预警 | 规划中 |
| /api/v1/ai/risk/market-overview | GET | 获取市场风险概览 | 规划中 |
| /api/v1/ai/chat | POST | 智能问答 | 规划中 |
| /api/v1/ai/chat/history/{session_id} | GET | 会话历史 | 规划中 |
| /api/v1/ai/recommendations | GET | 个性化推荐 | 规划中 |
| /api/v1/ai/recommendations/feedback | POST | 推荐反馈 | 规划中 |
| /api/v1/ai/system/status | GET | 系统状态 | 规划中 |

### 8.2 当前实现状态

- 当前前端页面为原型态展示。
- 当前未接入真实 AI API。

### 8.3 接口要求

- 所有 AI 接口均需返回分析时间、结果摘要、结构化明细和置信度。
- 涉及预测和建议类输出时需返回免责声明。
- 高成本接口需支持缓存、强制刷新和详细级别参数。
- 智能问答接口需支持上下文会话标识。

### 8.4 字段级接口定义

#### 8.4.1 GET /api/v1/ai/diagnosis/{ts_code}

用途：返回单股综合诊断。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| ts_code | string | 是 | - | 股票代码 |
| force_refresh | boolean | 否 | false | 是否强制刷新 |
| detail_level | string | 否 | full | brief、standard、full |

响应字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| ts_code | string | 股票代码 |
| stock_name | string | 股票名称 |
| analysis_date | string | 分析日期 |
| overall | object | 综合评分与评级 |
| technical | object | 技术面分析 |
| fundamental | object | 基本面分析 |
| capital | object | 资金面分析 |
| risks | array | 风险提示列表，可为空数组 |
| confidence | object | 置信度信息 |
| next_update | string | 建议下次更新时间 |
| disclaimer | string | 风险免责声明 |

overall 字段：score、rating、rating_code。

technical 字段：score、summary、signals、support_resistance、trend。

fundamental 字段：score、summary、strengths、concerns、peer_comparison。

capital 字段：score、summary、flow_trend、institutional_activity、net_inflow_5d、net_inflow_20d。

confidence 字段：level、score、factors。

overall.rating_code 建议枚举：

| 值 | 含义 |
| --- | --- |
| BUY | 偏积极 |
| HOLD | 中性持有 |
| SELL | 偏谨慎 |

confidence.level 建议枚举：

| 值 | 含义 |
| --- | --- |
| high | 高可信度 |
| medium | 中可信度 |
| low | 低可信度 |

#### 8.4.2 POST /api/v1/ai/chat

请求体建议：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| session_id | string | 否 | 会话标识 |
| question | string | 是 | 用户问题 |
| ts_code | string | 否 | 关联股票 |
| context | object | 否 | 附加上下文 |

响应字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| session_id | string | 会话标识 |
| answer | string | 回答文本 |
| references | array | 引用信息 |
| confidence | number | 置信度，建议范围 0-1 |
| suggested_questions | array | 推荐追问 |

### 8.5 标准 JSON 请求/响应示例

#### 8.5.1 AI 诊断响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": {
		"ts_code": "600519.SH",
		"stock_name": "贵州茅台",
		"analysis_date": "2026-03-08",
		"overall": {
			"score": 81,
			"rating": "推荐持有",
			"rating_code": "BUY"
		},
		"technical": {
			"score": 78,
			"summary": "价格维持强势区间，短期趋势偏多",
			"signals": [
				{ "name": "MACD", "signal": "bullish", "description": "零轴上方金叉" }
			],
			"support_resistance": {
				"support": 1650,
				"resistance": 1715
			},
			"trend": {
				"short": "上涨",
				"medium": "震荡偏强",
				"long": "上涨"
			}
		},
		"fundamental": {
			"score": 86,
			"summary": "盈利能力维持行业领先，估值仍处高位",
			"strengths": ["ROE稳定", "现金流充裕"],
			"concerns": ["估值分位偏高"],
			"peer_comparison": "行业领先"
		},
		"capital": {
			"score": 74,
			"summary": "近5日主力资金维持净流入",
			"flow_trend": "流入",
			"institutional_activity": "积极",
			"net_inflow_5d": 12.5,
			"net_inflow_20d": 36.8
		},
		"risks": [
			{
				"level": "medium",
				"type": "valuation",
				"description": "估值高于近三年中位水平"
			}
		],
		"confidence": {
			"level": "high",
			"score": 0.84,
			"factors": {
				"data_completeness": 0.96,
				"model_accuracy": 0.82,
				"market_regime": 0.79
			}
		},
		"next_update": "2026-03-09T09:30:00+08:00",
		"disclaimer": "本结果仅供参考，不构成投资建议。"
	},
	"timestamp": 1772963280,
	"request_id": "req_ai_diagnosis_001"
}
```

#### 8.5.2 AI 问答响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": {
		"session_id": "ai_chat_600519_001",
		"answer": "贵州茅台当前的核心矛盾在于基本面稳定与估值偏高之间的平衡。若以中线视角看，资金和盈利质量仍然较强。",
		"references": [
			{ "type": "stock_detail", "label": "个股详情" },
			{ "type": "money_flow", "label": "资金流向" }
		],
		"confidence": 0.81,
		"suggested_questions": [
			"它的估值和五粮液相比如何？",
			"近20日主力资金趋势怎么样？"
		]
	},
	"timestamp": 1772963280,
	"request_id": "req_ai_chat_001"
}
```

---

## 9. 资讯中心接口需求

### 9.1 当前能力

| 接口名称 | 方法 | 用途 | 当前状态 |
| --- | --- | --- | --- |
| fetchRealTimeNews | 前端服务函数 | 获取实时资讯聚合 | 已具备 |
| fetchNewsBySource | 前端服务函数 | 按来源获取资讯 | 已具备 |
| subscribeToNewsTable | Realtime 订阅 | 订阅单表插入事件 | 已具备 |
| subscribeToNewsTables | Realtime 订阅 | 订阅多表插入事件 | 已具备 |
| subscribeToAllNewsTables | Realtime 订阅 | 订阅全部配置表 | 已具备 |

### 9.2 目标接口建议

- GET /api/v1/news
- GET /api/v1/news/{news_id}
- GET /api/v1/news/sources
- GET /api/v1/news/search?q={keyword}
- GET /api/v1/news/announcements
- GET /api/v1/news/research-reports
- GET /api/v1/news/calendar
- GET /api/v1/news/stream

### 9.3 接口要求

- 列表接口支持来源、时间范围、关键词、分类、重要性过滤。
- 详情接口支持返回正文、来源信息、标签和关联股票。
- 流接口支持高优先级快讯实时推送或订阅。
- 公告、研报和财经日历接口可按阶段逐步实现。

### 9.4 字段级接口定义

#### 9.4.1 GET /api/v1/news

用途：返回资讯中心主列表。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| sources | string[] | 否 | 全部来源 | 来源 key 列表 |
| limit | number | 否 | 50 | 每个来源抓取数量或单页数量 |
| totalLimit | number | 否 | 500 | 总返回上限 |
| keyword | string | 否 | - | 搜索关键词，预留 |

响应 data 列表字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 资讯唯一标识 |
| title | string | 标题 |
| content | string | 正文或摘要 |
| source | string | 来源名称 |
| sourceKey | string | 来源 key |
| display_time | number | Unix 时间戳 |
| time | string | 展示时间 |
| date | string | 展示日期 |
| importance | string | urgent、high、normal |
| categories | string[] | 分类标签，无数据时返回空数组 |
| images | string[] | 图片，可选 |

sourceKey 当前已知枚举：

| 值 | 含义 |
| --- | --- |
| snowball_influencer | 雪球大V |
| weibo_influencer | 微博大V |
| twitter_influencer | 推特大V |
| wechat_influencer | 微信公众号 |
| cls | 财联社 |
| eastmoney | 东方财富 |
| jin10 | 金十数据 |
| gelonghui | 格隆汇 |
| sina | 新浪财经 |
| jqka | 同花顺 |
| jrj | 金融界 |
| futunn | 富途牛牛 |
| ifeng | 凤凰财经 |
| jin10qihuo | 金十期货 |
| snowball | 雪球 |
| wallstreetcn | 华尔街见闻 |
| xuangutong | 选股通 |
| yicai | 第一财经 |
| yuncaijing | 云财经 |

约束：

- 应按 display_time 倒序返回。
- 当 sources 为空时默认聚合全部已配置来源。
- 应过滤未来异常时间戳和无效记录。

#### 9.4.2 GET /api/v1/news/sources/{sourceKey}

用途：按来源返回资讯流。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| sourceKey | string | 是 | - | 来源标识 |
| limit | number | 否 | 80 | 返回数量 |

响应字段与资讯主列表保持一致。

约束：

- sourceKey 非法时返回空数组或 404，不应返回无关来源数据。

#### 9.4.3 GET /api/v1/news/stream

用途：提供高优先级新闻实时更新能力。

请求参数建议：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tables | string[] | 否 | 订阅的来源表列表 |

响应事件字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| tableName | string | 来源表名 |
| new | object | 新插入记录 |

当前推荐仅对高优先级来源启用实时订阅，建议优先包含以下表：

- snowball_influencer_tb
- weibo_influencer_tb
- wechat_influencer_tb
- nitter_twitter_influencer_tb
- clscntelegraph_tb
- eastmoney724_tb

### 9.5 标准 JSON 响应示例

#### 9.5.1 资讯主列表响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": [
		{
			"id": "eastmoney_987654",
			"title": "证监会就资本市场改革最新进展答记者问",
			"content": "证监会表示将继续推动中长期资金入市。",
			"source": "东方财富",
			"sourceKey": "eastmoney",
			"display_time": 1772962800,
			"time": "14:20",
			"date": "03-08",
			"importance": "high",
			"categories": ["宏观", "监管"],
			"images": []
		},
		{
			"id": "cls_123456",
			"title": "AI算力板块午后走强，多股涨停",
			"content": "财联社3月8日电，AI算力板块午后持续走强。",
			"source": "财联社",
			"sourceKey": "cls",
			"display_time": 1772962500,
			"time": "14:15",
			"date": "03-08",
			"importance": "normal",
			"categories": ["行业", "AI"]
		}
	],
	"timestamp": 1772963280,
	"request_id": "req_news_list_001"
}
```

#### 9.5.2 实时订阅事件示例

```json
{
	"event": "INSERT",
	"tableName": "clscntelegraph_tb",
	"new": {
		"id": 123456,
		"title": "财联社3月8日电，半导体板块盘中异动拉升",
		"content": "龙头个股快速冲高，市场关注度提升。",
		"display_time": 1772962860
	}
}
```

## 10. 通用接口要求

### 10.1 统一响应结构建议

建议正式 API 响应统一为：

- code：业务状态码。
- success：请求是否成功。
- message：说明信息。
- data：业务数据。
- timestamp：服务端时间戳。
- request_id：请求追踪标识。

### 10.2 错误处理要求

- 参数错误应返回清晰错误信息。
- 数据为空应明确返回空数据而非模糊失败。
- 外部依赖失败应标记为可重试或不可重试。
- 前端应对关键接口设置降级方案。

### 10.3 分页与筛选要求

- 列表接口默认支持分页。
- 大结果集接口必须支持 limit 与排序参数。
- 搜索接口建议支持模糊匹配和高亮信息。

### 10.4 鉴权要求

- 当前公开读能力可继续服务演示和只读页面。
- 涉及用户策略、回测、反馈、推荐等写接口时，必须引入身份认证与权限控制。

### 10.5 错误码建议

| 错误码 | 含义 | 适用场景 |
| --- | --- | --- |
| 400 | 参数错误 | 必填参数缺失、参数格式错误 |
| 404 | 资源不存在 | 股票代码不存在、资讯不存在 |
| 409 | 状态冲突 | 重复保存策略、重复创建规则 |
| 422 | 业务校验失败 | 回测参数非法、筛选条件冲突 |
| 429 | 请求过频 | 高频搜索、AI 接口限流 |
| 500 | 服务内部错误 | 聚合失败、解析异常 |
| 502 | 上游依赖错误 | 外部模型或数据源异常 |
| 503 | 服务暂不可用 | 数据源维护、缓存或 RPC 熔断 |

### 10.6 缓存与刷新要求

- 聚合接口应支持 force_refresh 参数或等效能力。
- 高频读接口应定义推荐 TTL，例如市场概览 120 秒、板块聚合 30 秒、资讯聚合 5 秒、个股详情包 15 秒。
- 当缓存命中时，应保证结构与非缓存响应一致。

### 10.7 统一响应包装示例

#### 10.7.1 成功响应示例

```json
{
	"code": 200,
	"success": true,
	"message": "success",
	"data": {},
	"timestamp": 1772963280,
	"request_id": "req_common_success_001"
}
```

#### 10.7.2 失败响应示例

```json
{
	"code": 422,
	"success": false,
	"message": "筛选条件冲突",
	"errors": [
		{
			"field": "filters[1]",
			"reason": "price between 区间上限不能小于下限"
		}
	],
	"timestamp": 1772963280,
	"request_id": "req_common_error_001"
}
```