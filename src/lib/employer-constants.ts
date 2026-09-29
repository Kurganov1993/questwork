export const EMPLOYER_STATUSES = [
  {
    value: 'shortlisted',
    label: 'В шортлисте',
    color: 'blue',
  },
  {
    value: 'interview',
    label: 'Интервью',
    color: 'amber',
  },
  {
    value: 'hired',
    label: 'Нанят',
    color: 'emerald',
  },
  {
    value: 'rejected',
    label: 'Отказ',
    color: 'red',
  },
] as const;

export type EmployerStatus = (typeof EMPLOYER_STATUSES)[number]['value'];

export function getEmployerStatusMeta(value: string | null | undefined) {
  if (!value) return null;
  return EMPLOYER_STATUSES.find((s) => s.value === value) ?? null;
}

export const STATUS_STYLE: Record<string, string> = {
  shortlisted: 'bg-blue-500/20 text-blue-300 border-blue-700/40',
  interview: 'bg-amber-500/20 text-amber-300 border-amber-700/40',
  hired: 'bg-emerald-500/20 text-emerald-300 border-emerald-700/40',
  rejected: 'bg-red-500/20 text-red-300 border-red-700/40',
};