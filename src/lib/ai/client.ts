export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatOpts = {
  messages: ChatMessage[];
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

export type ChatResult = {
  text: string;
  provider: string;
  model: string;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
};

export type ProviderInfo = {
  provider: string;
  model: string;
  ready: boolean;
  reason?: string;
};

export function getProviderInfo(): ProviderInfo {
  const provider = (process.env.AI_PROVIDER ?? 'none').toLowerCase();
  const model = process.env.AI_MODEL ?? '';

  if (provider === 'none' || provider === '') {
    return {
      provider: 'none',
      model: '',
      ready: false,
      reason: 'AI_PROVIDER не задан',
    };
  }

  if (provider === 'ollama') {
    return {
      provider,
      model: model || 'qwen2.5-coder:7b',
      ready: true,
    };
  }

  if (provider === 'openai' || provider === 'anthropic') {
    if (!process.env.AI_API_KEY)
      return { provider, model, ready: false, reason: 'AI_API_KEY не задан' };
    if (!model)
      return { provider, model, ready: false, reason: 'AI_MODEL не задан' };
    return { provider, model, ready: true };
  }

  return {
    provider,
    model,
    ready: false,
    reason: `Неизвестный провайдер: ${provider}`,
  };
}

export async function chat(opts: ChatOpts): Promise<ChatResult> {
  const info = getProviderInfo();
  if (!info.ready) throw new Error(info.reason ?? 'AI провайдер не готов');

  // Дефолт — 300 секунд, потому что локальные модели медленные
  const timeoutMs = opts.timeoutMs ?? 300_000;
  const t0 = Date.now();

  if (info.provider === 'openai') {
    return chatOpenAI(opts, info, timeoutMs, t0);
  }
  if (info.provider === 'anthropic') {
    return chatAnthropic(opts, info, timeoutMs, t0);
  }
  if (info.provider === 'ollama') {
    return chatOllama(opts, info, timeoutMs, t0);
  }

  throw new Error(`Провайдер ${info.provider} не поддерживается`);
}

async function chatOpenAI(
  opts: ChatOpts,
  info: ProviderInfo,
  timeoutMs: number,
  t0: number,
): Promise<ChatResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: info.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1500,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    text,
    provider: 'openai',
    model: info.model,
    durationMs: Date.now() - t0,
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  };
}

async function chatAnthropic(
  opts: ChatOpts,
  info: ProviderInfo,
  timeoutMs: number,
  t0: number,
): Promise<ChatResult> {
  const systemMsg = opts.messages.find((m) => m.role === 'system')?.content;
  const userMsgs = opts.messages.filter((m) => m.role !== 'system');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.AI_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: info.model,
      max_tokens: opts.maxTokens ?? 1500,
      temperature: opts.temperature ?? 0.2,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: userMsgs,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = data.content?.map((c) => c.text ?? '').join('') ?? '';
  return {
    text,
    provider: 'anthropic',
    model: info.model,
    durationMs: Date.now() - t0,
    tokensIn: data.usage?.input_tokens,
    tokensOut: data.usage?.output_tokens,
  };
}

async function chatOllama(
  opts: ChatOpts,
  info: ProviderInfo,
  timeoutMs: number,
  t0: number,
): Promise<ChatResult> {
  const baseUrl = process.env.AI_BASE_URL ?? 'http://localhost:11434';

  // Ключевые параметры производительности Ollama:
  //   num_ctx     — размер окна контекста. У qwen по умолчанию 32768,
  //                 из-за чего модель выделяет огромный KV-кэш.
  //                 4096 → в 8 раз меньше памяти, в 2-3 раза быстрее.
  //   num_predict — максимум выходных токенов.
  //   keep_alive  — сколько держать модель в RAM после ответа.
  const numCtx = Number(process.env.AI_NUM_CTX ?? 4096);
  const keepAlive = process.env.AI_KEEP_ALIVE ?? '30m';

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: info.model,
      messages: opts.messages,
      stream: false,
      keep_alive: keepAlive,
      ...(opts.jsonMode ? { format: 'json' } : {}),
      options: {
        temperature: opts.temperature ?? 0.2,
        num_predict: opts.maxTokens ?? 1500,
        num_ctx: numCtx,
        top_p: 0.9,
        repeat_penalty: 1.05,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };

  const text = data.message?.content ?? '';
  return {
    text,
    provider: 'ollama',
    model: info.model,
    durationMs: Date.now() - t0,
    tokensIn: data.prompt_eval_count,
    tokensOut: data.eval_count,
  };
}