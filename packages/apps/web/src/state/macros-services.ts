import { createMacrosStore } from '@almanac/macros';
import { dayStore, storagePort } from './persistence';
import { systemClock } from '../clock';

// Composition root for the macros module. Targets persist under a module key;
// the per-day intake log rides the shared day store; the planned meal's macros
// derive on read from the food catalog (already wired in meals-services), §8.
export const macrosStore = createMacrosStore(storagePort, dayStore, systemClock);
