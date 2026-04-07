import {
  bestFuzzyMatch,
  editDistanceThreshold,
  isFuzzyMatch,
  levenshteinDistance,
  normalizePlural,
} from '@/lib/fuzzyMatch';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('milk', 'milk')).toBe(0);
  });

  it('returns 1 for a single character difference', () => {
    expect(levenshteinDistance('milk', 'milkz')).toBe(1);
  });

  it('handles "chiken" vs "chicken"', () => {
    expect(levenshteinDistance('chiken', 'chicken')).toBe(1);
  });

  it('handles "rest" vs "breast"', () => {
    expect(levenshteinDistance('rest', 'breast')).toBe(1);
  });

  it('handles "botles" vs "bottle"', () => {
    expect(levenshteinDistance('botles', 'bottle')).toBe(2);
  });

  it('returns high distance for unrelated strings', () => {
    expect(levenshteinDistance('abc', 'xyzxyz')).toBeGreaterThan(3);
  });
});

describe('editDistanceThreshold', () => {
  it('returns 0 for word lengths 1-2', () => {
    expect(editDistanceThreshold(1)).toBe(0);
    expect(editDistanceThreshold(2)).toBe(0);
  });

  it('returns 1 for word lengths 3-4', () => {
    expect(editDistanceThreshold(3)).toBe(1);
    expect(editDistanceThreshold(4)).toBe(1);
  });

  it('returns 2 for word lengths 5+', () => {
    expect(editDistanceThreshold(5)).toBe(2);
    expect(editDistanceThreshold(10)).toBe(2);
  });
});

describe('isFuzzyMatch', () => {
  it('matches "rest" vs "breast"', () => {
    expect(isFuzzyMatch('rest', 'breast')).toBe(true);
  });

  it('does not match unrelated 3-letter strings', () => {
    expect(isFuzzyMatch('abc', 'xyz')).toBe(false);
  });

  it('does not match when either word is shorter than 3 chars', () => {
    expect(isFuzzyMatch('be', 'breast')).toBe(false);
  });
});

describe('bestFuzzyMatch', () => {
  it('finds the closest candidate', () => {
    expect(bestFuzzyMatch('chiken', ['milk', 'chicken', 'bread'])).toBe('chicken');
  });

  it('returns null when no candidate is within threshold', () => {
    expect(bestFuzzyMatch('zzz', ['milk', 'bread'])).toBeNull();
  });

  it('prefers the shorter candidate on ties', () => {
    expect(bestFuzzyMatch('abcde', ['abxde', 'abcdey'])).toBe('abxde');
  });
});

describe('normalizePlural', () => {
  it('normalizes "breasts" to "breast"', () => {
    expect(normalizePlural('breasts')).toBe('breast');
  });

  it('normalizes "tomatoes" to "tomato"', () => {
    expect(normalizePlural('tomatoes')).toBe('tomato');
  });

  it('normalizes "cherries" to "cherry"', () => {
    expect(normalizePlural('cherries')).toBe('cherry');
  });

  it('normalizes "loaves" to "loaf"', () => {
    expect(normalizePlural('loaves')).toBe('loaf');
  });

  it('leaves non-plural words unchanged', () => {
    expect(normalizePlural('chicken')).toBe('chicken');
  });

  it('keeps "us" unchanged because it is too short', () => {
    expect(normalizePlural('us')).toBe('us');
  });

  it('keeps "gas" unchanged because normalization would be too short', () => {
    expect(normalizePlural('gas')).toBe('gas');
  });
});
