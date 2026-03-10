# 股票数据看板网

基于 React + TypeScript + Vite 构建的股票数据可视化看板，支持 Supabase 云端数据库。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建项目
2. 复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

3. 编辑 `.env` 文件，填入你的 Supabase 配置：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. 初始化数据库

在 Supabase SQL Editor 中运行 `supabase_schema.sql` 脚本创建数据表。

### 4. 启动开发服务器

```bash
npm run dev
```

## 资讯内容导入

资讯中心中的公司公告、研究报告、财经日历使用独立的新闻 Supabase 项目。

1. 在 `.env` 中配置以下变量：

```env
VITE_SUPABASE_NEWS_URL=https://your-news-project-id.supabase.co
VITE_SUPABASE_NEWS_ANON_KEY=your-news-anon-key-here
SUPABASE_NEWS_SERVICE_ROLE_KEY=your-news-service-role-key-here
```

2. 执行迁移，创建三张内容表：

```bash
# 在 Supabase SQL Editor 执行
app/supabase/migrations/20260309_news_content_modules.sql
```

3. 导入内置样例数据：

```bash
npm run import:news-content:sample
```

也可以按目录批量导入三类文件：

```bash
npm run import:news-content -- all ./imports/news-content
```

目录内建议使用以下文件名：

```text
announcement.json
report.json
calendar.json
```

4. 只校验归一化结果，不落库：

```bash
npm run import:news-content -- announcement --dry-run
```

5. 校验导入结果：

```bash
npm run verify:news-content
npm run verify:news-content -- research_report
```

## 智能选股 AI 代理

智能选股页默认优先请求同源代理接口 `/api/ai/screener`，这样模型 Key 不会暴露到浏览器。

1. 前端环境变量建议保持：

```env
VITE_AI_SCREENER_USE_PROXY=true
VITE_AI_SCREENER_PROXY_PATH=/api/ai/screener
```

2. 在部署平台配置服务端私有变量：

```env
AI_SCREENER_BASE_URL=https://your-openai-compatible-endpoint
AI_SCREENER_API_KEY=your-server-side-key
AI_SCREENER_MODEL=your-model-name
AI_SCREENER_PATH=/chat/completions
SUPABASE_STOCK_SERVICE_ROLE_KEY=your-stock-service-role-key-here
```

3. 如果代理未配置成功，前端会自动回退到本地规则解析，不会阻断智能选股主流程。

4. 仅在确有需要时，才建议使用 `VITE_AI_SCREENER_BASE_URL` / `VITE_AI_SCREENER_API_KEY` / `VITE_AI_SCREENER_MODEL` 做前端直连兼容。

## 预警扫描

策略工作台中的“立即扫描”会调用同源接口 `/api/picker-alert/run`，按已启用规则扫描最近两期策略快照并写入预警日志。

1. 部署时需要额外配置：

```env
VITE_SUPABASE_STOCK_URL=https://your-stock-project-id.supabase.co
SUPABASE_STOCK_SERVICE_ROLE_KEY=your-stock-service-role-key-here
```

2. 当前扫描支持的规则类型包括：`new_match`、`score_change`、`price_threshold`、`technical_signal`、`volume_spike`、`rank_change`。

3. 若后续接入定时任务，可直接定时触发 `/api/picker-alert/run`，无需改动前端。

## 📁 项目结构

```
src/
├── components/     # UI 组件
├── data/          # 模拟数据
├── hooks/         # React Hooks
│   ├── useStockData.ts  # 股票数据 Hooks
│   └── use-mobile.ts    # 移动端检测
├── lib/
│   ├── supabase.ts      # Supabase 客户端配置
│   └── utils.ts         # 工具函数
├── sections/      # 页面模块
├── services/
│   └── stockService.ts  # 数据服务层
└── types/
    ├── index.ts         # 类型定义
    └── database.ts      # Supabase 数据库类型
```

## 🔌 数据服务

项目支持 Supabase 云端数据库，当数据库未配置或出错时会自动降级到模拟数据。

### 使用示例

```tsx
import { useIndices, useHotSectors, useMarketOverview } from '@/hooks/useStockData';

// 获取指数数据
const { data: indices, loading, error, refetch } = useIndices();

// 获取热门板块
const { data: sectors } = useHotSectors(10);

// 获取市场概览（聚合多个数据源）
const { indices, sentiment, northFlow, loading } = useMarketOverview();
```

## 📊 功能模块

- **市场概览**: 大盘指数、涨跌分布、市场情绪
- **板块热点**: 行业/概念板块涨幅排行、热度分析
- **涨停分析**: 涨停板列表、连板统计
- **北向资金**: 资金流向、沪深股通数据
- **新闻资讯**: 财经新闻、公告解读
- **个股详情**: K线图、分时图、资金流向
- **算法选股**: 自定义选股策略

## 🛠️ 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite
- **UI 组件**: shadcn/ui + Tailwind CSS
- **图表库**: ECharts + Lightweight Charts
- **数据库**: Supabase (PostgreSQL)
- **HTTP 客户端**: Axios

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
