import { formatQuantity, isPartialMatch, parseQuantityText, quantityEquals } from '@/lib/quantityFormat';
import { DEFAULT_VOCABULARY } from '@/lib/vocabulary';

describe('formatQuantity', () => {
  it('formats count only', () => {
    expect(formatQuantity({ count: 2 })).toBe('2');
  });

  it('formats count=1 with no package', () => {
    expect(formatQuantity({ count: 1, packageType: null })).toBe('1');
  });

  it('formats size only', () => {
    expect(formatQuantity({ sizeQty: 1.5, sizeUnit: 'lb' })).toBe('1.5lb');
  });

  it('formats descriptive size', () => {
    expect(formatQuantity({ sizeDescriptive: 'large' })).toBe('large');
  });

  it('formats irregular plural from explicit packagePlural', () => {
    expect(formatQuantity({ count: 2, packageType: 'loaf', packagePlural: 'loaves' })).toBe('2 loaves');
  });

  it('formats size + package with explicit packagePlural', () => {
    expect(formatQuantity({ count: 2, sizeQty: 8, sizeUnit: 'oz', packageType: 'can', packagePlural: 'cans' })).toBe(
      '2 8oz cans'
    );
  });

  it('falls back to canonical+s when packagePlural is null', () => {
    expect(formatQuantity({ count: 3, packageType: '12-pack', packagePlural: null })).toBe('3 12-packs');
  });

  it('keeps singular package when count is 1', () => {
    expect(formatQuantity({ count: 1, packageType: 'can', packagePlural: 'cans' })).toBe('1 can');
  });

  it('shows implied count 1 with package when count is null', () => {
    expect(formatQuantity({ count: null, packageType: 'can', packagePlural: 'cans' })).toBe('1 can');
  });
});

describe('parseQuantityText', () => {
  const vocab = DEFAULT_VOCABULARY;

  it('returns null for empty string', () => {
    expect(parseQuantityText('', vocab)).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseQuantityText('   ', vocab)).toBeNull();
  });

  it('returns null for text with no quantity signal', () => {
    expect(parseQuantityText('random words', vocab)).toBeNull();
  });

  it('parses bare integer count', () => {
    expect(parseQuantityText('2', vocab)).toEqual({
      count: 2,
      packageType: null,
      packagePlural: null,
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: null,
    });
  });

  it('parses bare count=1', () => {
    expect(parseQuantityText('1', vocab)).toEqual({
      count: 1,
      packageType: null,
      packagePlural: null,
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: null,
    });
  });

  it('parses decimal count', () => {
    expect(parseQuantityText('1.5', vocab)).toEqual({
      count: 1.5,
      packageType: null,
      packagePlural: null,
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: null,
    });
  });

  it('parses compound unit string', () => {
    expect(parseQuantityText('16oz', vocab)).toEqual({
      count: null,
      packageType: null,
      packagePlural: null,
      sizeQty: 16,
      sizeUnit: 'oz',
      sizeDescriptive: null,
    });
  });

  it('parses bare package canonical', () => {
    expect(parseQuantityText('can', vocab)).toEqual({
      count: null,
      packageType: 'can',
      packagePlural: 'cans',
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: null,
    });
  });

  it('parses bare package plural', () => {
    expect(parseQuantityText('cans', vocab)).toEqual({
      count: null,
      packageType: 'can',
      packagePlural: 'cans',
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: null,
    });
  });

  it('parses count and package', () => {
    expect(parseQuantityText('2 cans', vocab)).toEqual({
      count: 2,
      packageType: 'can',
      packagePlural: 'cans',
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: null,
    });
  });

  it('parses size qty and package', () => {
    expect(parseQuantityText('16oz bottle', vocab)).toEqual({
      count: null,
      packageType: 'bottle',
      packagePlural: 'bottles',
      sizeQty: 16,
      sizeUnit: 'oz',
      sizeDescriptive: null,
    });
  });

  it('parses count, size, and package', () => {
    expect(parseQuantityText('2 8oz cans', vocab)).toEqual({
      count: 2,
      packageType: 'can',
      packagePlural: 'cans',
      sizeQty: 8,
      sizeUnit: 'oz',
      sizeDescriptive: null,
    });
  });

  it('returns correct irregular plural', () => {
    expect(parseQuantityText('2 loaves', vocab)).toEqual({
      count: 2,
      packageType: 'loaf',
      packagePlural: 'loaves',
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: null,
    });
  });

  it('parses input using irregular plural token', () => {
    expect(parseQuantityText('loaves', vocab)).toEqual({
      count: null,
      packageType: 'loaf',
      packagePlural: 'loaves',
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: null,
    });
  });

  it('parses size descriptor with package', () => {
    expect(parseQuantityText('large can', vocab)).toEqual({
      count: null,
      packageType: 'can',
      packagePlural: 'cans',
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: 'large',
    });
  });

  it('parses n-pack format with null plural', () => {
    expect(parseQuantityText('4-pack', vocab)).toEqual({
      count: null,
      packageType: '4-pack',
      packagePlural: null,
      sizeQty: null,
      sizeUnit: null,
      sizeDescriptive: null,
    });
  });
});

describe('quantityEquals', () => {
  it('matches equivalent forms', () => {
    expect(quantityEquals('2 loaves', '2 loaf', DEFAULT_VOCABULARY)).toBe(true);
  });

  it('matches fused/spaced', () => {
    expect(quantityEquals('1.5 lb', '1.5lb', DEFAULT_VOCABULARY)).toBe(true);
  });

  it('rejects different quantities', () => {
    expect(quantityEquals('2 cans', '3 cans', DEFAULT_VOCABULARY)).toBe(false);
  });
});

describe('isPartialMatch', () => {
  it('checks prefix', () => {
    expect(isPartialMatch('2', '2lb')).toBe(true);
  });

  it('rejects non-prefix', () => {
    expect(isPartialMatch('1.5', '1lb')).toBe(false);
  });
});
