export const HERO_CLASSES = [
  { value: 'frontend_mage', label: 'Frontend Mage', icon: '🧙', desc: 'React, Vue, вёрстка' },
  { value: 'backend_warrior', label: 'Backend Warrior', icon: '⚔️', desc: 'Node, Go, БД' },
  { value: 'devops_paladin', label: 'DevOps Paladin', icon: '🛡️', desc: 'Docker, CI/CD, инфра' },
  { value: 'qa_rogue', label: 'QA Rogue', icon: '🗡️', desc: 'Тесты, автоматизация' },
  { value: 'designer_bard', label: 'Designer Bard', icon: '🎨', desc: 'UI/UX, Figma' },
  { value: 'pm_druid', label: 'PM Druid', icon: '🌿', desc: 'Процессы, коммуникация' },
] as const;

export type HeroClassValue = (typeof HERO_CLASSES)[number]['value'];