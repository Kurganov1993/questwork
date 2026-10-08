/**
 * Склонение русских существительных после числительных.
 *
 * plural(1, ['герой', 'героя', 'героев']) → 'герой'
 * plural(2, ['герой', 'героя', 'героев']) → 'героя'
 * plural(5, ['герой', 'героя', 'героев']) → 'героев'
 * plural(23, ['герой', 'героя', 'героев']) → 'героя'
 */
export function plural(
  n: number,
  forms: [string, string, string],
): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/**
 * Число вместе со склонённым словом.
 * pluralize(4, ['герой', 'героя', 'героев']) → '4 героя'
 */
export function pluralize(
  n: number,
  forms: [string, string, string],
): string {
  return `${n} ${plural(n, forms)}`;
}

/**
 * Только склонённое слово без числа.
 */
export function pluralWord(
  n: number,
  forms: [string, string, string],
): string {
  return plural(n, forms);
}