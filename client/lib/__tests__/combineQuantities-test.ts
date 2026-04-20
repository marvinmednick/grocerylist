import { combineQuantities, formatCombineOption, type QuantityParsed } from '@/lib/quantityFormat';

function parsed(overrides: Partial<QuantityParsed>): QuantityParsed {
  return {
    count: null,
    packageType: null,
    packagePlural: null,
    sizeQty: null,
    sizeUnit: null,
    sizeDescriptive: null,
    ...overrides,
  };
}

describe('combineQuantities', () => {
  it('sums pure counts: 3 + 2 → 5', () => {
    const result = combineQuantities(parsed({ count: 3 }), parsed({ count: 2 }));
    expect(result?.options).toEqual([
      expect.objectContaining({
        type: 'sum',
        result: expect.objectContaining({ count: 5 }),
      }),
    ]);
  });

  it('sums same-unit quantities: 1 lb + 2 lb → 3 lb', () => {
    const result = combineQuantities(
      parsed({ sizeQty: 1, sizeUnit: 'lb' }),
      parsed({ sizeQty: 2, sizeUnit: 'lb' })
    );
    expect(result?.options[0]).toEqual(
      expect.objectContaining({
        type: 'sum',
        result: expect.objectContaining({ sizeQty: 3, sizeUnit: 'lb' }),
      })
    );
  });

  it('offers multi-pack for same-size: 1.5 lb + 1.5 lb → sum 3 lb + multipack 2 × 1.5 lb', () => {
    const result = combineQuantities(
      parsed({ sizeQty: 1.5, sizeUnit: 'lb' }),
      parsed({ sizeQty: 1.5, sizeUnit: 'lb' })
    );
    expect(result?.options.map((option) => option.type)).toEqual(['sum', 'multipack']);
    expect(result?.options[1].result).toEqual(
      expect.objectContaining({
        count: 2,
        sizeQty: 1.5,
        sizeUnit: 'lb',
      })
    );
  });

  it('sums different-size same-unit: 1 lb + 2 lb → 3 lb, no multi-pack', () => {
    const result = combineQuantities(
      parsed({ sizeQty: 1, sizeUnit: 'lb' }),
      parsed({ sizeQty: 2, sizeUnit: 'lb' })
    );
    expect(result?.options).toHaveLength(1);
    expect(result?.options[0].type).toBe('sum');
  });

  it('sums same-package counts: 2 boxes + 1 box → 3 boxes', () => {
    const result = combineQuantities(
      parsed({ count: 2, packageType: 'box', packagePlural: 'boxes' }),
      parsed({ count: 1, packageType: 'box', packagePlural: 'boxes' })
    );
    expect(result?.options[0]).toEqual(
      expect.objectContaining({
        result: expect.objectContaining({
          count: 3,
          packageType: 'box',
          packagePlural: 'boxes',
        }),
      })
    );
  });

  it('returns null for incompatible units: 1 lb + 2 each', () => {
    const result = combineQuantities(
      parsed({ sizeQty: 1, sizeUnit: 'lb' }),
      parsed({ count: 2, packageType: 'each' })
    );
    expect(result).toBeNull();
  });

  it('returns null for convertible-but-different units: 1 lb + 16 oz', () => {
    const result = combineQuantities(
      parsed({ sizeQty: 1, sizeUnit: 'lb' }),
      parsed({ sizeQty: 16, sizeUnit: 'oz' })
    );
    expect(result).toBeNull();
  });

  it('uses non-empty value when one is empty', () => {
    const result = combineQuantities(parsed({}), parsed({ sizeQty: 2, sizeUnit: 'lb' }));
    expect(result?.options[0]).toEqual(
      expect.objectContaining({
        type: 'sum',
        result: expect.objectContaining({ sizeQty: 2, sizeUnit: 'lb' }),
      })
    );
  });

  it('returns null when both quantities are empty', () => {
    const result = combineQuantities(parsed({}), parsed({}));
    expect(result).toBeNull();
  });

  it('formatCombineOption renders sum correctly', () => {
    const text = formatCombineOption({
      type: 'sum',
      result: parsed({ sizeQty: 3, sizeUnit: 'lb' }),
      label: '',
    });
    expect(text).toBe('3 lb');
  });

  it('formatCombineOption renders multi-pack correctly', () => {
    const text = formatCombineOption({
      type: 'multipack',
      result: parsed({ count: 2, sizeQty: 1.5, sizeUnit: 'lb' }),
      label: '',
    });
    expect(text).toBe('2 × 1.5 lb');
  });
});
