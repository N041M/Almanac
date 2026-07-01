import type { ISODate } from '@almanac/core';

/** A UTC `Date` for `Intl` formatting of a calendar date (timezone-stable). */
export function dateFromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}
