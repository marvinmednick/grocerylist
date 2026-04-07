import {
  classifyTokens,
  expandAliases,
  matchQualityScore,
  parseInput,
  resolveNames,
  tokenize,
  type CandidateFields,
  type MasterItemRef,
} from '@/lib/parser';
import { DEFAULT_VOCABULARY } from '@/lib/vocabulary';

const FUZZY_MASTER_ITEMS: MasterItemRef[] = [
  { id: 'chicken-breast', name: 'Chicken Breast', default_qty: '1 lb', alternate_qtys: [], aliases: [] },
  {
    id: 'chicken-breast-boneless-skinless',
    name: 'Chicken Breast Boneless Skinless',
    default_qty: '1 lb',
    alternate_qtys: [],
    aliases: [],
  },
  { id: 'tomato', name: 'Tomato', default_qty: '1', alternate_qtys: [], aliases: [] },
  { id: 'olive-oil', name: 'Olive Oil', default_qty: '1 bottle', alternate_qtys: [], aliases: [] },
];

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

describe('parser fuzzy matching', () => {
  it('resolveNames fuzzy matches "rest" to "breast"', () => {
    const interpretations = resolveNames(
      { ...candidateBase, nameWords: ['chicken', 'rest'] },
      [{ id: 'chicken-breast', name: 'Chicken Breast', default_qty: '1', alternate_qtys: [], aliases: [] }]
    );

    expect(interpretations[0]).toEqual(
      expect.objectContaining({
        matchedItemId: 'chicken-breast',
        orphans: [],
        fuzzyCount: 1,
      })
    );
  });

  it('resolveNames plural-normalized "breasts" as exact with fuzzyCount 0', () => {
    const interpretations = resolveNames(
      { ...candidateBase, nameWords: ['chicken', 'breasts'] },
      [{ id: 'chicken-breast', name: 'Chicken Breast', default_qty: '1', alternate_qtys: [], aliases: [] }]
    );

    expect(interpretations[0]).toEqual(
      expect.objectContaining({
        matchedItemId: 'chicken-breast',
        fuzzyCount: 0,
      })
    );
  });

  it('resolveNames exact match scores higher than fuzzy match for same item', () => {
    const exact = resolveNames(
      { ...candidateBase, nameWords: ['chicken', 'breast'] },
      [{ id: 'chicken-breast', name: 'Chicken Breast', default_qty: '1', alternate_qtys: [], aliases: [] }]
    )[0];
    const fuzzy = resolveNames(
      { ...candidateBase, nameWords: ['chicken', 'brest'] },
      [{ id: 'chicken-breast', name: 'Chicken Breast', default_qty: '1', alternate_qtys: [], aliases: [] }]
    )[0];

    expect(matchQualityScore(exact)).toBeGreaterThan(matchQualityScore(fuzzy));
  });

  it('resolveNames fuzzy matching removes orphan in "chicken rest boneless skinless"', () => {
    const interpretations = resolveNames(
      { ...candidateBase, nameWords: ['chicken', 'rest', 'boneless', 'skinless'] },
      FUZZY_MASTER_ITEMS
    );

    const match = interpretations.find((interpretation) => interpretation.matchedItemId === 'chicken-breast-boneless-skinless');
    expect(match).toEqual(
      expect.objectContaining({
        orphans: [],
        fuzzyCount: 1,
      })
    );
  });

  it('resolveNames does not fuzzy-match short words (<3 chars)', () => {
    const interpretations = resolveNames(
      { ...candidateBase, nameWords: ['to'] },
      [{ id: 'tomato', name: 'Tomato', default_qty: '1', alternate_qtys: [], aliases: [] }]
    );

    expect(interpretations).toEqual([]);
  });

  it('classifyTokens fuzzy-matches "botles" to PACKAGE', () => {
    const token = classifyTokens(tokenize('botles'), DEFAULT_VOCABULARY)[0];
    expect(token.type).toBe('PACKAGE');
  });

  it('classifyTokens fuzzy-matches "ounze" to UNIT', () => {
    const token = classifyTokens(tokenize('ounze'), DEFAULT_VOCABULARY)[0];
    expect(token.type).toBe('UNIT');
  });

  it('classifyTokens fuzzy-matches "larg" to SIZE_DESCRIPTIVE', () => {
    const token = classifyTokens(tokenize('larg'), DEFAULT_VOCABULARY)[0];
    expect(token.type).toBe('SIZE_DESCRIPTIVE');
  });

  it('classifyTokens exact match takes priority over fuzzy', () => {
    const token = classifyTokens(tokenize('can'), DEFAULT_VOCABULARY)[0];
    expect(token).toEqual(
      expect.objectContaining({
        type: 'PACKAGE',
        value: { canonical: 'can', plural: 'cans' },
      })
    );
  });

  it('expandAliases fuzzy alias key "chk" matches "chkn" alias key', () => {
    const variants = expandAliases({ ...candidateBase, nameWords: ['chk'] }, new Map([['chkn', 'chicken']]));
    expect(variants.map((variant) => variant.nameWords)).toEqual([['chk'], ['chicken']]);
  });

  it('expandAliases exact key is preferred over fuzzy key', () => {
    const variants = expandAliases(
      { ...candidateBase, nameWords: ['chk'] },
      new Map([
        ['chk', 'chicken'],
        ['chkn', 'chicken-fuzzy'],
      ])
    );

    expect(variants.map((variant) => variant.nameWords)).toEqual([['chk'], ['chicken']]);
  });

  it('parseInput scoring ranks all-exact above mixed-fuzzy', () => {
    const result = parseInput(
      'chicken breast',
      DEFAULT_VOCABULARY,
      [
        { id: 'exact', name: 'Chicken Breast', default_qty: '1', alternate_qtys: [], aliases: [] },
        { id: 'fuzzy', name: 'Chicken Brest', default_qty: '1', alternate_qtys: [], aliases: [] },
      ],
      new Map<string, string>()
    );

    expect(result.interpretations[0].matchedItemId).toBe('exact');
  });

  it('parseInput scoring ranks mixed-fuzzy above orphan-heavy interpretation', () => {
    const result = parseInput(
      'chicken rest boneless',
      DEFAULT_VOCABULARY,
      [
        { id: 'mixed-fuzzy', name: 'Chicken Breast Boneless', default_qty: '1', alternate_qtys: [], aliases: [] },
        { id: 'orphan-heavy', name: 'Chicken Rest', default_qty: '1', alternate_qtys: [], aliases: [] },
      ],
      new Map<string, string>()
    );

    expect(result.interpretations[0].matchedItemId).toBe('mixed-fuzzy');
  });
});
