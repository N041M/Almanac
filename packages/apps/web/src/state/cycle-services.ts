import { createCycleStore } from '@almanac/cycle';
import { dayStore, storagePort } from './persistence';
import { systemClock } from '../clock';

// Composition root for the cycle module. Flow rides the shared day store;
// the prediction switch persists under a module key. Local-only, like every
// slice (L6) — nothing here ever leaves the device.
export const cycleStore = createCycleStore(storagePort, dayStore, systemClock);
