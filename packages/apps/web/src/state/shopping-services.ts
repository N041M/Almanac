import { createShoppingStore } from '@almanac/shopping';
import { storagePort } from './persistence';
import { systemClock } from '../clock';

// Composition root for the shopping module. The list is derived on demand from
// the plan (the meals day slices) and the food catalog — both already wired in
// meals-services — so only the schedule is durable here (§8.1).
export const shoppingStore = createShoppingStore(storagePort, systemClock);
