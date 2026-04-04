import {
  assembleCandidate,
  classifyTokens,
  groupTokens,
  parseInput,
  resolveNames,
  tokenize,
  type ClassifiedToken,
  type MasterItemRef,
} from '@/lib/parser';
import { DEFAULT_VOCABULARY } from '@/lib/vocabulary';

const masterItems: MasterItemRef[] = [
  { id: 'milk', name: 'Milk', default_qty: '1', alternate_qtys: ['2', '1 gal'] },
  { id: 'broth', name: 'Chicken Broth', default_qty: '1 can', alternate_qtys: ['2 8oz cans'] },
  { id: 'chicken', name: 'Chicken', default_qty: '1 lb', alternate_qtys: ['1.5lb'] },
  { id: 'large-avocado', name: 'Large Avocado', default_qty: '1', alternate_qtys: [] },
  { id: 'avocado', name: 'Avocado', default_qty: '1', alternate_qtys: [] },
  { id: 'bread', name: 'Bread', default_qty: '1 loaf', alternate_qtys: ['2 loaves'] },
  { id: 'coke', name: 'Coke', default_qty: '1 12-pack', alternate_qtys: ['3 12-packs'] },
  { id: 'energy', name: '5 hour energy', default_qty: '1', alternate_qtys: [] },
];

function classify(input: string): ClassifiedToken[] {
  return classifyTokens(tokenize(input), DEFAULT_VOCABULARY);
}

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(tokenize('2 milk').map((token) => token.raw)).toEqual(['2', 'milk']);
  });

  it('handles quoted strings as single tokens', () => {
    expect(tokenize("'5 hour energy' drink").map((token) => token.raw)).toEqual(['5 hour energy', 'drink']);
  });

  it('handles double-quoted strings', () => {
    expect(tokenize('"large pizza" 2').map((token) => token.raw)).toEqual(['large pizza', '2']);
  });

  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('trims extra whitespace', () => {
    expect(tokenize('  2   milk  ').map((token) => token.raw)).toEqual(['2', 'milk']);
  });
});

describe('classifyTokens', () => {
  it('classifies numbers', () => {
    expect(classify('2')[0].type).toBe('NUMBER');
  });

  it('classifies count sigils', () => {
    expect(classify('2x')[0].type).toBe('COUNT_SIGIL');
  });

  it('classifies store hints', () => {
    const token = classify('@safeway')[0];
    expect(token.type).toBe('STORE_HINT');
    expect(token.value).toBe('safeway');
  });

  it('classifies compound tokens', () => {
    expect(classify('8oz')[0].type).toBe('COMPOUND');
  });

  it('classifies standalone units', () => {
    expect(classify('oz')[0].type).toBe('UNIT');
  });

  it('classifies packages', () => {
    const token = classify('cans')[0];
    expect(token.type).toBe('PACKAGE');
    expect(token.value).toBe('can');
  });

  it('classifies N-pack pattern', () => {
    const token = classify('6-pack')[0];
    expect(token.type).toBe('PACKAGE');
    expect(token.value).toBe('6-pack');
  });

  it('classifies size descriptors', () => {
    expect(classify('large')[0].type).toBe('SIZE_DESCRIPTIVE');
  });

  it('classifies unrecognized tokens as NAME', () => {
    expect(classify('chicken')[0].type).toBe('NAME');
  });

  it('is case-insensitive for vocabulary lookups', () => {
    expect(classify('OZ')[0].type).toBe('UNIT');
  });
});

describe('groupTokens', () => {
  it('merges NUMBER + UNIT into QUANTITATIVE_SIZE', () => {
    const grouped = groupTokens(classify('8 oz'));
    expect(grouped[0].type).toBe('QUANTITATIVE_SIZE');
    expect(grouped[0].value).toEqual({ qty: 8, unit: 'oz' });
  });

  it('converts COMPOUND to QUANTITATIVE_SIZE', () => {
    const grouped = groupTokens(classify('8oz'));
    expect(grouped[0].type).toBe('QUANTITATIVE_SIZE');
    expect(grouped[0].value).toEqual({ qty: 8, unit: 'oz' });
  });

  it('merges QUANTITATIVE_SIZE + PACKAGE into SIZED_PACKAGE', () => {
    const grouped = groupTokens(classify('8 oz cans'));
    expect(grouped.some((token) => token.type === 'SIZED_PACKAGE')).toBe(true);
  });

  it('reclassifies NUMBER before SIZED_PACKAGE as COUNT', () => {
    const grouped = groupTokens(classify('2 8oz cans'));
    expect(grouped[0].type).toBe('COUNT');
  });

  it('reclassifies NUMBER before PACKAGE as COUNT', () => {
    const grouped = groupTokens(classify('2 cans'));
    expect(grouped[0].type).toBe('COUNT');
  });

  it('produces identical output for fused and spaced forms', () => {
    const fused = groupTokens(classify('2 8oz cans'));
    const spaced = groupTokens(classify('2 8 oz cans'));
    expect(fused).toEqual(spaced);
  });

  it('stabilizes within 4 iterations for all V1 inputs', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const samples = [
      '2 milk',
      'milk @safeway',
      '2 8oz cans chicken broth',
      '2x 8oz cans chicken broth @safeway',
      '1.5 lb chicken @costco',
      'large avocado',
      'large green avocado',
      '2 loaves bread',
      '3 12-pack Coke',
    ];

    samples.forEach((sample) => {
      groupTokens(classify(sample));
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns when iterations exceed 4', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    groupTokens(classify('1 oz can 2 oz can 3 oz can'));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('assembleCandidate', () => {
  it('extracts count from COUNT token', () => {
    const candidate = assembleCandidate(groupTokens(classify('2 cans soup')));
    expect(candidate.count).toBe(2);
  });

  it('extracts bare NUMBER as count when no package', () => {
    const candidate = assembleCandidate(groupTokens(classify('2 milk')));
    expect(candidate.count).toBe(2);
  });

  it('extracts store hint', () => {
    const candidate = assembleCandidate(groupTokens(classify('milk @safeway')));
    expect(candidate.storeHint).toBe('safeway');
  });

  it('extracts quantitative size', () => {
    const candidate = assembleCandidate(groupTokens(classify('1.5 lb chicken')));
    expect(candidate.sizeQty).toBe(1.5);
    expect(candidate.sizeUnit).toBe('lb');
  });

  it('extracts descriptive size', () => {
    const candidate = assembleCandidate(groupTokens(classify('large avocado')));
    expect(candidate.sizeDescriptive).toBe('large');
    expect(candidate.nameWords).toEqual(['avocado']);
    expect(candidate.sizeDescriptiveTokens).toEqual(['large']);
  });

  it('collects remaining tokens as nameWords', () => {
    const candidate = assembleCandidate(groupTokens(classify('chicken broth')));
    expect(candidate.nameWords).toEqual(['chicken', 'broth']);
  });

  it('extracts all fields from complex input', () => {
    const candidate = assembleCandidate(groupTokens(classify('2x 8oz cans chicken broth @safeway')));
    expect(candidate.count).toBe(2);
    expect(candidate.sizeQty).toBe(8);
    expect(candidate.sizeUnit).toBe('oz');
    expect(candidate.packageType).toBe('can');
    expect(candidate.nameWords).toEqual(['chicken', 'broth']);
    expect(candidate.storeHint).toBe('safeway');
  });
});

describe('resolveNames', () => {
  it('matches exact bag-of-words', () => {
    const resolved = resolveNames(
      {
        count: null,
        packageType: null,
        sizeQty: null,
        sizeUnit: null,
        sizeDescriptive: null,
        storeHint: null,
        nameWords: ['chicken', 'broth'],
        sizeDescriptiveTokens: [],
      },
      masterItems
    );
    expect(resolved[0].name).toBe('Chicken Broth');
  });

  it('matches word-order-independent', () => {
    const resolved = resolveNames(
      {
        count: null,
        packageType: null,
        sizeQty: null,
        sizeUnit: null,
        sizeDescriptive: null,
        storeHint: null,
        nameWords: ['broth', 'chicken'],
        sizeDescriptiveTokens: [],
      },
      masterItems
    );
    expect(resolved[0].name).toBe('Chicken Broth');
  });

  it('generates dual-candidacy interpretations with size descriptor', () => {
    const result = parseInput('large avocado', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations.map((item) => item.name)).toEqual(['Large Avocado', 'Avocado']);
  });

  it('carries orphan tokens', () => {
    const result = parseInput('large green avocado', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0].orphans).toEqual(['green']);
  });

  it('returns empty interpretations when nothing matches', () => {
    const result = parseInput('purple yam', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations).toEqual([]);
  });

  it('ranks by longest name match', () => {
    const result = parseInput('large avocado', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0].name).toBe('Large Avocado');
    expect(result.interpretations[1].name).toBe('Avocado');
  });

  it('is case-insensitive', () => {
    const result = parseInput('milk', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0].name).toBe('Milk');
  });
});

describe('parseInput', () => {
  it('parses "2 milk"', () => {
    const result = parseInput('2 milk', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Milk',
        count: 2,
      })
    );
  });

  it('parses "milk @safeway"', () => {
    const result = parseInput('milk @safeway', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Milk',
        storeHint: 'safeway',
      })
    );
  });

  it('parses "2 8oz cans chicken broth"', () => {
    const result = parseInput('2 8oz cans chicken broth', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken Broth',
        count: 2,
        sizeQty: 8,
        sizeUnit: 'oz',
        packageType: 'can',
      })
    );
  });

  it('parses "2 8 oz cans chicken broth"', () => {
    const result = parseInput('2 8 oz cans chicken broth', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken Broth',
        count: 2,
        sizeQty: 8,
        sizeUnit: 'oz',
        packageType: 'can',
      })
    );
  });

  it('parses "2x 8oz cans chicken broth @safeway"', () => {
    const result = parseInput('2x 8oz cans chicken broth @safeway', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken Broth',
        count: 2,
        sizeQty: 8,
        sizeUnit: 'oz',
        packageType: 'can',
        storeHint: 'safeway',
      })
    );
  });

  it('parses "1.5 lb chicken @costco"', () => {
    const result = parseInput('1.5 lb chicken @costco', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Chicken',
        sizeQty: 1.5,
        sizeUnit: 'lb',
        storeHint: 'costco',
      })
    );
  });

  it('parses "large avocado" with multiple interpretations', () => {
    const result = parseInput('large avocado', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations).toHaveLength(2);
  });

  it('parses "large green avocado" with orphans', () => {
    const result = parseInput('large green avocado', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0].orphans).toEqual(['green']);
  });

  it('parses "2 loaves bread"', () => {
    const result = parseInput('2 loaves bread', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Bread',
        count: 2,
        packageType: 'loaf',
      })
    );
  });

  it('parses "3 12-pack Coke"', () => {
    const result = parseInput('3 12-pack Coke', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0]).toEqual(
      expect.objectContaining({
        name: 'Coke',
        count: 3,
        packageType: '12-pack',
      })
    );
  });

  it('parses quoted input correctly', () => {
    const result = parseInput("'5 hour energy'", DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations[0]).toEqual(expect.objectContaining({ name: '5 hour energy' }));
  });

  it('returns rawInput in ParseResult', () => {
    const result = parseInput('  milk ', DEFAULT_VOCABULARY, masterItems);
    expect(result.rawInput).toBe('  milk ');
  });

  it('handles input with no matches gracefully', () => {
    const result = parseInput('zzz unknown', DEFAULT_VOCABULARY, masterItems);
    expect(result.interpretations).toEqual([]);
    expect(result.rawInput).toBe('zzz unknown');
  });
});
