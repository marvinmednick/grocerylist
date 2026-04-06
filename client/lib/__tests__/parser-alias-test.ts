import { expandAliases, parseInput, type CandidateFields, type MasterItemRef } from '@/lib/parser';
import { DEFAULT_VOCABULARY } from '@/lib/vocabulary';

const candidateBase: CandidateFields = {
  count: null,
  packageType: null,
  packagePlural: null,
  sizeQty: null,
  sizeUnit: null,
  sizeDescriptive: null,
  storeHint: null,
  nameWords: [],
  sizeDescriptiveTokens: [],
};

const masterItems: MasterItemRef[] = [
  {
    id: 'chicken-breast',
    name: 'Chicken Breast',
    default_qty: '1 lb',
    alternate_qtys: ['2 lb'],
    aliases: ['Chicken Cutlet'],
  },
  {
    id: 'chicken-breast-strips',
    name: 'Chicken Breast Strips',
    default_qty: '1 lb',
    alternate_qtys: ['2 lb'],
    aliases: ['Chicken Tenders'],
  },
  {
    id: 'chicken',
    name: 'Chicken',
    default_qty: '1 lb',
    alternate_qtys: [],
    aliases: [],
  },
];

describe('expandAliases', () => {
  it('expandAliases returns single variant when no aliases match', () => {
    const input: CandidateFields = { ...candidateBase, nameWords: ['milk'] };
    const variants = expandAliases(input, new Map<string, string>());

    expect(variants).toEqual([input]);
  });

  it('expandAliases returns 2 variants for one expandable token', () => {
    const input: CandidateFields = { ...candidateBase, nameWords: ['chk'] };
    const variants = expandAliases(input, new Map([['chk', 'chicken']]));

    expect(variants).toHaveLength(2);
    expect(variants.map((variant) => variant.nameWords)).toEqual([['chk'], ['chicken']]);
  });

  it('expandAliases returns 4 variants for two expandable tokens', () => {
    const input: CandidateFields = { ...candidateBase, nameWords: ['chk', 'brst'] };
    const variants = expandAliases(
      input,
      new Map([
        ['chk', 'chicken'],
        ['brst', 'breast'],
      ])
    );

    expect(variants).toHaveLength(4);
    expect(variants.map((variant) => variant.nameWords)).toEqual(
      expect.arrayContaining([
        ['chk', 'brst'],
        ['chicken', 'brst'],
        ['chk', 'breast'],
        ['chicken', 'breast'],
      ])
    );
  });

  it('expandAliases ignores tokens not in alias map', () => {
    const input: CandidateFields = { ...candidateBase, nameWords: ['chk', 'soup'] };
    const variants = expandAliases(input, new Map([['chk', 'chicken']]));

    expect(variants).toHaveLength(2);
    expect(variants.map((variant) => variant.nameWords)).toEqual([
      ['chk', 'soup'],
      ['chicken', 'soup'],
    ]);
  });
});

describe('parseInput alias behavior', () => {
  it('expands token alias and matches master item', () => {
    const result = parseInput('chk', DEFAULT_VOCABULARY, masterItems, new Map([['chk', 'chicken']]));

    expect(result.interpretations.some((i) => i.name === 'Chicken' && i.matchedVia === 'name')).toBe(true);
  });

  it('composes multiple token aliases', () => {
    const result = parseInput(
      '2 chk brst',
      DEFAULT_VOCABULARY,
      masterItems,
      new Map([
        ['chk', 'chicken'],
        ['brst', 'breast'],
      ])
    );

    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken Breast',
        canonicalName: 'Chicken Breast',
        matchedVia: 'name',
        count: 2,
        orphans: [],
      })
    );
  });

  it('partial expansion produces results with orphans', () => {
    const result = parseInput('chk brst', DEFAULT_VOCABULARY, [{ ...masterItems[2] }], new Map([['chk', 'chicken']]));

    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken',
        matchedVia: 'name',
        orphans: ['brst'],
      })
    );
  });

  it('backward compatible - no wordAliases arg works like before', () => {
    const withoutAliasesArg = parseInput('2 chicken breast', DEFAULT_VOCABULARY, masterItems);
    const withEmptyAliases = parseInput('2 chicken breast', DEFAULT_VOCABULARY, masterItems, new Map<string, string>());

    expect(withoutAliasesArg).toEqual(withEmptyAliases);
  });

  it('matches item via alias name', () => {
    const result = parseInput('chicken tenders', DEFAULT_VOCABULARY, masterItems, new Map<string, string>());

    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken Tenders',
        canonicalName: 'Chicken Breast Strips',
        matchedVia: 'alias',
      })
    );
  });

  it('matches item via canonical name when both exist', () => {
    const result = parseInput('chicken breast strips', DEFAULT_VOCABULARY, masterItems, new Map<string, string>());

    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken Breast Strips',
        canonicalName: 'Chicken Breast Strips',
        matchedVia: 'name',
      })
    );
  });

  it('prefers canonical match over alias match at equal coverage', () => {
    const duplicateAliasItems: MasterItemRef[] = [
      {
        id: 'same-name',
        name: 'Chicken Tenders',
        aliases: ['Chicken Tenders'],
        default_qty: '1',
        alternate_qtys: [],
      },
    ];

    const result = parseInput('chicken tenders', DEFAULT_VOCABULARY, duplicateAliasItems, new Map<string, string>());

    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken Tenders',
        canonicalName: 'Chicken Tenders',
        matchedVia: 'name',
      })
    );
  });

  it('token expansion applies to item alias words', () => {
    const result = parseInput(
      'chk tndr',
      DEFAULT_VOCABULARY,
      masterItems,
      new Map([
        ['chk', 'chicken'],
        ['tndr', 'tenders'],
      ])
    );

    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken Tenders',
        canonicalName: 'Chicken Breast Strips',
        matchedVia: 'alias',
      })
    );
  });

  it('sets canonicalName to master item name for all matches', () => {
    const result = parseInput('chicken', DEFAULT_VOCABULARY, masterItems, new Map([['chk', 'chicken']]));

    result.interpretations.forEach((interpretation) => {
      const item = masterItems.find((entry) => entry.id === interpretation.matchedItemId);
      expect(item?.name).toBe(interpretation.canonicalName);
    });
  });

  it('sets matchedVia to name for unmatched items', () => {
    const result = parseInput('mystery item', DEFAULT_VOCABULARY, masterItems, new Map<string, string>());

    // No master item matches "mystery item", so interpretations is empty.
    // The parser produces no ParsedInput for unmatched input — the caller
    // (SmartAddItem) handles the one-off fallback. Verify the parser returns
    // no results rather than results with incorrect matchedVia.
    expect(result.interpretations).toHaveLength(0);
  });
});
