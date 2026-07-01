import { describe, it, expect } from 'vitest';
import { createSignalRegistry } from './index.js';

describe('SignalRegistry', () => {
  it('returns undefined when no provider is registered (L5)', () => {
    const reg = createSignalRegistry();
    expect(reg.get<number>('weather.tempC')).toBeUndefined();
    expect(reg.has('weather.tempC')).toBe(false);
  });

  it('mediates a registered provider without the consumer knowing the source', () => {
    const reg = createSignalRegistry();
    reg.register<number>('weather.tempC', () => 21);
    expect(reg.get<number>('weather.tempC')).toBe(21);
    expect(reg.has('weather.tempC')).toBe(true);
  });

  it('a throwing provider degrades to "signal absent", never propagates', () => {
    const reg = createSignalRegistry();
    reg.register('flaky', () => {
      throw new Error('sensor offline');
    });
    expect(reg.get('flaky')).toBeUndefined();
  });

  it('unregister removes the signal', () => {
    const reg = createSignalRegistry();
    reg.register('x', () => 1);
    reg.unregister('x');
    expect(reg.get('x')).toBeUndefined();
  });
});
