import { describe, it, expect } from 'vitest';
import { convert, normalize, tryCombine } from './index.js';

describe('units', () => {
  it('converts within a dimension', () => {
    expect(convert({ value: 2, unit: 'kg' }, 'g')).toEqual({ value: 2000, unit: 'g' });
    expect(convert({ value: 1000, unit: 'ml' }, 'l')).toEqual({ value: 1, unit: 'l' });
  });

  it('refuses cross-dimension and unknown units (degrade, not throw)', () => {
    expect(convert({ value: 1, unit: 'g' }, 'ml')).toBeUndefined();
    expect(convert({ value: 1, unit: 'g' }, 'furlong')).toBeUndefined();
    expect(normalize({ value: 1, unit: 'furlong' })).toBeUndefined();
  });

  it('normalizes to base units', () => {
    expect(normalize({ value: 1, unit: 'kg' })).toEqual({ value: 1000, unit: 'g' });
    expect(normalize({ value: 1, unit: 'l' })).toEqual({ value: 1000, unit: 'ml' });
  });

  it('combines compatible quantities and keeps incompatible ones separate', () => {
    expect(tryCombine({ value: 1, unit: 'kg' }, { value: 200, unit: 'g' })).toEqual([
      { value: 1.2, unit: 'kg' },
    ]);
    // "2 onions" + "200 g onion" don't combine — kept separate (§7).
    const separate = tryCombine({ value: 2, unit: 'piece' }, { value: 200, unit: 'g' });
    expect(separate).toHaveLength(2);
  });
});
