/**
 * Food-name normalization for catalog identity (§7): two entered names are the
 * same ingredient iff their normalized forms match. Deliberately conservative
 * — folding and plural-stripping only, no fuzzy matching: typo tolerance
 * belongs in *suggestions the user confirms* (autocomplete), never in silent
 * merges ("beef" and "beet" are one edit apart).
 *
 * **English-only for now.** Other locales are planned as translate-to-English
 * before matching/search, so this stays the single canonical form.
 */

/** Words that end in "s" without being plural — never stripped. */
const NOT_PLURAL_ENDINGS = /(ss|us|is)$/;

/** Naive English singular: onions→onion, berries→berry, tomatoes→tomato. */
function singularizeEn(word: string): string {
  if (word.length <= 3 || NOT_PLURAL_ENDINGS.test(word)) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|ses|xes|zes|oes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Lowercase, diacritic-folded, whitespace-collapsed, per-word singularized. */
export function normalizeFoodName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .map(singularizeEn)
    .join(' ');
}

/** True when two entered names identify the same catalog ingredient. */
export function sameFoodName(a: string, b: string): boolean {
  return normalizeFoodName(a) === normalizeFoodName(b);
}
