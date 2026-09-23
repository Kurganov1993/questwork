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
};

type PhaseDef = {
  order: number;
  name: string;
  description: string;
  maxHp: number;
  run: (ctx: Ctx) => Promise<{
    passed: boolean;
    logs: string[];
    details?: PhaseResult['details'];
  }>;
};

const PHASES: PhaseDef[] = [
  {
    order: 1,
    name: 'Репозиторий открыт',
    description: 'GitHub-репозиторий доступен по ссылке.',
    maxHp: 10,
    run: async ({ repoMeta }) => ({
      passed: true,
      logs: [
        `✔ Репозиторий: ${repoMeta.full_name}`,
        `✔ Язык: ${repoMeta.language ?? 'не определён'}`,
        `✔ Размер: ${(repoMeta.size / 1024).toFixed(1)} MB`,
        `✔ Последний push: ${new Date(repoMeta.pushed_at).toLocaleDateString('ru-RU')}`,
      ],
    }),
  },
  {
    order: 2,
    name: 'README и структура',
    description: 'Есть README, осмысленные коммиты.',
    maxHp: 10,
    run: async ({ readme, commits }) => {
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

      return {
        passed: hasReadme && commitCount >= 5 && uniqueDays >= 2,
        logs,
      };
    },
  },
  {
    order: 3,
    name: 'Сборка проекта',
    description: 'Есть конфигурация сборки и скрипт build.',
    maxHp: 15,
    run: async ({ rootContents, packageJson }) => {
      const logs: string[] = [];
      const names = rootContents.map((i) => i.name);

      const hasPkg = names.includes('package.json');
      logs.push(hasPkg ? '✔ package.json найден' : '✘ package.json отсутствует');

      const scripts = (packageJson?.scripts as Record<string, string>) ?? {};
      const hasBuild = !!scripts.build;
      logs.push(
        hasBuild ? `✔ Скрипт build: ${scripts.build}` : '✘ Скрипт build не найден',
      );

      const lockFiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];
      const hasLock = names.some((n) => lockFiles.includes(n));
      logs.push(hasLock ? '✔ Lock-файл на месте' : '⚠ Lock-файл отсутствует');

      return { passed: hasPkg && hasBuild, logs };
    },
  },
  {
    order: 4,
    name: 'Статический анализ',
    description: 'ESLint и Semgrep: стиль, уязвимости, секреты.',
    maxHp: 10,
    run: async (ctx) => {
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

      if (staticRes.metrics.anyCount > 0) {
        logs.push(`  → any: ${staticRes.metrics.anyCount}`);
      }
      if (staticRes.metrics.consoleCount > 0) {
        logs.push(`  → console.*: ${staticRes.metrics.consoleCount}`);
      }
      if (staticRes.metrics.todoCount > 0) {
        logs.push(`  → TODO/FIXME: ${staticRes.metrics.todoCount}`);
      }

      const topErrors = staticRes.issues
        .filter((i) => i.severity === 'error')
        .slice(0, 3);
      for (const issue of topErrors) {
        logs.push(
          `  → ${issue.file}:${issue.line ?? '?'} ${issue.rule}: ${issue.message}`,
        );
      }

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
  },
  {
    order: 5,
    name: 'Тесты проходят',
    description: 'Есть конфигурация тестов и тестовые файлы.',
    maxHp: 15,
    run: async ({ tree, packageJson }) => {
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

      return {
        passed: testFiles.length > 0 && hasTestScript,
        logs,
      };
    },
  },
  {
    order: 6,
    name: 'Деплой живой',
    description: 'Ссылка на задеплоенное приложение работает.',
    maxHp: 20,
    run: async ({ readme, repoMeta }) => {
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
      let best: {
        url: string;
        status: number | null;
        ms: number;
        note?: string;
      } | null = null;

      for (const url of urls.slice(0, 3)) {
        const started = Date.now();
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
              'User-Agent': 'questwork-prototype',
              Accept: 'text/html,*/*',
            },
          });
          clearTimeout(t);

          best = {
            url,
            status: res.status,
            ms: Date.now() - started,
            note:
              res.status === 401 || res.status === 403
                ? 'доступ закрыт (возможно, Vercel Auth / приватный preview)'
                : res.status === 404
                ? 'страница не найдена'
                : undefined,
          };
          break;
        } catch {
          if (!best) {
            best = { url, status: null, ms: Date.now() - started };
          }
        }
      }

      if (!best) {
        logs.push('✘ Ни одна из ссылок не отвечает');
        return { passed: false, logs };
      }

      logs.push(`✔ Проверяем: ${best.url}`);
      logs.push(`  Время ответа: ${best.ms}ms`);

      if (best.status === null) {
        logs.push('✘ Деплой недоступен (DNS/сеть/таймаут)');
        return { passed: false, logs };
      }

      const reachable = best.status >= 200 && best.status < 500;
      const authBlocked = best.status === 401 || best.status === 403;

      if (reachable && !authBlocked) {
        logs.push(`✔ Ответ ${best.status} — деплой живой`);
        return { passed: true, logs };
      }

      if (authBlocked) {
        logs.push(`✔ Ответ ${best.status} — ${best.note}`);
        logs.push(
          '⚠ Засчитываем как «деплой существует», но проверить содержимое не можем',
        );
        return { passed: true, logs };
      }

      logs.push(`✘ Ответ ${best.status} — ${best.note ?? 'некорректный статус'}`);
      return { passed: false, logs };
    },
  },
  {
    order: 7,
    name: 'E2E-сценарий',
    description: 'Настроены end-to-end тесты (Playwright/Cypress).',
    maxHp: 15,
    run: async ({ tree, packageJson }) => {
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
  },
  {
    order: 8,
    name: 'Безопасность',
    description: 'Нет секретов, есть .gitignore.',
    maxHp: 10,
    run: async ({ rootContents, readme, owner, repo }) => {
      const logs: string[] = [];
      const names = rootContents.map((i) => i.name);

      const hasGitignore = names.includes('.gitignore');
      logs.push(hasGitignore ? '✔ .gitignore на месте' : '✘ .gitignore отсутствует');

      const exposedEnv = names.some(
        (n) => n === '.env' || n === '.env.local' || n === '.env.production',
      );
      logs.push(
        exposedEnv
          ? '✘ .env закоммичен в репозиторий!'
          : '✔ .env не закоммичен',
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

      const passed = !exposedEnv && !leak && gitignoreOk;
      return { passed, logs };
    },
  },
  {
    order: 9,
    name: 'Ревью наставника',
    description: 'Качество архитектуры и читаемость (эвристика).',
    maxHp: 5,
    run: async ({ tree, repoMeta }) => {
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
  },
];

export async function runVerification(
  repoUrl: string,
  victoryThreshold = 85,
): Promise<VerifyReport> {
  const bossMaxHpTotal = PHASES.reduce((s, p) => s + p.maxHp, 0);

  const ref = parseRepoUrl(repoUrl);
  if (!ref) {
    return {
      repoUrl,
      totalDamage: 0,
      bossMaxHp: bossMaxHpTotal,
      victory: false,
      phases: PHASES.map((p) => ({
        order: p.order,
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
      rateLimit: e instanceof GitHubError ? e.rateLimit : null,
      hasToken: !!process.env.GITHUB_TOKEN,
    });

    return {
      repoUrl,
      totalDamage: 0,
      bossMaxHp: bossMaxHpTotal,
      victory: false,
      phases: PHASES.map((p) => ({
        order: p.order,
        name: p.name,
        description: p.description,
        maxHp: p.maxHp,
        damage: 0,
        passed: false,
        logs: [p.order === 1 ? `✘ ${msg}` : '— пропущено'],
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

  const phases: PhaseResult[] = [];
  let totalDamage = 0;
  let bossMaxHp = 0;

  for (const def of PHASES) {
    bossMaxHp += def.maxHp;
    let result: Awaited<ReturnType<PhaseDef['run']>>;
    try {
      result = await def.run(ctx);
    } catch (e) {
      console.error(`[verify] phase "${def.name}" crashed:`, e);
      result = {
        passed: false,
        logs: [`✘ Ошибка проверки: ${(e as Error).message}`],
      };
    }
    const damage = result.passed ? def.maxHp : 0;
    totalDamage += damage;

    phases.push({
      order: def.order,
      name: def.name,
      description: def.description,
      maxHp: def.maxHp,
      damage,
      passed: result.passed,
      logs: result.logs,
      details: result.details,
    });
  }

  const victory = totalDamage >= bossMaxHp * (victoryThreshold / 100);

  const summary = victory
    ? `Босс повержен! Нанесено ${totalDamage}/${bossMaxHp} урона.`
    : `Босс выстоял. Нанесено ${totalDamage}/${bossMaxHp} урона. Исправь слабые фазы и попробуй снова.`;

  return { repoUrl, totalDamage, bossMaxHp, victory, phases, summary };
}