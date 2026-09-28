export const CHECK_TYPES = [
  { value: 'repo_exists', label: 'Репозиторий открыт', desc: 'GitHub-репозиторий доступен по ссылке.' },
  { value: 'readme', label: 'README и структура', desc: 'Есть README, осмысленные коммиты.' },
  { value: 'build_config', label: 'Сборка проекта', desc: 'Есть package.json и скрипт build.' },
  { value: 'static_analysis', label: 'Статический анализ', desc: 'ESLint и Semgrep.' },
  { value: 'tests', label: 'Тесты', desc: 'Есть конфигурация тестов и тестовые файлы.' },
  { value: 'deploy', label: 'Деплой живой', desc: 'Ссылка на задеплоенное приложение работает.' },
  { value: 'e2e', label: 'E2E-сценарий', desc: 'Playwright/Cypress подключены.' },
  { value: 'secrets', label: 'Безопасность', desc: 'Нет секретов, есть .gitignore.' },
  { value: 'review', label: 'Ревью наставника', desc: 'Архитектура и читаемость.' },
  { value: 'ci_workflow', label: 'CI: workflow-файл', desc: 'Есть .github/workflows/*.yml.' },
  { value: 'ci_lint', label: 'CI: lint-шаг', desc: 'В workflow есть линтер.' },
  { value: 'ci_test', label: 'CI: test-шаг', desc: 'В workflow запускаются тесты.' },
  { value: 'ci_build', label: 'CI: build-шаг', desc: 'В workflow есть сборка.' },
  { value: 'ci_cache', label: 'CI: кэш', desc: 'actions/cache или аналог.' },
  { value: 'cd_deploy', label: 'CI: deploy-шаг', desc: 'Шаг деплоя в workflow.' },
] as const;

export type CheckType = (typeof CHECK_TYPES)[number]['value'];