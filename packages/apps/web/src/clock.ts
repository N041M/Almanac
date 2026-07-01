import { todayISO, type Clock, type ISODate } from '@almanac/core';

// The app layer may read the real clock; the core stays deterministic and only
// ever sees this injected (L4). Timezone handling is UTC for now.
export const systemClock: Clock = { now: () => Date.now() };

export function today(): ISODate {
  return todayISO(systemClock);
}
