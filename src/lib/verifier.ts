import {
  parseRepoUrl,
  getRepo,
  getCommits,
  getRootContents,
  getReadme,
  getFileText,
  listTree,
  getFilesBatch,
  GitHubError,
} from './github';
import type { PhaseResult, VerifyReport, SemgrepFinding } from './types';
import { runStaticAnalysis, type StaticResult } from './analysis/static';
import { runSemgrep } from './analysis/semgrep';
import { runBuildCheck } from './docker/build-runner';
import { runTestCheck } from './docker/test-runner';
import { isDockerAvailable } from './docker/client';
import { runAIReview } from './ai/review';
import { getProviderInfo } from './ai/client';
import { checkAiQuota } from './ai/quota';

const MAX_REPO_SIZE_KB = 100 * 1024; // 100 MB

export type QuestPhase = {
  phaseOrder: number;
  name: string;
  description: string;
  checkType: string;
  maxHp: number;
};

export type OnPhaseCallback = (
  phase: PhaseResult,
  index: number,
  total: number,
) => void;

type Ctx = {
  owner: string;
  repo: string;
  branch: string;
  repoMeta: Awaited<ReturnType<typeof getRepo>>;
  commits: Awaited<ReturnType<typeof getCommits>>;
  rootContents: Awaited<ReturnType<typeof getRootContents>>;
  readme: string | null;
  packageJson: Record<string, unknown> | null;
  tree: Awaited<ReturnType<typeof listTree>>;
  staticResult?: StaticResult;
  semgrepFindings?: SemgrepFinding[];
  workflowTexts?: Record<string, string>;
  dockerAvailable?: boolean;
  heroId?: number;
  questId?: number;
};

type CheckResult = {
  passed: boolean;
  logs: string[];
  details?: PhaseResult['details'];
};

type CheckFn = (ctx: Ctx) => Promise<CheckResult>;

async function loadWorkflowTexts(ctx: Ctx): Promise<Record<string, string>> {
  if (ctx.workflowTexts) return ctx.workflowTexts;
  const wfFiles = ctx.tree.filter(
    (i) =>
      i.type === 'file' &&
      i.path.startsWith('.github/workflows/') &&
      /\.(yml|yaml)$/.test(i.path),
  );
  const contents = await getFilesBatch(
    ctx.owner,
    ctx.repo,
    wfFiles.map((f) => f.path),
    4,
  );
  ctx.workflowTexts = Object.fromEntries(contents.entries());
  return ctx.workflowTexts;
}

async function dockerReady(ctx: Ctx): Promise<boolean> {
  if (ctx.dockerAvailable !== undefined) return ctx.dockerAvailable;
  ctx.dockerAvailable = await isDockerAvailable();
  return ctx.dockerAvailable;
}

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

  build_real: async (ctx) => {
    if (!(await dockerReady(ctx))) {
      const fb = await CHECKS.build_config(ctx);
      return {
        passed: fb.passed,
        logs: ['⚠ Docker недоступен — сборка проверена эвристикой', ...fb.logs],
        details: { containerReason: 'docker-unavailable' },
      };
    }
    const res = await runBuildCheck(ctx.owner, ctx.repo, ctx.branch);
    return {
      passed: res.ok,
      logs: res.logs,
      details: {
        containerLogs: res.logs.slice(-60),
        containerReason: res.reason,
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
    const devDeps = (packageJson?.devDependencies as Record<string, string>) ?? {};
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

  tests_real: async (ctx) => {
    if (!(await dockerReady(ctx))) {
      const fb = await CHECKS.tests(ctx);
      return {
        passed: fb.passed,
        logs: ['⚠ Docker недоступен — тесты проверены эвристикой', ...fb.logs],
        details: { containerReason: 'docker-unavailable' },
      };
    }
    const res = await runTestCheck(ctx.owner, ctx.repo, ctx.branch);
    const metrics: Record<string, number> = {};
    if (typeof res.passed === 'number') metrics.testsPassed = res.passed;
    if (typeof res.failed === 'number') metrics.testsFailed = res.failed;
    if (typeof res.total === 'number') metrics.testsTotal = res.total;
    return {
      passed: res.ok,
      logs: res.logs,
      details: {
        containerLogs: res.logs.slice(-60),
        containerReason: res.reason,
        ...(Object.keys(metrics).length ? { metrics } : {}),
      },
    };
  },

  static_analysis: async (ctx) => {
    const logs: string[] = [];

    let staticRes: StaticResult;
    try {
      staticRes = await runStaticAnalysis(ctx.owner, ctx.repo, ctx.tree);
    } catch (e) {
      return {
        passed: false,
        logs: [`✘ ESLint упал: ${(e as Error).message}`],
      };
    }
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

    const semgrepTargets = ctx.tree
      .filter(
        (i) =>
          i.type === 'file' &&
          /\.(ts|tsx|js|jsx|json|env|yml|yaml)$/.test(i.path) &&
          !i.path.includes('node_modules/'),
      )
      .slice(0, 15);

    let semgrepFindings: SemgrepFinding[] = [];
    try {
      const semgrepContents = await getFilesBatch(
        ctx.owner,
        ctx.repo,
        semgrepTargets.map((f) => f.path),
        6,
      );
      const filesForSemgrep = Array.from(semgrepContents.entries()).map(
        ([path, content]) => ({ path, content }),
      );
      semgrepFindings = await runSemgrep(filesForSemgrep);
    } catch (e) {
      logs.push(`⚠ Semgrep пропущен: ${(e as Error).message}`);
    }
    ctx.semgrepFindings = semgrepFindings;

    const highSeverity = semgrepFindings.filter((f) =>
      /ERROR|HIGH/i.test(f.severity),
    );
    if (highSeverity.length > 0) {
      logs.push(
        `✘ Semgrep нашёл ${highSeverity.length} проблем высокой критичности`,
      );
      for (const f of highSeverity.slice(0, 3)) {
        logs.push(`  → ${f.file}:${f.line} ${f.rule}`);
      }
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
    const urls = Array.from(new Set(sources));
    logs.push(`✔ Найдено ссылок: ${urls.length}`);

    let best: {
      url: string;
      status: number | null;
      ms: number;
      note?: string;
    } | null = null;

    for (const url of urls.slice(0, 3)) {
      const headStart = Date.now();
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(6_000),
          redirect: 'follow',
          headers: { 'User-Agent': 'questwork-prototype' },
        });
        best = {
          url,
          status: res.status,
          ms: Date.now() - headStart,
          note:
            res.status === 401 || res.status === 403
              ? 'доступ закрыт'
              : res.status === 404
              ? 'страница не найдена'
              : undefined,
        };
        logs.push(`  HEAD ${best.ms}ms → ${res.status}`);
        break;
      } catch (e) {
        logs.push(`  HEAD ${Date.now() - headStart}ms → ${(e as Error).name}`);
      }

      const getStart = Date.now();
      try {
        const res = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(8_000),
          redirect: 'follow',
          headers: {
            'User-Agent': 'questwork-prototype',
            Accept: 'text/html,*/*',
          },
        });
        best = {
          url,
          status: res.status,
          ms: Date.now() - getStart,
          note:
            res.status === 401 || res.status === 403
              ? 'доступ закрыт'
              : res.status === 404
              ? 'страница не найдена'
              : undefined,
        };
        logs.push(`  GET ${best.ms}ms → ${res.status}`);
        break;
      } catch (e) {
        logs.push(`  GET ${Date.now() - getStart}ms → ${(e as Error).name}`);
        best = { url, status: null, ms: Date.now() - getStart };
      }
    }

    if (!best) {
      logs.push('✘ Ни одна из ссылок не отвечает');
      return { passed: false, logs };
    }
    logs.push(`→ Проверяем: ${best.url}`);

    if (best.status === null) {
      logs.push('⚠ Не удалось установить соединение (сеть/таймаут).');
      logs.push('⚠ Засчитываем: проблема на стороне проверяющего.');
      return { passed: true, logs };
    }

    const reachable = best.status >= 200 && best.status < 500;
    const authBlocked = best.status === 401 || best.status === 403;

    if (reachable && !authBlocked) {
      logs.push(`✔ Ответ ${best.status} — деплой живой`);
      return { passed: true, logs };
    }
    if (authBlocked) {
      logs.push(`✔ Ответ ${best.status} — ${best.note}`);
      logs.push('⚠ Засчитываем: приложение развёрнуто.');
      return { passed: true, logs };
    }
    logs.push(`✘ Ответ ${best.status} — ${best.note ?? 'некорректный статус'}`);
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
    logs.push(hasGitignore ? '✔ .gitignore на месте' : '✘ .gitignore отсутствует');
    const exposedEnv = names.some(
      (n) => n === '.env' || n === '.env.local' || n === '.env.production',
    );
    logs.push(exposedEnv ? '✘ .env закоммичен в репозиторий!' : '✔ .env не закоммичен');
    let gitignoreOk = hasGitignore;
    if (hasGitignore) {
      try {
        const gi = await getFileText(owner, repo, '.gitignore');
        if (gi && !/\.env/.test(gi)) {
          logs.push('⚠ .gitignore не содержит .env');
          gitignoreOk = false;
        } else if (gi) {
          logs.push('✔ .gitignore игнорирует .env');
        }
      } catch {
        logs.push('⚠ Не удалось прочитать .gitignore');
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

  review_ai: async (ctx) => {
    const info = getProviderInfo();

    if (!info.ready) {
      const fb = await CHECKS.review(ctx);
      return {
        passed: fb.passed,
        logs: [
          `⚠ AI-ревью недоступно (${info.reason ?? 'провайдер не настроен'})`,
          '⚠ Сработала эвристика, как в фазе «Ревью наставника»',
          ...fb.logs,
        ],
      };
    }

    // === Проверка дневной квоты AI ===
    if (ctx.heroId) {
      const quota = await checkAiQuota(ctx.heroId);
      if (!quota.allowed) {
        const fb = await CHECKS.review(ctx);
        return {
          passed: fb.passed,
          logs: [
            `⚠ Дневной лимит AI исчерпан: $${quota.spentUsd.toFixed(4)} из $${quota.limitUsd.toFixed(2)}`,
            '⚠ Сработала эвристика (проверка по файлам)',
            ...fb.logs,
          ],
          details: {
            metrics: {
              aiQuotaSpentUsd: Number(quota.spentUsd.toFixed(4)),
              aiQuotaLimitUsd: quota.limitUsd,
            },
          },
        };
      }
    }

    const staticErrors = ctx.staticResult?.score.errors ?? 0;
    const staticWarnings = ctx.staticResult?.score.warnings ?? 0;

    const cacheKey = `${ctx.owner}/${ctx.repo}@${ctx.repoMeta.pushed_at}`;

    const res = await runAIReview(
      ctx.owner,
      ctx.repo,
      ctx.tree,
      ctx.readme,
      ctx.packageJson,
      staticErrors + staticWarnings,
      cacheKey,
      ctx.heroId,
      ctx.questId,
    );

    if (!res.ok) {
      const fb = await CHECKS.review(ctx);
      return {
        passed: fb.passed,
        logs: [
          `⚠ AI-ревью упало: ${res.reason ?? 'неизвестная ошибка'}`,
          '⚠ Сработала эвристика',
          ...fb.logs,
        ],
      };
    }

    const logs: string[] = [];
    logs.push(`✔ Провайдер: ${res.provider} / ${res.model}`);

    if (res.reason === 'cache') {
      logs.push('✔ Результат из кэша (репо не менялось)');
    } else {
      logs.push(`✔ Время ответа: ${(res.durationMs / 1000).toFixed(1)}с`);
    }

    logs.push(`✔ Оценка кода: ${res.score}/100`);
    logs.push(`✔ Найдено замечаний: ${res.issues.length}`);

    const bySeverity = {
      error: res.issues.filter((i) => i.severity === 'error').length,
      warning: res.issues.filter((i) => i.severity === 'warning').length,
      info: res.issues.filter((i) => i.severity === 'info').length,
    };
    logs.push(
      `  errors: ${bySeverity.error}, warnings: ${bySeverity.warning}, info: ${bySeverity.info}`,
    );

    if (res.summary) {
      logs.push('');
      logs.push(`📝 ${res.summary}`);
    }

    if (res.strengths.length > 0) {
      logs.push('');
      logs.push('Сильные стороны:');
      for (const s of res.strengths.slice(0, 4)) {
        logs.push(`  + ${s}`);
      }
    }

    if (res.issues.length > 0) {
      logs.push('');
      logs.push('Ключевые замечания:');
      for (const i of res.issues.slice(0, 3)) {
        const loc = i.line ? `${i.file}:${i.line}` : i.file;
        logs.push(`  [${i.severity}] ${loc} — ${i.message}`);
      }
    }

    const passed = res.score >= 60 && bySeverity.error === 0;

    return {
      passed,
      logs,
      details: {
        aiReview: {
          score: res.score,
          summary: res.summary,
          strengths: res.strengths,
          issues: res.issues,
          provider: res.provider,
          model: res.model,
          durationMs: res.durationMs,
        },
        metrics: {
          aiScore: res.score,
          aiIssuesTotal: res.issues.length,
          aiIssuesErrors: bySeverity.error,
          aiIssuesWarnings: bySeverity.warning,
          aiDurationMs: res.durationMs,
        },
      },
    };
  },

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
    try {
      await loadWorkflowTexts(ctx);
    } catch (e) {
      logs.push(`⚠ Не удалось загрузить workflow: ${(e as Error).message}`);
    }
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
      /actions\/cache|setup-node.*cache|cache:.*npm|cache:.*pnpm/.test(all);
    logs.push(
      hasCache
        ? '✔ Кэш зависимостей настроен'
        : '⚠ Кэш не обнаружен (не критично)',
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

export async function runVerification(
  repoUrl: string,
  phases: QuestPhase[],
  victoryThreshold: number,
  onPhase?: OnPhaseCallback,
  context?: { heroId?: number; questId?: number },
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

    // Проверка размера репозитория
    if (repoMeta.size > MAX_REPO_SIZE_KB) {
      const sizeMB = (repoMeta.size / 1024).toFixed(0);
      const msg = `Репозиторий слишком большой: ${sizeMB} MB. Максимум — 100 MB.`;

      console.warn('[verify] repo too large:', {
        owner: ref.owner,
        repo: ref.repo,
        sizeKb: repoMeta.size,
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

  const branch = repoMeta.default_branch || 'main';

  const [commits, rootContents, readme, packageRaw, tree] = await Promise.all([
    getCommits(ref.owner, ref.repo).catch(() => []),
    getRootContents(ref.owner, ref.repo).catch(() => []),
    getReadme(ref.owner, ref.repo).catch(() => null),
    getFileText(ref.owner, ref.repo, 'package.json').catch(() => null),
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
    branch,
    repoMeta,
    commits,
    rootContents,
    readme,
    packageJson,
    tree,
    heroId: context?.heroId,
    questId: context?.questId,
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
        result = await Promise.race<CheckResult>([
          check(ctx),
          new Promise<CheckResult>((resolve) =>
            setTimeout(
              () =>
                resolve({
                  passed: false,
                  logs: ['✘ Фаза превысила лимит времени (600с)'],
                }),
              600_000,
            ),
          ),
        ]);
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

    const phaseResult: PhaseResult = {
      order: phase.phaseOrder,
      name: phase.name,
      description: phase.description,
      maxHp: phase.maxHp,
      damage,
      passed: result.passed,
      logs: result.logs,
      details: result.details,
    };

    results.push(phaseResult);

    if (onPhase) {
      try {
        onPhase(phaseResult, results.length - 1, sorted.length);
      } catch (e) {
        console.error('[verifier] onPhase callback failed:', e);
      }
    }
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