import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile(filePath) {
  return fs.readFile(filePath, 'utf8')
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx < 0) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    })
    .catch(() => undefined);
}

async function loadEnv() {
  await loadEnvFile(path.join(__dirname, '.env'));
  await loadEnvFile(path.join(__dirname, '.env.local'));
}

function usage() {
  console.log('用法: npm run import:news-content -- <announcement|report|calendar|all> [json文件路径]');
  console.log('示例: npm run import:news-content -- announcement ./data/announcements.json');
  console.log('示例: npm run import:news-content -- all');
  console.log('示例: npm run import:news-content -- all ./imports/news-content');
  console.log('目录导入约定: announcement.json / report.json|research_report.json / calendar.json|finance_calendar.json');
  console.log('附加参数: --dry-run 仅校验并打印归一化结果，不写入数据库');
}

function toDateString(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function toTimeString(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.length === 5 ? `${raw}:00` : raw;
  }
  return null;
}

function normalizeImportance(value, moduleName) {
  if (typeof value === 'number') return value;
  switch (String(value || '').trim()) {
    case 'urgent':
      return 1;
    case 'high':
    case '重要':
      return moduleName === 'calendar' ? 1 : 2;
    case 'low':
    case '低':
      return moduleName === 'calendar' ? 3 : 4;
    case 'normal':
    case '普通':
    default:
      return moduleName === 'calendar' ? 2 : 3;
  }
}

function normalizeCalendarStatus(value) {
  if (typeof value === 'number') return value;
  switch (String(value || '').trim()) {
    case 'ongoing':
    case '进行中':
      return 1;
    case 'done':
    case '已结束':
      return 2;
    case 'upcoming':
    case '未开始':
    default:
      return 0;
  }
}

function ensureArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  throw new Error('JSON 内容必须是数组，或包含 items 数组字段');
}

const MODULE_CONFIG = {
  announcement: {
    table: 'announcement',
    key: 'ann_id',
    normalize(record, index) {
      const annId = String(record.ann_id || record.id || `ann_${Date.now()}_${index}`).trim();
      const annDate = toDateString(record.ann_date || record.date || record.publish_date);
      if (!annDate) throw new Error(`第 ${index + 1} 条公告缺少有效 ann_date`);
      const tsCode = String(record.ts_code || record.code || '').trim();
      const title = String(record.title || '').trim();
      if (!tsCode || !title) throw new Error(`第 ${index + 1} 条公告缺少 ts_code 或 title`);
      return {
        ann_id: annId,
        ts_code: tsCode,
        stock_name: record.stock_name || record.name || null,
        title,
        ann_type: record.ann_type || record.type || '其他公告',
        ann_sub_type: record.ann_sub_type || record.sub_type || null,
        content: record.content || null,
        summary: record.summary || null,
        file_url: record.file_url || record.pdf_url || record.url || null,
        source: record.source || null,
        ann_date: annDate,
        importance: normalizeImportance(record.importance, 'announcement'),
        related_anns: Array.isArray(record.related_anns) ? record.related_anns : [],
      };
    },
  },
  report: {
    table: 'research_report',
    key: 'report_id',
    normalize(record, index) {
      const reportId = String(record.report_id || record.id || `report_${Date.now()}_${index}`).trim();
      const reportDate = toDateString(record.report_date || record.date || record.publish_date);
      const title = String(record.title || '').trim();
      if (!reportDate || !title) throw new Error(`第 ${index + 1} 条研报缺少 report_date 或 title`);
      return {
        report_id: reportId,
        title,
        summary: record.summary || record.content || null,
        org_name: record.org_name || record.org || null,
        author: record.author || record.analyst || null,
        rating: record.rating || null,
        rating_change: record.rating_change || null,
        pre_rating: record.pre_rating || null,
        target_price: record.target_price ?? record.target ?? null,
        pre_target_price: record.pre_target_price ?? null,
        eps_forecast: record.eps_forecast ?? null,
        pe_forecast: record.pe_forecast ?? null,
        ts_code: record.ts_code || record.code || null,
        stock_name: record.stock_name || record.name || null,
        industry: record.industry || null,
        report_type: record.report_type || record.type || '个股',
        report_date: reportDate,
        pages: record.pages ?? null,
        file_url: record.file_url || record.pdf_url || record.url || null,
        read_count: record.read_count ?? 0,
        download_count: record.download_count ?? 0,
      };
    },
  },
  calendar: {
    table: 'finance_calendar',
    key: 'event_id',
    normalize(record, index) {
      const eventId = String(record.event_id || record.id || `event_${Date.now()}_${index}`).trim();
      const eventDate = toDateString(record.event_date || record.date);
      const eventName = String(record.event_name || record.event || record.title || '').trim();
      if (!eventDate || !eventName) throw new Error(`第 ${index + 1} 条日历事件缺少 event_date 或 event_name`);
      return {
        event_id: eventId,
        event_type: record.event_type || record.type || '其他',
        event_name: eventName,
        event_desc: record.event_desc || record.description || null,
        ts_code: record.ts_code || record.code || null,
        stock_name: record.stock_name || record.name || null,
        event_date: eventDate,
        event_time: toTimeString(record.event_time || record.time),
        importance: normalizeImportance(record.importance, 'calendar'),
        status: normalizeCalendarStatus(record.status),
        remind_time: record.remind_time || null,
        remind_sent: Boolean(record.remind_sent || false),
        extra_data: record.extra_data && typeof record.extra_data === 'object' ? record.extra_data : {},
      };
    },
  },
};

const DEFAULT_SAMPLE_INPUTS = {
  announcement: './src/data/announcement.sample.json',
  report: './src/data/research_report.sample.json',
  calendar: './src/data/finance_calendar.sample.json',
};

const DIRECTORY_INPUT_CANDIDATES = {
  announcement: ['announcement.json', 'announcement.sample.json'],
  report: ['report.json', 'research_report.json', 'research_report.sample.json'],
  calendar: ['calendar.json', 'finance_calendar.json', 'finance_calendar.sample.json'],
};

function chunk(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function resolveInputPath(moduleName, inputFile) {
  const candidate = inputFile || DEFAULT_SAMPLE_INPUTS[moduleName];
  if (!candidate) {
    throw new Error(`模块 ${moduleName} 缺少输入文件，且未配置默认样例`);
  }
  return path.isAbsolute(candidate) ? candidate : path.join(__dirname, candidate);
}

async function resolveAllModeInputFile(inputFile, moduleName) {
  if (!inputFile) return undefined;

  const resolvedBasePath = path.isAbsolute(inputFile) ? inputFile : path.join(__dirname, inputFile);
  const stats = await fs.stat(resolvedBasePath).catch(() => null);
  if (!stats?.isDirectory()) {
    return inputFile;
  }

  for (const fileName of DIRECTORY_INPUT_CANDIDATES[moduleName] || []) {
    const candidatePath = path.join(resolvedBasePath, fileName);
    const exists = await fs.stat(candidatePath).then((candidateStats) => candidateStats.isFile()).catch(() => false);
    if (exists) {
      return candidatePath;
    }
  }

  throw new Error(`目录 ${resolvedBasePath} 中未找到模块 ${moduleName} 对应的 JSON 文件`);
}

async function loadNormalizedRecords(moduleName, inputFile) {
  const resolvedInput = resolveInputPath(moduleName, inputFile);
  const rawText = await fs.readFile(resolvedInput, 'utf8');
  const rawPayload = JSON.parse(rawText);
  const items = ensureArrayPayload(rawPayload);
  const config = MODULE_CONFIG[moduleName];
  const normalized = items.map((item, index) => config.normalize(item, index));

  return {
    config,
    normalized,
    resolvedInput,
  };
}

async function importModule({ moduleName, inputFile, dryRun, client }) {
  const { config, normalized, resolvedInput } = await loadNormalizedRecords(moduleName, inputFile);

  if (dryRun) {
    console.log(`dry-run: ${moduleName} 共 ${normalized.length} 条，来源 ${path.relative(__dirname, resolvedInput)}`);
    console.log(JSON.stringify(normalized.slice(0, 3), null, 2));
    return normalized.length;
  }

  if (!client) {
    throw new Error(`模块 ${moduleName} 导入缺少数据库客户端`);
  }

  console.log(`开始导入 ${moduleName}，共 ${normalized.length} 条，目标表 ${config.table}`);
  let importedCount = 0;

  for (const batch of chunk(normalized, 200)) {
    const { error } = await client
      .from(config.table)
      .upsert(batch, { onConflict: config.key, ignoreDuplicates: false });

    if (error) {
      throw new Error(`导入 ${moduleName} 失败: ${error.message}`);
    }

    importedCount += batch.length;
    console.log(`已导入 ${moduleName} ${importedCount}/${normalized.length}`);
  }

  console.log(`导入完成: ${moduleName} 共 ${importedCount} 条`);
  return importedCount;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter((arg) => arg !== '--dry-run');
  const [moduleName, inputFile] = filteredArgs;
  if (!moduleName || (moduleName !== 'all' && !(moduleName in MODULE_CONFIG))) {
    usage();
    process.exit(1);
  }

  await loadEnv();

  const newsUrl = process.env.VITE_SUPABASE_NEWS_URL;
  const newsKey = process.env.SUPABASE_NEWS_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_NEWS_ANON_KEY;

  if (!newsUrl || !newsKey) {
    console.error('缺少 VITE_SUPABASE_NEWS_URL 或可用的 Key');
    process.exit(1);
  }

  const targetModules = moduleName === 'all'
    ? Object.keys(MODULE_CONFIG)
    : [moduleName];

  const client = dryRun ? null : createClient(newsUrl, newsKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let totalImported = 0;

  for (const targetModule of targetModules) {
    const moduleInputFile = moduleName === 'all'
      ? await resolveAllModeInputFile(inputFile, targetModule)
      : inputFile;
    const importedCount = await importModule({
      moduleName: targetModule,
      inputFile: moduleInputFile,
      dryRun,
      client,
    });
    totalImported += importedCount;
  }

  console.log(`${dryRun ? '校验完成' : '导入完成'}: ${moduleName} 共 ${totalImported} 条`);
}

main().catch((error) => {
  console.error('导入脚本执行失败:', error);
  process.exit(1);
});