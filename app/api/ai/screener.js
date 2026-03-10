function buildMessages(prompt) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const baseUrl = process.env.AI_SCREENER_BASE_URL;
  const apiKey = process.env.AI_SCREENER_API_KEY;
  const model = process.env.AI_SCREENER_MODEL;
  const path = process.env.AI_SCREENER_PATH || '/chat/completions';

  if (!baseUrl || !apiKey || !model) {
    res.status(503).json({ error: 'AI proxy is not configured' });
    return;
  }

  const prompt = req.body?.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
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
      const errorText = await response.text();
      res.status(response.status).json({ error: errorText || 'Upstream AI request failed' });
      return;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: 'Upstream AI returned empty content' });
      return;
    }

    const draft = JSON.parse(content);
    res.status(200).json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    res.status(502).json({ error: message });
  }
}