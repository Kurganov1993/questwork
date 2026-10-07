/**
 * Реквизиты оператора персональных данных.
 *
 * Оператор — физическое лицо. По 152-ФЗ (ст. 18.1) оператор-физлицо
 * обязан опубликовать ФИО и контакт для обращений. ИНН/ОГРН/адрес
 * не обязательны, предоставляются по запросу Роскомнадзора.
 */
export const LEGAL = {
  // Название платформы
  platformName: 'QuestWork',
  platformUrl: 'https://questwork.app',

  // Оператор — физическое лицо
  operator: {
    // Полное ФИО
    name: 'Курганов Андрей Андреевич',
    // Правовой статус
    status: 'физическое лицо',
    // Основной контакт для обращений (152-ФЗ, ст. 14, 17)
    email: 'kurganov232@icloud.com',
    // Юридические запросы
    legalEmail: 'kurganov232@icloud.com',
    // Техподдержка
    supportEmail: 'kurganov232@icloud.com',
    // Реквизиты — не публикуются, выдаются по официальному запросу
    inn: null,
    ogrn: null,
    address: null,
  },

  // Дата последней редакции
  updatedAt: '7 октября 2025 г.',

  // Минимальный возраст
  minAge: 18,

  // Внешние обработчики данных
  processors: [
    {
      name: 'Neon',
      service: 'База данных',
      country: 'США',
      link: 'https://neon.tech/privacy-policy',
    },
    {
      name: 'ZvenoAI',
      service: 'AI-обработка кода',
      country: 'Россия',
      link: 'https://zveno.ai',
    },
    {
      name: 'GitHub',
      service: 'Хранение репозиториев и OAuth-авторизация',
      country: 'США',
      link: 'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement',
    },
    {
      name: 'Sentry',
      service: 'Мониторинг ошибок',
      country: 'США',
      link: 'https://sentry.io/privacy/',
    },
  ],
};