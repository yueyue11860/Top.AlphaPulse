import { generateScreenerDraftFromPrompt, type AIScreenerDraft } from './aiScreenerAssistant';

interface AICompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AICompletionChoice {
  message?: {
    content?: string;
  };
}

interface AICompletionResponse {
  choices?: AICompletionChoice[];
}

interface ProxyDraftResponse {
  draft?: AIScreenerDraft;
  error?: string;
}

function buildMessages(prompt: string): AICompletionMessage[] {
  return [
    {
      role: 'system',
      content: [
        '你是 A 股智能选股条件生成助手。',
        '请将用户自然语言意图转换为严格 JSON。',
        '只输出 JSON，不要输出 Markdown。',
        'JSON 结构如下：',
        '{',
        '  "title": string,',
        '  "params": {',
        '    "market": "all|sh|sz|cy|kc|bj",',
        '    "priceMin"?: number,',
        '    "priceMax"?: number,',
        '    "changeMin"?: number,',
        '    "changeMax"?: number,',
        '    "volumeMin"?: number,',
        '    "volumeMax"?: number,',
        '    "selectedFilters": string[],',
        '    "sortBy": "score|change"',
        '  },',
        '  "explanations": string[],',
        '  "warnings": string[]',
        '}',
        '可用 selectedFilters: macd_golden,kdj_oversold,ma_bull,boll_break,volume_burst,break_high,pe_low,roe_high,growth,low_debt,main_inflow,big_order,high_turnover。',
        '如果不确定，就少填条件，不要臆造数据。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: prompt,
    },
  ];
}

function normalizeDraft(parsed: AIScreenerDraft, source: 'model' | 'local'): AIScreenerDraft {
  return {
    title: parsed.title || 'AI 条件建议',
    params: parsed.params || {},
    explanations: parsed.explanations || [],
    warnings: parsed.warnings || [],
    source,
  };
}

function withLocalFallback(draft: AIScreenerDraft, warning?: string): AIScreenerDraft {
  return {
    ...draft,
    source: 'local',
    warnings: warning ? [warning, ...draft.warnings] : draft.warnings,
  };
}

export async function generateScreenerDraft(prompt: string): Promise<AIScreenerDraft> {
  const useProxy = import.meta.env.VITE_AI_SCREENER_USE_PROXY !== 'false';
  const proxyPath = import.meta.env.VITE_AI_SCREENER_PROXY_PATH || '/api/ai/screener';
  const baseUrl = import.meta.env.VITE_AI_SCREENER_BASE_URL;
  const apiKey = import.meta.env.VITE_AI_SCREENER_API_KEY;
  const model = import.meta.env.VITE_AI_SCREENER_MODEL;
  const path = import.meta.env.VITE_AI_SCREENER_PATH || '/chat/completions';

  if (useProxy) {
    try {
      const response = await fetch(proxyPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`AI 代理请求失败: ${response.status}`);
      }

      const payload = (await response.json()) as ProxyDraftResponse;
      if (!payload.draft) {
        throw new Error(payload.error || 'AI 代理未返回草稿');
      }

      return normalizeDraft(payload.draft, 'model');
    } catch (error) {
      if (!baseUrl || !apiKey || !model) {
        const localDraft = await generateScreenerDraftFromPrompt(prompt);
        const message = error instanceof Error ? error.message : 'AI 代理异常';
        return withLocalFallback(localDraft, `${message}，已自动回退到本地规则解析。`);
      }
    }
  }

  if (!baseUrl || !apiKey || !model) {
    const localDraft = await generateScreenerDraftFromPrompt(prompt);
    return withLocalFallback(localDraft, '未配置大模型网关，已自动回退到本地规则解析。');
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: buildMessages(prompt),
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI 网关请求失败: ${response.status}`);
    }

    const payload = (await response.json()) as AICompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI 网关未返回内容');
    }

    const parsed = JSON.parse(content) as AIScreenerDraft;
    return normalizeDraft(parsed, 'model');
  } catch (error) {
    const localDraft = await generateScreenerDraftFromPrompt(prompt);
    const message = error instanceof Error ? error.message : 'AI 网关异常';
    return withLocalFallback(localDraft, `${message}，已自动回退到本地规则解析。`);
  }
}