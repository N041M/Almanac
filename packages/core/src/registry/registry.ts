/**
 * The context-signal registry — the L1 seam for *behaviour*. Modules register
 * providers (e.g. weather → a "conditions" signal); consumers read abstractly
 * and never import the producing module (the meal engine consumes a weather
 * signal without importing the weather module).
 *
 * Consumers **must** define behaviour for when no provider is registered — `get`
 * returns `undefined`, and that is a normal, handled state (L5).
 */
export interface SignalRegistry {
  register<T>(name: string, provider: () => T): void;
  /** The signal's current value, or `undefined` if nothing provides it (L5). */
  get<T>(name: string): T | undefined;
  has(name: string): boolean;
  unregister(name: string): void;
}

export function createSignalRegistry(): SignalRegistry {
  const providers = new Map<string, () => unknown>();
  return {
    register(name, provider) {
      providers.set(name, provider);
    },
    get<T>(name: string): T | undefined {
      const provider = providers.get(name);
      if (provider === undefined) return undefined;
      try {
        return provider() as T;
      } catch {
        return undefined; // a throwing provider degrades to "signal absent" (L5)
      }
    },
    has(name) {
      return providers.has(name);
    },
    unregister(name) {
      providers.delete(name);
    },
  };
}
