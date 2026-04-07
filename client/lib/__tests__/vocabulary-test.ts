import {
  DEFAULT_VOCABULARY,
  fuzzyLookupPackageEntry,
  fuzzyLookupSizeDescriptor,
  fuzzyLookupUnit,
  getPlural,
  lookupPackageEntry,
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

  it('lookupPackageEntry returns canonical+plural for canonical and plural tokens', () => {
    expect(lookupPackageEntry('can', DEFAULT_VOCABULARY)).toEqual({ canonical: 'can', plural: 'cans' });
    expect(lookupPackageEntry('cans', DEFAULT_VOCABULARY)).toEqual({ canonical: 'can', plural: 'cans' });
  });

  it('lookupPackageEntry handles irregular plural', () => {
    expect(lookupPackageEntry('loaves', DEFAULT_VOCABULARY)).toEqual({ canonical: 'loaf', plural: 'loaves' });
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

describe('fuzzy vocabulary helpers', () => {
  it('fuzzyLookupUnit matches misspelled unit', () => {
    expect(fuzzyLookupUnit('ounze', DEFAULT_VOCABULARY)).toBe('oz');
  });

  it('fuzzyLookupUnit matches misspelled alias', () => {
    expect(fuzzyLookupUnit('poumd', DEFAULT_VOCABULARY)).toBe('lb');
  });

  it('fuzzyLookupUnit still supports exact match', () => {
    expect(fuzzyLookupUnit('oz', DEFAULT_VOCABULARY)).toBe('oz');
  });

  it('fuzzyLookupUnit returns null for unrelated token', () => {
    expect(fuzzyLookupUnit('xyz', DEFAULT_VOCABULARY)).toBeNull();
  });

  it('fuzzyLookupPackageEntry matches misspelled plural', () => {
    expect(fuzzyLookupPackageEntry('botles', DEFAULT_VOCABULARY)).toEqual({
      canonical: 'bottle',
      plural: 'bottles',
    });
  });

  it('fuzzyLookupPackageEntry matches misspelled canonical', () => {
    expect(fuzzyLookupPackageEntry('bunc', DEFAULT_VOCABULARY)).toEqual({
      canonical: 'bunch',
      plural: 'bunches',
    });
  });

  it('fuzzyLookupSizeDescriptor matches misspelled descriptors', () => {
    expect(fuzzyLookupSizeDescriptor('larg', DEFAULT_VOCABULARY)).toBe('large');
    expect(fuzzyLookupSizeDescriptor('smal', DEFAULT_VOCABULARY)).toBe('small');
  });
});
