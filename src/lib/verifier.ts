import {
  parseRepoUrl,
  getRepo,
  getCommits,
  getRootContents,
  getReadme,
  getFileText,
  listTree,
  GitHubError,
} from './github';
import type {
  PhaseResult,
  VerifyReport,
  StaticIssue,
  SemgrepFinding,
} from './types';
import { runStaticAnalysis, type StaticResult } from './analysis/static';
import { runSemgrep } from './analysis/semgrep';

export type QuestPhase = {
  phaseOrder: number;
  name: string;
  description: string;
  checkType: string;
  maxHp: number;
};

type Ctx = {
  owner: string;
  repo: string;
  repoMeta: Awaited<ReturnType<typeof getRepo>>;
  commits: Awaited<ReturnType<typeof getCommits>>;
  rootContents: Awaited<ReturnType<typeof getRootContents>>;
  readme: string | null;
  packageJson: Record<string, unknown> | null;
  tree: Awaited<ReturnType<typeof listTree>>;
  staticResult?: StaticResult;
  semgrepFindings?: SemgrepFinding[];
  workflowTexts?: Record<string, string>;
};

type CheckResult = {
  passed: boolean;
  logs: string[];
  details?: PhaseResult['details'];
};

type CheckFn = (ctx: Ctx) => Promise<CheckResult>;

// ---------- Утилиты ----------

async function loadWorkflowTexts(ctx: Ctx): Promise<Record<string, string>> {
  if (ctx.workflowTexts) return ctx.workflowTexts;
  const wfFiles = ctx.tree.filter(
    (i) =>
      i.type === 'file' &&
      i.path.startsWith('.github/workflows/') &&
      /\.(yml|yaml)$/.test(i.path),
  );
  const entries = await Promise.all(
    wfFiles.map(async (f) => [
      f.path,
      (await getFileText(ctx.owner, ctx.repo, f.path)) ?? '',
    ] as const),
  );
  ctx.workflowTexts = Object.fromEntries(entries);
  return ctx.workflowTexts;
}

// ---------- Деплой: типы и логика ----------

type DeployErrorKind = 'network' | 'dns' | 'ssl' | 'abort' | 'unknown';

type DeployAttempt = {
  url: string;
  method: string;
  status: number | null;
  ms: number;
  note?: string;
  error?: string;
  errorKind?: DeployErrorKind;
};

function classifyDeployError(err: Error & {
  cause?: { code?: string; message?: string };
}): DeployErrorKind {
  const causeCode = err.cause?.code ?? '';
  const causeMsg = err.cause?.message ?? '';
  const msg = `${err.message} ${causeMsg}`.toLowerCase();

  if (causeCode === 'ENOTFOUND' || msg.includes('enotfound'))
    return 'dns';
  if (
    causeCode === 'ETIMEDOUT' ||
    causeCode === 'ECONNREFUSED' ||
    causeCode === 'ECONNRESET' ||
    msg.includes('connect timeout') ||
    msg.includes('etimedout')
  )
    return 'network';
  if (msg.includes('certificate') || msg.includes('ssl') || msg.includes('tls'))
    return 'ssl';
  if (err.name === 'AbortError' || err.name === 'TimeoutError')
    return 'abort';
  return 'unknown';
}

function decideDeploy(
  a: DeployAttempt,
  logs: string[],
): { passed: boolean; logs: string[] } {
  // Есть HTTP-статус — судим по нему
  if (a.status !== null) {
    const authBlocked = a.status === 401 || a.status === 403;
    const reachable = a.status >= 200 && a.status < 500;

    if (reachable && !authBlocked) {
      logs.push(`✔ Ответ ${a.status} — деплой живой`);
      return { passed: true, logs };
    }

    if (authBlocked) {
      logs.push(`✔ Ответ ${a.status} — ${a.note}`);
      logs.push('⚠ Считаем живым: деплой существует, но закрыт авторизацией');
      return { passed: true, logs };
    }

    logs.push(`✘ Ответ ${a.status} — ${a.note ?? 'некорректный статус'}`);
    return { passed: false, logs };
  }

  // Статуса нет — классифицируем ошибку
  switch (a.errorKind) {
    case 'dns':
      logs.push('✘ DNS не находит домен — деплоя не существует');
      return { passed: false, logs };
    case 'ssl':
      logs.push('✘ Проблема с SSL-сертификатом');
      return { passed: false, logs };
    case 'network':
    case 'abort':
      logs.push(
        '⚠ Не удалось установить соединение (сеть/таймаут). Не можем проверить деплой.',
      );
      logs.push(
        '⚠ Засчитываем фазу: проблема на стороне проверяющего, а не игрока.',
      );
      return { passed: true, logs };
    default:
      logs.push(`✘ Неизвестная ошибка: ${a.error ?? 'без деталей'}`);
      return { passed: false, logs };
  }
}

// ---------- Реестр проверок ----------

const CHECKS: Record<string, CheckFn> = {
  repo_exists: async ({ repoMeta }) => ({
    passed: true,
    logs: [
      `✔ Репозиторий: ${repoMeta.full_name}`,
      `✔ Язык: ${repoMeta.language ?? 'не определён'}`,
      `✔ Размер: ${(repoMeta.size / 1024).toFixed(1)} MB`,
      `✔ Последний push: ${new Date(repoMeta.pushed_at).toLocaleDateString('ru-RU')}`,
    ],
  }),

  readme: async ({ readme, commits }) => {
    const logs: string[] = [];
    const hasReadme = !!readme && readme.length > 100;
    logs.push(
      hasReadme
        ? `✔ README найден (${readme!.length} симв.)`
        : '✘ README отсутствует или слишком короткий',
    );
    const commitCount = commits.length;
    logs.push(
      commitCount >= 5
        ? `✔ Коммитов: ${commitCount}+`
        : `✘ Слишком мало коммитов: ${commitCount}`,
    );
    const dates = commits
      .map((c) => c.commit.author?.date)
      .filter(Boolean)
      .map((d) => new Date(d!).getTime());
    const uniqueDays = new Set(dates.map((t) => new Date(t).toDateString())).size;
    logs.push(
      uniqueDays >= 2
        ? `✔ Активность в ${uniqueDays} дней`
        : '✘ Всё залито в один день',
    );
    return { passed: hasReadme && commitCount >= 5 && uniqueDays >= 2, logs };
  },

  build_config: async ({ rootContents, packageJson }) => {
    const logs: string[] = [];
    const names = rootContents.map((i) => i.name);
    const hasPkg = names.includes('package.json');
    logs.push(hasPkg ? '✔ package.json найден' : '✘ package.json отсутствует');
    const scripts = (packageJson?.scripts as Record<string, string>) ?? {};
    const hasBuild = !!scripts.build;
    logs.push(
      hasBuild ? `✔ Скрипт build: ${scripts.build}` : '✘ Скрипт build не найден',
    );
    const lockFiles = [
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'bun.lockb',
    ];
    const hasLock = names.some((n) => lockFiles.includes(n));
    logs.push(hasLock ? '✔ Lock-файл на месте' : '⚠ Lock-файл отсутствует');
    return { passed: hasPkg && hasBuild, logs };
  },

  static_analysis: async (ctx) => {
    const logs: string[] = [];
    const staticRes = await runStaticAnalysis(ctx.owner, ctx.repo, ctx.tree);
    ctx.staticResult = staticRes;

    logs.push(`✔ Проанализировано файлов: ${staticRes.filesAnalyzed}`);
    logs.push(`✔ Всего строк кода: ${staticRes.metrics.totalLines}`);
    logs.push(
      `⚠ Ошибок: ${staticRes.score.errors}, предупреждений: ${staticRes.score.warnings}`,
    );
    const per100 = staticRes.score.warningsPer100 ?? 0;
    logs.push(
      per100 <= 5
        ? `✔ Плотность предупреждений: ${per100} на 100 строк (норма)`
        : `✘ Плотность предупреждений: ${per100} на 100 строк (порог 5)`,
    );
    if (staticRes.metrics.anyCount > 0)
      logs.push(`  → any: ${staticRes.metrics.anyCount}`);
    if (staticRes.metrics.consoleCount > 0)
      logs.push(`  → console.*: ${staticRes.metrics.consoleCount}`);
    if (staticRes.metrics.todoCount > 0)
      logs.push(`  → TODO/FIXME: ${staticRes.metrics.todoCount}`);

    const filesForSemgrep = (
      await Promise.all(
        ctx.tree
          .filter(
            (i) =>
              i.type === 'file' &&
              /\.(ts|tsx|js|jsx|json|env|yml|yaml)$/.test(i.path),
          )
          .slice(0, 20)
          .map(async (i) => ({
            path: i.path,
            content: (await getFileText(ctx.owner, ctx.repo, i.path)) ?? '',
          })),
      )
    ).filter((f) => f.content);

    const semgrepFindings = await runSemgrep(filesForSemgrep);
    ctx.semgrepFindings = semgrepFindings;
    const highSeverity = semgrepFindings.filter((f) =>
      /ERROR|HIGH/i.test(f.severity),
    );
    if (highSeverity.length > 0) {
      logs.push(
        `✘ Semgrep нашёл ${highSeverity.length} проблем высокой критичности`,
      );
      for (const f of highSeverity.slice(0, 3))
        logs.push(`  → ${f.file}:${f.line} ${f.rule}`);
    } else {
      logs.push('✔ Semgrep не нашёл уязвимостей высокой критичности');
    }

    const passed = staticRes.score.passed && highSeverity.length === 0;
    return {
      passed,
      logs,
      details: {
        staticIssues: staticRes.issues.slice(0, 50),
        semgrepFindings: semgrepFindings.slice(0, 50),
        metrics: {
          filesAnalyzed: staticRes.filesAnalyzed,
          totalLines: staticRes.metrics.totalLines,
          anyCount: staticRes.metrics.anyCount,
          consoleCount: staticRes.metrics.consoleCount,
          todoCount: staticRes.metrics.todoCount,
          eslintErrors: staticRes.score.errors,
          eslintWarnings: staticRes.score.warnings,
          warningsPer100: staticRes.score.warningsPer100,
          semgrepFindings: semgrepFindings.length,
        },
      },
    };
  },

  tests: async ({ tree, packageJson }) => {
    const logs: string[] = [];
    const paths = tree.map((i) => i.path);
    const testFiles = paths.filter((p) =>
      /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(p),
    );
    logs.push(
      testFiles.length > 0
        ? `✔ Найдено тестовых файлов: ${testFiles.length}`
        : '✘ Тестовые файлы не найдены',
    );
    const scripts = (packageJson?.scripts as Record<string, string>) ?? {};
    const hasTestScript =
      !!scripts.test && !scripts.test.includes('no test specified');
    logs.push(
      hasTestScript
        ? `✔ Скрипт test: ${scripts.test}`
        : '✘ Скрипт test не настроен',
    );
    const devDeps =
      (packageJson?.devDependencies as Record<string, string>) ?? {};
    const hasRunner = Object.keys(devDeps).some((d) =>
      /jest|vitest|mocha|ava|node-tap/.test(d),
    );
    logs.push(
      hasRunner
        ? '✔ Тест-раннер обнаружен в devDependencies'
        : '⚠ Тест-раннер не найден явно',
    );
    return { passed: testFiles.length > 0 && hasTestScript, logs };
  },

  deploy: async ({ readme, repoMeta }) => {
    const logs: string[] = [];
    const sources: string[] = [];
    if (repoMeta.homepage) sources.push(repoMeta.homepage);
    if (readme) {
      const matches = readme.match(/https?:\/\/[^\s)\]<>"']+/g) ?? [];
      const deployHosts =
        /(vercel\.app|netlify\.app|pages\.dev|railway\.app|render\.com|fly\.dev|herokuapp\.com|github\.io)/;
      sources.push(...matches.filter((m) => deployHosts.test(m)));
    }

    if (sources.length === 0) {
      logs.push('✘ Ссылка на деплой не найдена ни в homepage, ни в README');
      return { passed: false, logs };
    }

    const urls = Array.from(new Set(sources)).slice(0, 2);
    logs.push(`✔ Найдено ссылок: ${urls.length}`);

    const attempt = async (
      url: string,
      method: 'HEAD' | 'GET',
      timeoutMs: number,
    ): Promise<DeployAttempt> => {
      const started = Date.now();
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, {
          method,
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; QuestWork/1.0; +https://questwork.local)',
            Accept: 'text/html,*/*',
          },
        });
        clearTimeout(t);
        return {
          url,
          method,
          status: res.status,
          ms: Date.now() - started,
          note:
            res.status === 401 || res.status === 403
              ? 'доступ закрыт (Vercel Auth / приватный preview)'
              : res.status === 404
              ? 'страница не найдена'
              : undefined,
        };
      } catch (e) {
        const err = e as Error & { cause?: { code?: string; message?: string } };
        const kind = classifyDeployError(err);
        const causeMsg = err.cause?.message ?? err.cause?.code ?? '';
        return {
          url,
          method,
          status: null,
          ms: Date.now() - started,
          errorKind: kind,
          error: `${err.name}: ${err.message}${causeMsg ? ` (${causeMsg})` : ''}`,
        };
      }
    };

    for (const url of urls) {
      logs.push(`→ Проверяем: ${url}`);

      // Быстрая попытка HEAD — многие CDN отвечают мгновенно
      const head = await attempt(url, 'HEAD', 5_000);
      logs.push(`  HEAD ${head.ms}ms → ${head.status ?? head.error}`);
      if (head.status !== null) return decideDeploy(head, logs);

      // Если HEAD не дал статуса и это DNS/SSL — сразу решаем
      if (head.errorKind === 'dns' || head.errorKind === 'ssl') {
        return decideDeploy(head, logs);
      }

      // GET с разумным таймаутом
      const get1 = await attempt(url, 'GET', 10_000);
      logs.push(`  GET ${get1.ms}ms → ${get1.status ?? get1.error}`);
      if (get1.status !== null) return decideDeploy(get1, logs);

      // Все попытки для этого URL — сетевые. Применяем правило "benefit of the doubt".
      return decideDeploy(get1, logs);
    }

    logs.push('✘ Ни одна ссылка не отвечает');
    return { passed: false, logs };
  },

  e2e: async ({ tree, packageJson }) => {
    const logs: string[] = [];
    const paths = tree.map((i) => i.path);
    const e2eDir = paths.some((p) =>
      /(^|\/)(e2e|cypress|playwright|tests-e2e)\//.test(p),
    );
    logs.push(
      e2eDir ? '✔ Директория E2E-тестов найдена' : '✘ Директория E2E не найдена',
    );
    const deps = {
      ...((packageJson?.dependencies as object) ?? {}),
      ...((packageJson?.devDependencies as object) ?? {}),
    };
    const hasTool = Object.keys(deps).some((d) =>
      /playwright|cypress|puppeteer/.test(d),
    );
    logs.push(
      hasTool
        ? '✔ E2E-инструмент в зависимостях'
        : '✘ Playwright/Cypress не подключены',
    );
    return { passed: e2eDir && hasTool, logs };
  },

  secrets: async ({ rootContents, readme, owner, repo }) => {
    const logs: string[] = [];
    const names = rootContents.map((i) => i.name);
    const hasGitignore = names.includes('.gitignore');
    logs.push(
      hasGitignore ? '✔ .gitignore на месте' : '✘ .gitignore отсутствует',
    );
    const exposedEnv = names.some(
      (n) => n === '.env' || n === '.env.local' || n === '.env.production',
    );
    logs.push(
      exposedEnv ? '✘ .env закоммичен в репозиторий!' : '✔ .env не закоммичен',
    );
    let gitignoreOk = hasGitignore;
    if (hasGitignore) {
      const gi = await getFileText(owner, repo, '.gitignore');
      if (gi && !/\.env/.test(gi)) {
        logs.push('⚠ .gitignore не содержит .env');
        gitignoreOk = false;
      } else if (gi) {
        logs.push('✔ .gitignore игнорирует .env');
      }
    }
    const secretPattern =
      /(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})/;
    const leak = readme && secretPattern.test(readme);
    logs.push(
      leak
        ? '✘ В README найден похожий на ключ токен'
        : '✔ Секретов в README не найдено',
    );
    return { passed: !exposedEnv && !leak && gitignoreOk, logs };
  },

  review: async ({ tree, repoMeta }) => {
    const logs: string[] = [];
    const paths = tree.map((i) => i.path);
    const hasSrc = paths.some((p) => p.startsWith('src/'));
    logs.push(hasSrc ? '✔ Есть директория src/' : '⚠ Код лежит в корне');
    const hasLicense =
      !!repoMeta.license && repoMeta.license.spdx_id !== 'NOASSERTION';
    logs.push(
      hasLicense
        ? `✔ Лицензия: ${repoMeta.license!.spdx_id}`
        : '⚠ Лицензия отсутствует',
    );
    const hasTs = paths.some((p) => p.endsWith('.ts') || p.endsWith('.tsx'));
    logs.push(hasTs ? '✔ TypeScript в проекте' : '⚠ Только JavaScript');
    const score = [hasSrc, hasLicense, hasTs].filter(Boolean).length;
    return { passed: score >= 2, logs };
  },

  // --- CI/CD ---

  ci_workflow: async (ctx) => {
    const logs: string[] = [];
    const wfFiles = ctx.tree.filter(
      (i) =>
        i.type === 'file' &&
        i.path.startsWith('.github/workflows/') &&
        /\.(yml|yaml)$/.test(i.path),
    );
    if (wfFiles.length === 0) {
      logs.push('✘ .github/workflows/*.yml не найдены');
      return { passed: false, logs };
    }
    logs.push(`✔ Найдено workflow-файлов: ${wfFiles.length}`);
    for (const f of wfFiles.slice(0, 3)) logs.push(`  → ${f.path}`);
    await loadWorkflowTexts(ctx);
    return { passed: true, logs };
  },

  ci_lint: async (ctx) => {
    const logs: string[] = [];
    const texts = await loadWorkflowTexts(ctx);
    const all = Object.values(texts).join('\n').toLowerCase();
    const hasLint =
      /npm run lint|pnpm lint|yarn lint|eslint|ruff |flake8|golangci-lint|npm run check/.test(
        all,
      );
    logs.push(hasLint ? '✔ Lint-шаг найден в workflow' : '✘ Lint-шаг не найден');
    return { passed: hasLint, logs };
  },

  ci_test: async (ctx) => {
    const logs: string[] = [];
    const texts = await loadWorkflowTexts(ctx);
    const all = Object.values(texts).join('\n').toLowerCase();
    const hasTest =
      /npm test|npm run test|pnpm test|yarn test|vitest|jest|pytest|go test|cargo test/.test(
        all,
      );
    logs.push(hasTest ? '✔ Test-шаг найден в workflow' : '✘ Test-шаг не найден');
    return { passed: hasTest, logs };
  },

  ci_build: async (ctx) => {
    const logs: string[] = [];
    const texts = await loadWorkflowTexts(ctx);
    const all = Object.values(texts).join('\n').toLowerCase();
    const hasBuild =
      /npm run build|pnpm build|yarn build|vite build|next build|docker build|go build|cargo build/.test(
        all,
      );
    logs.push(hasBuild ? '✔ Build-шаг найден в workflow' : '✘ Build-шаг не найден');
    return { passed: hasBuild, logs };
  },

  ci_cache: async (ctx) => {
    const logs: string[] = [];
    const texts = await loadWorkflowTexts(ctx);
    const all = Object.values(texts).join('\n').toLowerCase();
    const hasCache =
      /actions\/cache|actions\/setup-node.*cache|setup-node@.*cache|cache:.*npm|cache:.*pnpm/.test(
        all,
      );
    logs.push(
      hasCache ? '✔ Кэш зависимостей настроен' : '⚠ Кэш не обнаружен (не критично)',
    );
    return { passed: hasCache, logs };
  },

  cd_deploy: async (ctx) => {
    const logs: string[] = [];
    const texts = await loadWorkflowTexts(ctx);
    const all = Object.values(texts).join('\n').toLowerCase();
    const hasDeploy =
      /vercel|netlify|cloudflare|aws |gcloud|az |docker push|ssh |rsync|deploy|flyctl|railway/.test(
        all,
      );
    logs.push(hasDeploy ? '✔ Deploy-шаг найден' : '✘ Deploy-шаг не найден');
    return { passed: hasDeploy, logs };
  },
};

// ---------- Точка входа ----------

export async function runVerification(
  repoUrl: string,
  phases: QuestPhase[],
  victoryThreshold: number,
): Promise<VerifyReport> {
  const sorted = [...phases].sort((a, b) => a.phaseOrder - b.phaseOrder);
  const bossMaxHpTotal = sorted.reduce((s, p) => s + p.maxHp, 0) || 100;

  const ref = parseRepoUrl(repoUrl);
  if (!ref) {
    return {
      repoUrl,
      totalDamage: 0,
      bossMaxHp: bossMaxHpTotal,
      victory: false,
      phases: sorted.map((p) => ({
        order: p.phaseOrder,
        name: p.name,
        description: p.description,
        maxHp: p.maxHp,
        damage: 0,
        passed: false,
        logs: ['✘ Неверный формат ссылки GitHub'],
      })),
      summary: 'Укажи ссылку вида https://github.com/owner/repo',
    };
  }

  let repoMeta;
  try {
    repoMeta = await getRepo(ref.owner, ref.repo);
  } catch (e) {
    const err = e as Error;
    const msg =
      e instanceof GitHubError
        ? e.message
        : `Не удалось получить репозиторий: ${err.message}`;

    console.error('[verify] getRepo failed:', {
      owner: ref.owner,
      repo: ref.repo,
      status: e instanceof GitHubError ? e.status : null,
      message: err.message,
      hasToken: !!process.env.GITHUB_TOKEN,
    });

    return {
      repoUrl,
      totalDamage: 0,
      bossMaxHp: bossMaxHpTotal,
      victory: false,
      phases: sorted.map((p, idx) => ({
        order: p.phaseOrder,
        name: p.name,
        description: p.description,
        maxHp: p.maxHp,
        damage: 0,
        passed: false,
        logs: [idx === 0 ? `✘ ${msg}` : '— пропущено'],
      })),
      summary: msg,
    };
  }

  const [commits, rootContents, readme, packageRaw, tree] = await Promise.all([
    getCommits(ref.owner, ref.repo).catch(() => []),
    getRootContents(ref.owner, ref.repo).catch(() => []),
    getReadme(ref.owner, ref.repo),
    getFileText(ref.owner, ref.repo, 'package.json'),
    listTree(ref.owner, ref.repo),
  ]);

  let packageJson: Record<string, unknown> | null = null;
  if (packageRaw) {
    try {
      packageJson = JSON.parse(packageRaw);
    } catch {
      packageJson = null;
    }
  }

  const ctx: Ctx = {
    owner: ref.owner,
    repo: ref.repo,
    repoMeta,
    commits,
    rootContents,
    readme,
    packageJson,
    tree,
  };

  const results: PhaseResult[] = [];
  let totalDamage = 0;

  for (const phase of sorted) {
    const check = CHECKS[phase.checkType];
    let result: CheckResult;
    if (!check) {
      result = {
        passed: false,
        logs: [`✘ Неизвестный тип проверки: ${phase.checkType}`],
      };
    } else {
      try {
        result = await check(ctx);
      } catch (e) {
        console.error(`[verify] phase "${phase.name}" crashed:`, e);
        result = {
          passed: false,
          logs: [`✘ Ошибка проверки: ${(e as Error).message}`],
        };
      }
    }
    const damage = result.passed ? phase.maxHp : 0;
    totalDamage += damage;
    results.push({
      order: phase.phaseOrder,
      name: phase.name,
      description: phase.description,
      maxHp: phase.maxHp,
      damage,
      passed: result.passed,
      logs: result.logs,
      details: result.details,
    });
  }

  const victory = totalDamage >= bossMaxHpTotal * (victoryThreshold / 100);
  const summary = victory
    ? `Босс повержен! Нанесено ${totalDamage}/${bossMaxHpTotal} урона.`
    : `Босс выстоял. Нанесено ${totalDamage}/${bossMaxHpTotal} урона. Исправь слабые фазы и попробуй снова.`;

  return {
    repoUrl,
    totalDamage,
    bossMaxHp: bossMaxHpTotal,
    victory,
    phases: results,
    summary,
  };
}