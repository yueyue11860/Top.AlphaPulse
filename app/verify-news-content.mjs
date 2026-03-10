import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    return;
  }
}

async function main() {
  await loadEnvFile(path.join(__dirname, '.env'));
  await loadEnvFile(path.join(__dirname, '.env.local'));

  const newsUrl = process.env.VITE_SUPABASE_NEWS_URL;
  const newsKey = process.env.SUPABASE_NEWS_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_NEWS_ANON_KEY;

  if (!newsUrl || !newsKey) {
    console.error('缺少 VITE_SUPABASE_NEWS_URL 或可用的 Key');
    process.exit(1);
  }

  const client = createClient(newsUrl, newsKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const args = process.argv.slice(2);
  const requestedModule = args[0] || 'all';

  const modules = [
    { name: 'announcement', table: 'announcement', orderField: 'ann_date' },
    { name: 'research_report', table: 'research_report', orderField: 'report_date' },
    { name: 'finance_calendar', table: 'finance_calendar', orderField: 'event_date' },
  ];

  const selectedModules = requestedModule === 'all'
    ? modules
    : modules.filter((module) => module.name === requestedModule || module.table === requestedModule);

  if (selectedModules.length === 0) {
    console.error('用法: npm run verify:news-content -- [announcement|research_report|finance_calendar|all]');
    process.exit(1);
  }

  for (const module of selectedModules) {
    const { count, error: countError } = await client
      .from(module.table)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error(`${module.table} 计数失败: ${countError.message}`);
      continue;
    }

    const { data, error } = await client
      .from(module.table)
      .select('*')
      .order(module.orderField, { ascending: false })
      .limit(2);

    if (error) {
      console.error(`${module.table} 查询样本失败: ${error.message}`);
      continue;
    }

    console.log(`\n=== ${module.name} ===`);
    console.log(`总数: ${count || 0}`);
    console.log(`最新字段: ${module.orderField}`);
    console.log(JSON.stringify(data || [], null, 2));
  }
}

main().catch((error) => {
  console.error('校验脚本执行失败:', error);
  process.exit(1);
});