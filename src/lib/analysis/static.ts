import { ESLint } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import { getFilesBatch } from '../github';
import type { GhContentItem } from '../github';
import type { StaticIssue } from '../types';

export type { StaticIssue };

export type StaticResult = {
  filesAnalyzed: number;
  issues: StaticIssue[];
  metrics: {
    totalLines: number;
    anyCount: number;
    consoleCount: number;
    todoCount: number;
    avgFunctionLength: number;
  };
  score: {
    errors: number;
    warnings: number;
    passed: boolean;
    warningsPer100: number;
    densityOk: boolean;
  };
};

const RELEVANT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'public',
];

const FLAT_CONFIG = [
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest' as const,
        sourceType: 'module' as const,
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-debugger': 'error',
      'no-empty': 'warn',
      'no-duplicate-imports': 'warn',
      'no-undef': 'off',
    },
  },
];

export async function runStaticAnalysis(
  owner: string,
  repo: string,
  tree: GhContentItem[],
  maxFiles = 25,
): Promise<StaticResult> {
  const relevantFiles = tree
    .filter((i) => i.type === 'file' && RELEVANT_EXT.test(i.path))
    .filter(
      (i) =>
        !SKIP_DIRS.some(
          (d) => i.path.includes(`/${d}/`) || i.path.startsWith(`${d}/`),
        ),
    )
    .sort((a, b) => b.size - a.size)
    .slice(0, maxFiles);

  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: FLAT_CONFIG as never,
    cwd: process.cwd(),
  } as never);

  const issues: StaticIssue[] = [];
  let totalLines = 0;
  let anyCount = 0;
  let consoleCount = 0;
  let todoCount = 0;

  // Один батч-запрос вместо 25 последовательных
  let fileContents = new Map<string, string>();
  try {
    fileContents = await getFilesBatch(
      owner,
      repo,
      relevantFiles.map((f) => f.path),
      8,
    );
  } catch (e) {
    issues.push({
      file: '(batch)',
      rule: 'fetch-failed',
      severity: 'info',
      message: `Не удалось загрузить файлы: ${(e as Error).message}`,
    });
  }

  for (const file of relevantFiles) {
    const text = fileContents.get(file.path);
    if (!text) continue;

    totalLines += text.split('\n').length;
    anyCount += (text.match(/:\s*any\b/g) ?? []).length;
    consoleCount += (text.match(/\bconsole\.\w+/g) ?? []).length;
    todoCount += (text.match(/\b(TODO|FIXME|HACK)\b/g) ?? []).length;

    try {
      const results = await eslint.lintText(text, { filePath: file.path });
      for (const r of results) {
        for (const m of r.messages) {
          issues.push({
            file: file.path,
            line: m.line,
            rule: m.ruleId ?? 'unknown',
            severity: m.severity === 2 ? 'error' : 'warning',
            message: m.message,
          });
        }
      }
    } catch (e) {
      issues.push({
        file: file.path,
        rule: 'eslint-crash',
        severity: 'info',
        message: `Не удалось проверить файл: ${(e as Error).message}`,
      });
    }
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;

  const lines = Math.max(1, totalLines);
  const warningsPer100 = (warnings / lines) * 100;
  const densityOk = warningsPer100 <= 5;
  const passed = errors === 0 && densityOk && totalLines > 0;

  return {
    filesAnalyzed: fileContents.size,
    issues: issues.slice(0, 100),
    metrics: {
      totalLines,
      anyCount,
      consoleCount,
      todoCount,
      avgFunctionLength: 0,
    },
    score: {
      errors,
      warnings,
      passed,
      warningsPer100: Number(warningsPer100.toFixed(2)),
      densityOk,
    },
  };
}