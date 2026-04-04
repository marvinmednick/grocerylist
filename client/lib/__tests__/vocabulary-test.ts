import {
  DEFAULT_VOCABULARY,
  getPlural,
  lookupPackage,
  lookupSizeDescriptor,
  lookupUnit,
} from '@/lib/vocabulary';

describe('vocabulary helpers', () => {
  it('lookupUnit finds canonical', () => {
    expect(lookupUnit('oz', DEFAULT_VOCABULARY)).toBe('oz');
  });

  it('lookupUnit finds alias', () => {
    expect(lookupUnit('ounces', DEFAULT_VOCABULARY)).toBe('oz');
  });

  it('lookupUnit is case-insensitive', () => {
    expect(lookupUnit('OZ', DEFAULT_VOCABULARY)).toBe('oz');
  });

  it('lookupUnit returns null for unknown', () => {
    expect(lookupUnit('xyz', DEFAULT_VOCABULARY)).toBeNull();
  });

  it('lookupPackage finds canonical and aliases', () => {
    expect(lookupPackage('can', DEFAULT_VOCABULARY)).toBe('can');
    expect(lookupPackage('cans', DEFAULT_VOCABULARY)).toBe('can');
  });

  it('lookupSizeDescriptor works', () => {
    expect(lookupSizeDescriptor('large', DEFAULT_VOCABULARY)).toBe('large');
    expect(lookupSizeDescriptor('lg', DEFAULT_VOCABULARY)).toBe('large');
  });

  it('getPlural returns plural form', () => {
    expect(getPlural('can', DEFAULT_VOCABULARY)).toBe('cans');
    expect(getPlural('loaf', DEFAULT_VOCABULARY)).toBe('loaves');
  });
});
