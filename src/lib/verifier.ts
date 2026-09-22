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
import type { PhaseResult, VerifyReport } from './types';

type Ctx = {
  owner: string;
  repo: string;
  repoMeta: Awaited<ReturnType<typeof getRepo>>;
  commits: Awaited<ReturnType<typeof getCommits>>;
  rootContents: Awaited<ReturnType<typeof getRootContents>>;
  readme: string | null;
  packageJson: Record<string, unknown> | null;
  tree: Awaited<ReturnType<typeof listTree>>;
};

type PhaseDef = {
  order: number;
  name: string;
  description: string;
  maxHp: number;
  run: (ctx: Ctx) => Promise<{ passed: boolean; logs: string[] }>;
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
      logs.push(hasReadme ? `✔ README найден (${readme!.length} симв.)` : '✘ README отсутствует или слишком короткий');

      const commitCount = commits.length;
      logs.push(commitCount >= 5 ? `✔ Коммитов: ${commitCount}+` : `✘ Слишком мало коммитов: ${commitCount}`);

      const dates = commits
        .map((c) => c.commit.author?.date)
        .filter(Boolean)
        .map((d) => new Date(d!).getTime());
      const uniqueDays = new Set(dates.map((t) => new Date(t).toDateString())).size;
      logs.push(uniqueDays >= 2 ? `✔ Активность в ${uniqueDays} дней` : '✘ Всё залито в один день');

      return { passed: hasReadme && commitCount >= 5 && uniqueDays >= 2, logs };
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
      logs.push(hasBuild ? `✔ Скрипт build: ${scripts.build}` : '✘ Скрипт build не найден');

      const lockFiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];
      const hasLock = names.some((n) => lockFiles.includes(n));
      logs.push(hasLock ? '✔ Lock-файл на месте' : '⚠ Lock-файл отсутствует');

      return { passed: hasPkg && hasBuild, logs };
    },
  },
  {
    order: 4,
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
      const hasTestScript = !!scripts.test && !scripts.test.includes('no test specified');
      logs.push(hasTestScript ? `✔ Скрипт test: ${scripts.test}` : '✘ Скрипт test не настроен');

      const hasRunner = ['jest.config.js', 'jest.config.ts', 'vitest.config.ts', 'vitest.config.js']
        .some((f) => paths.includes(f))
        || !!packageJson?.devDependencies && Object.keys(packageJson.devDependencies as object)
            .some((d) => /jest|vitest|mocha|ava/.test(d));
      logs.push(hasRunner ? '✔ Тест-раннер обнаружен' : '⚠ Тест-раннер не найден явно');

      return {
        passed: testFiles.length > 0 && hasTestScript,
        logs,
      };
    },
  },
  {
    order: 5,
    name: 'Деплой живой',
    description: 'Ссылка на задеплоенное приложение работает.',
    maxHp: 20,
    run: async ({ readme, repoMeta }) => {
      const logs: string[] = [];
      const sources: string[] = [];
      if (repoMeta.homepage) sources.push(repoMeta.homepage);
      if (readme) {
        const matches = readme.match(/https?:\/\/[^\s)\]<>"']+/g) ?? [];
        const deployHosts = /(vercel\.app|netlify\.app|pages\.dev|railway\.app|render\.com|fly\.dev|herokuapp\.com|github\.io)/;
        sources.push(...matches.filter((m) => deployHosts.test(m)));
      }

      if (sources.length === 0) {
        logs.push('✘ Ссылка на деплой не найдена ни в homepage, ни в README');
        return { passed: false, logs };
      }

      const url = sources[0];
      logs.push(`✔ Найдена ссылка: ${url}`);

      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'questwork-prototype' },
        });
        clearTimeout(t);
        const ok = res.status >= 200 && res.status < 400;
        logs.push(ok ? `✔ Ответ ${res.status} — деплой живой` : `✘ Ответ ${res.status}`);
        return { passed: ok, logs };
      } catch {
        logs.push('✘ Не удалось подключиться к деплою');
        return { passed: false, logs };
      }
    },
  },
  {
    order: 6,
    name: 'E2E-сценарий',
    description: 'Настроены end-to-end тесты (Playwright/Cypress).',
    maxHp: 15,
    run: async ({ tree, packageJson }) => {
      const logs: string[] = [];
      const paths = tree.map((i) => i.path);

      const e2eDir = paths.some((p) => /(^|\/)(e2e|cypress|playwright)\//.test(p));
      logs.push(e2eDir ? '✔ Директория E2E-тестов найдена' : '✘ Директория E2E не найдена');

      const deps = {
        ...(packageJson?.dependencies as object ?? {}),
        ...(packageJson?.devDependencies as object ?? {}),
      };
      const hasTool = Object.keys(deps).some((d) => /playwright|cypress|puppeteer/.test(d));
      logs.push(hasTool ? '✔ E2E-инструмент в зависимостях' : '✘ Playwright/Cypress не подключены');

      return { passed: e2eDir && hasTool, logs };
    },
  },
  {
    order: 7,
    name: 'Безопасность',
    description: 'Нет секретов, есть .gitignore.',
    maxHp: 10,
    run: async ({ rootContents, readme, tree, owner, repo }) => {
      const logs: string[] = [];
      const names = rootContents.map((i) => i.name);

      const hasGitignore = names.includes('.gitignore');
      logs.push(hasGitignore ? '✔ .gitignore на месте' : '✘ .gitignore отсутствует');

      const exposedEnv = names.some((n) => n === '.env' || n === '.env.local' || n === '.env.production');
      logs.push(exposedEnv ? '✘ .env закоммичен в репозиторий!' : '✔ .env не закоммичен');

      // Проверим, что .gitignore содержит .env
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

      // Простая эвристика поиска ключей в README
      const secretPattern = /(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})/;
      const leak = readme && secretPattern.test(readme);
      logs.push(leak ? '✘ В README найден похожий на ключ токен' : '✔ Секретов в README не найдено');

      const passed = !exposedEnv && !leak && gitignoreOk;
      return { passed, logs };
    },
  },
  {
    order: 8,
    name: 'Ревью наставника',
    description: 'Качество архитектуры и читаемость (эвристика).',
    maxHp: 5,
    run: async ({ tree, repoMeta, packageJson }) => {
      const logs: string[] = [];
      const paths = tree.map((i) => i.path);

      const hasSrc = paths.some((p) => p.startsWith('src/'));
      logs.push(hasSrc ? '✔ Есть директория src/' : '⚠ Код лежит в корне');

      const hasLicense = !!repoMeta.license && repoMeta.license.spdx_id !== 'NOASSERTION';
      logs.push(hasLicense ? `✔ Лицензия: ${repoMeta.license!.spdx_id}` : '⚠ Лицензия отсутствует');

      const hasTs = paths.some((p) => p.endsWith('.ts') || p.endsWith('.tsx'));
      logs.push(hasTs ? '✔ TypeScript в проекте' : '⚠ Только JavaScript');

      const score = [hasSrc, hasLicense, hasTs].filter(Boolean).length;
      return { passed: score >= 2, logs };
    },
  },
];

export async function runVerification(repoUrl: string): Promise<VerifyReport> {
  const ref = parseRepoUrl(repoUrl);
  if (!ref) {
    return {
      repoUrl,
      totalDamage: 0,
      bossMaxHp: 100,
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

  // Префлайт — тянем метаданные репо. Если не получилось — сразу поражение.
  let repoMeta;
  try {
    repoMeta = await getRepo(ref.owner, ref.repo);
  } catch (e) {
    const msg =
      e instanceof GitHubError && e.status === 404
        ? 'Репозиторий не найден или приватный'
        : e instanceof GitHubError && e.status === 403
        ? 'Превышен лимит GitHub API. Добавь GITHUB_TOKEN в .env.local'
        : 'Не удалось получить репозиторий';
    return {
      repoUrl,
      totalDamage: 0,
      bossMaxHp: 100,
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

  // Собираем контекст параллельно
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
    let result: { passed: boolean; logs: string[] };
    try {
      result = await def.run(ctx);
    } catch (e) {
      result = { passed: false, logs: [`✘ Ошибка проверки: ${(e as Error).message}`] };
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
    });
  }

  const victory = totalDamage >= bossMaxHp * 0.85;

  const summary = victory
    ? `Босс повержен! Нанесено ${totalDamage}/${bossMaxHp} урона.`
    : `Босс выстоял. Нанесено ${totalDamage}/${bossMaxHp} урона. Исправь слабые фазы и попробуй снова.`;

  return { repoUrl, totalDamage, bossMaxHp, victory, phases, summary };
}