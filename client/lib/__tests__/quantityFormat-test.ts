import { formatQuantity, isPartialMatch, quantityEquals } from '@/lib/quantityFormat';
import { DEFAULT_VOCABULARY } from '@/lib/vocabulary';

describe('formatQuantity', () => {
  it('formats count only', () => {
    expect(formatQuantity({ count: 2 })).toBe('2');
  });

  it('formats size only', () => {
    expect(formatQuantity({ sizeQty: 1.5, sizeUnit: 'lb' })).toBe('1.5lb');
  });

  it('formats descriptive size', () => {
    expect(formatQuantity({ sizeDescriptive: 'large' })).toBe('large');
  });

  it('formats count + package', () => {
    expect(formatQuantity({ count: 2, packageType: 'loaf' })).toBe('2 loaves');
  });

  it('formats count 1 + package', () => {
    expect(formatQuantity({ count: 1, packageType: 'can' })).toBe('1 can');
  });

  it('formats size + package', () => {
    expect(formatQuantity({ sizeQty: 32, sizeUnit: 'oz', packageType: 'box' })).toBe('32oz box');
  });

  it('formats all fields', () => {
    expect(formatQuantity({ count: 2, sizeQty: 8, sizeUnit: 'oz', packageType: 'can' })).toBe('2 8oz cans');
  });

  it('formats N-pack with count', () => {
    expect(formatQuantity({ count: 3, packageType: '12-pack' })).toBe('3 12-packs');
  });

  it('shows implied count 1 with package when count is null', () => {
    expect(formatQuantity({ count: null, packageType: 'can' })).toBe('1 can');
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
