import { getFilesBatch } from '../github';
import type { GhContentItem } from '../github';
import { chat, getProviderInfo } from './client';
import { withRetry } from '../db-retry';

export type AIReviewIssue = {
  file: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  suggestion: string;
};

export type AIReviewResult = {
  ok: boolean;
  score: number;
  summary: string;
  strengths: string[];
  issues: AIReviewIssue[];
  provider: string;
  model: string;
  durationMs: number;
  reason?: string;
};

const SYSTEM_PROMPT = `Ты — опытный tech lead, который проводит код-ревью студенческих и пет-проектов.

Твоя задача: разобрать код и дать честные, полезные, конкретные замечания.

ПРАВИЛА:
1. Отвечай ТОЛЬКО валидным JSON без markdown и без обрамления.
2. Будь конкретным: не "плохая архитектура", а "функция handleOrder делает 5 вещей сразу: валидация, запрос к API, форматирование, отправка email, обновление стейта".
3. Ссылайся на файлы и (если можешь) номера строк из присланного кода.
4. Severity:
   - "error" — баги, утечки, дыры в безопасности.
   - "warning" — плохие практики, потенциальные проблемы, отсутствие обработки ошибок.
   - "info" — стилистические и архитектурные замечания.
5. 5–8 issues. Не дублируй одно и то же в разных файлах.
6. Хвали конкретно: не "хороший код", а "вынес API-вызовы в отдельный модуль, это правильно".
7. Пиши по-русски, коротко, без воды.

ФОРМАТ ОТВЕТА:
{
  "score": 0-100,
  "summary": "1-2 предложения общей оценки проекта.",
  "strengths": ["...", "..."],
  "issues": [
    {
      "file": "src/components/ProductForm.tsx",
      "line": 42,
      "severity": "warning",
      "category": "error-handling",
      "message": "fetch не обёрнут в try/catch, ошибки сети уронят компонент.",
      "suggestion": "Оберни await fetch в try/catch, покажи пользователю сообщение об ошибке."
    }
  ]
}

Категории: error-handling, security, performance, architecture, readability, testing, types, state-management, a11y.`;

export async function runAIReview(
  owner: string,
  repo: string,
  tree: GhContentItem[],
  readme: string | null,
  packageJson: Record<string, unknown> | null,
  staticIssuesHint: number,
): Promise<AIReviewResult> {
  const info = getProviderInfo();
  if (!info.ready) {
    return {
      ok: false,
      score: 0,
      summary: '',
      strengths: [],
      issues: [],
      provider: info.provider,
      model: info.model,
      durationMs: 0,
      reason: info.reason ?? 'AI-провайдер недоступен',
    };
  }

  const t0 = Date.now();

  try {
    const context = await buildReviewContext(
      owner,
      repo,
      tree,
      readme,
      packageJson,
      staticIssuesHint,
    );

    const userPrompt = `Репозиторий: ${owner}/${repo}
Язык: ${context.language}

README (фрагмент):
${context.readme}

package.json (фрагмент):
${context.packageJson}

Всего файлов: ${context.totalFiles}
Крупных файлов в анализе: ${context.files.length}
Уже найдено ESLint-предупреждений: ${staticIssuesHint}

=== ФАЙЛЫ ===
${context.files
  .map((f) => `\n--- ${f.path} (${f.lines} строк) ---\n${f.content}`)
  .join('\n')}

Дай ревью в JSON-формате из системного промпта.`;

    const result = await chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      jsonMode: true,
      maxTokens: 1200,
      temperature: 0.2,
      timeoutMs: 300_000,
    });

    const parsed = parseReviewJson(result.text);
    if (!parsed) {
      return {
        ok: false,
        score: 0,
        summary: '',
        strengths: [],
        issues: [],
        provider: info.provider,
        model: info.model,
        durationMs: Date.now() - t0,
        reason: 'Не удалось распарсить JSON от модели',
      };
    }

    return {
      ok: true,
      score: clampScore(parsed.score),
      summary: String(parsed.summary ?? '').slice(0, 500),
      strengths: (parsed.strengths ?? []).slice(0, 10).map(String),
      issues: (parsed.issues ?? []).slice(0, 15).map((i) => ({
        file: String(i.file ?? '').slice(0, 200),
        line: typeof i.line === 'number' ? i.line : undefined,
        severity: normalizeSeverity(i.severity),
        category: String(i.category ?? 'general').slice(0, 40),
        message: String(i.message ?? '').slice(0, 500),
        suggestion: String(i.suggestion ?? '').slice(0, 500),
      })),
      provider: info.provider,
      model: info.model,
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      ok: false,
      score: 0,
      summary: '',
      strengths: [],
      issues: [],
      provider: info.provider,
      model: info.model,
      durationMs: Date.now() - t0,
      reason: (e as Error).message.slice(0, 300),
    };
  }
}

async function buildReviewContext(
  owner: string,
  repo: string,
  tree: GhContentItem[],
  readme: string | null,
  packageJson: Record<string, unknown> | null,
  _staticIssuesHint: number,
) {
  const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
  const SKIP_DIRS = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'coverage',
    'public',
  ];

  const codeFiles = tree
    .filter((i) => i.type === 'file' && CODE_EXT.test(i.path))
    .filter(
      (i) =>
        !SKIP_DIRS.some(
          (d) => i.path.includes(`/${d}/`) || i.path.startsWith(`${d}/`),
        ),
    )
    .filter((i) => !/\.(test|spec)\./.test(i.path));

  // Берём топ-3 файла по размеру, не больше 150 строк каждый.
  // Меньше контекста → быстрее inference у локальной модели.
  const topFiles = codeFiles.sort((a, b) => b.size - a.size).slice(0, 3);

  const fileContents = await withRetry(
    () =>
      getFilesBatch(
        owner,
        repo,
        topFiles.map((f) => f.path),
        4,
      ),
    { label: 'ai-review:load-files' },
  );

  const files = topFiles
    .map((f) => {
      const raw = fileContents.get(f.path);
      if (!raw) return null;
      const lines = raw.split('\n');
      const truncated = lines.slice(0, 150).join('\n');
      return {
        path: f.path,
        lines: lines.length,
        content: truncated,
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const pkgSnippet = packageJson
    ? JSON.stringify(
        {
          name: packageJson.name,
          dependencies: packageJson.dependencies,
          scripts: packageJson.scripts,
        },
        null,
        2,
      ).slice(0, 800)
    : '(нет)';

  return {
    language: packageJson ? 'JavaScript/TypeScript' : 'неизвестно',
    readme: readme ? readme.slice(0, 600) : '(нет)',
    packageJson: pkgSnippet,
    totalFiles: codeFiles.length,
    files,
  };
}

function parseReviewJson(text: string): {
  score?: number;
  summary?: string;
  strengths?: string[];
  issues?: Array<{
    file?: string;
    line?: number;
    severity?: string;
    category?: string;
    message?: string;
    suggestion?: string;
  }>;
} | null {
  let cleaned = text.trim();

  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace > 0 || lastBrace < cleaned.length - 1) {
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function normalizeSeverity(s: unknown): 'error' | 'warning' | 'info' {
  if (s === 'error' || s === 'warning' || s === 'info') return s;
  return 'info';
}

function clampScore(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}