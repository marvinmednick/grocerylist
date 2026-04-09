import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SmartAddItem } from '@/components/SmartAddItem';
import { useAllItems, useCreateMasterItem, useMasterItemNames, type MasterItem, type MasterItemRef } from '@/api/items';
import { useAddToList, useDeleteListItem } from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useWordAliases } from '@/api/aliases';
import { useUndo } from '@/api/undoContext';
import { useMyProfile } from '@/api/profile';
import { useVocabulary } from '@/api/vocabulary';

jest.mock('@/api/items', () => {
  const actual = jest.requireActual('@/api/items');
  return {
    ...actual,
    useMasterItemNames: jest.fn(),
    useAllItems: jest.fn(),
    useCreateMasterItem: jest.fn(),
  };
});
jest.mock('@/api/list');
jest.mock('@/api/metadata');
jest.mock('@/api/aliases');
jest.mock('@/api/undoContext');
jest.mock('@/api/profile');
jest.mock('@/api/vocabulary');
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

describe('SmartAddItem parser integration', () => {
  const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
  const mockUseAllItems = useAllItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseWordAliases = useWordAliases as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;
  const mockUseMyProfile = useMyProfile as jest.Mock;
  const mockUseVocabulary = useVocabulary as jest.Mock;

  const addItem = jest.fn();
  const createMasterItem = jest.fn();
  const pushAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    addItem.mockResolvedValue({ id: 'list-1' });
    createMasterItem.mockResolvedValue({ id: 'master-new' });

    mockUseMasterItemNames.mockReturnValue({
      data: [
        { id: 'master-1', name: 'Milk', default_qty: '1', alternate_qtys: ['2', '1lb'] },
        { id: 'large-avocado', name: 'Large Avocado', default_qty: '1', alternate_qtys: [] },
        { id: 'avocado', name: 'Avocado', default_qty: '1', alternate_qtys: [] },
      ],
    });

    mockUseAllItems.mockReturnValue({
      data: [
        {
          id: 'master-1',
          name: 'Milk',
          default_qty: '1',
          alternate_qtys: ['2', '1lb'],
          default_category_id: 'cat-1',
          item_store_preferences: [],
        },
        {
          id: 'large-avocado',
          name: 'Large Avocado',
          default_qty: '1',
          alternate_qtys: [],
          default_category_id: 'cat-1',
          item_store_preferences: [],
        },
        {
          id: 'avocado',
          name: 'Avocado',
          default_qty: '1',
          alternate_qtys: [],
          default_category_id: 'cat-1',
          item_store_preferences: [],
        },
      ],
    });

    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: createMasterItem });
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Safeway', color_code: '#2563eb' },
          { id: 'store-2', name: 'Costco', color_code: '#16a34a' },
          { id: 'store-3', name: 'Country Market', color_code: '#ef4444' },
        ],
        categories: [{ id: 'cat-1', name: 'Other' }],
      },
    });
    mockUseWordAliases.mockReturnValue({ data: new Map<string, string>() });
    mockUseUndo.mockReturnValue({ pushAction });
    mockUseMyProfile.mockReturnValue({ data: { warning_preferences: {} } });
    mockUseVocabulary.mockReturnValue({ data: undefined });
  });

  it('shows parsed qty pre-selected on pill', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 milk');
    fireEvent.press(await screen.findByText('Milk'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: '2',
        })
      );
    });
  });

  it('shows orphan tokens struck-through', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'large green avocado');

    const orphanTokens = await screen.findAllByText('green');
    orphanTokens.forEach((orphan) => {
      expect(orphan.props.style).toEqual(expect.objectContaining({ textDecorationLine: 'line-through' }));
    });
  });

  it('shows store pills when @hint present', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk @safe');

    expect(await screen.findByText('Store: ')).toBeTruthy();
    expect(screen.getByText('Safeway')).toBeTruthy();
  });

  it('shows store pill when user types "milk at Safeway"', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk at Safeway');

    expect(await screen.findByText('Store: ')).toBeTruthy();
    expect(screen.getByText('Safeway')).toBeTruthy();
  });

  it('shows parsed qty from voice input "two milk"', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'two milk');

    expect(await screen.findByTestId('result-qty-chip-other-master-1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('does not show store pills without @hint', () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');

    expect(screen.queryByText('Store: ')).toBeNull();
  });

  it('shows one-off add row with rawInput', () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'purple yam');

    expect(screen.getByText('Add "purple yam" (One-time)')).toBeTruthy();
  });

  it('Other replaces pills with text input', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 milk');
    fireEvent.press(await screen.findByTestId('result-qty-chip-other-master-1'));

    expect(screen.getByPlaceholderText('e.g. 3 lbs')).toBeTruthy();
  });

  it('✕ returns to pill view', async () => {
    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 milk');
    fireEvent.press(await screen.findByTestId('result-qty-chip-other-master-1'));
    fireEvent.press(screen.getByTestId('qty-other-close-master-1'));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('e.g. 3 lbs')).toBeNull();
    });
  });

  it('uses vocabulary from useVocabulary hook when available', async () => {
    mockUseMasterItemNames.mockReturnValue({
      data: [{ id: 'strawberries', name: 'Strawberries', default_qty: '1', alternate_qtys: [] }],
    });
    mockUseAllItems.mockReturnValue({
      data: [
        {
          id: 'strawberries',
          name: 'Strawberries',
          default_qty: '1',
          alternate_qtys: [],
          default_category_id: 'cat-1',
          item_store_preferences: [],
        },
      ],
    });
    mockUseVocabulary.mockReturnValue({
      data: {
        units: [],
        packages: [{ id: 'pkg-1', canonical: 'punnet', aliases: ['punnets'] }],
        sizeDescriptors: [],
      },
    });

    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 punnets strawberries');
    fireEvent.press(await screen.findByText('Strawberries'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: expect.stringContaining('punnet'),
        })
      );
    });
  });

  it('falls back to DEFAULT_VOCABULARY when useVocabulary returns undefined', async () => {
    mockUseVocabulary.mockReturnValue({ data: undefined });

    render(<SmartAddItem activeStoreId="store-2" />);

    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 cans milk');
    fireEvent.press(await screen.findByText('Milk'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: expect.stringContaining('can'),
        })
      );
    });
  });
});

// Mock data typed against the exported interfaces — TypeScript enforces alignment with the real
// Supabase query shape. If the interface changes, these objects will fail to compile.
const DISCOVERY_MASTER_ITEM_REFS: MasterItemRef[] = [
  { id: 'milk', name: 'Milk', default_qty: '1 gal', alternate_qtys: ['2'], aliases: [] },
  { id: 'chicken', name: 'Chicken', default_qty: '1 lb', alternate_qtys: [], aliases: [] },
  { id: 'chicken-breast', name: 'Chicken Breast', default_qty: '1 lb', alternate_qtys: ['2 lb'], aliases: [] },
  { id: 'chicken-broth', name: 'Chicken Broth', default_qty: '1 can', alternate_qtys: ['2 cans'], aliases: [] },
  { id: 'chicken-boneless-skinless', name: 'Chicken Boneless Skinless', default_qty: '1 lb', alternate_qtys: [], aliases: [] },
  { id: 'bone-broth', name: 'Organic Bone Broth', default_qty: '1 carton', alternate_qtys: [], aliases: [] },
];

const DISCOVERY_ALL_ITEMS: MasterItem[] = DISCOVERY_MASTER_ITEM_REFS.map((ref) => ({
  ...ref,
  short_name: null,
  default_category_id: 'cat-1',
  created_at: '2024-01-01T00:00:00Z',
  item_store_preferences: [],
}));

describe('SmartAddItem prefix fallback discovery', () => {
  const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
  const mockUseAllItems = useAllItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;
  const mockUseMyProfile = useMyProfile as jest.Mock;
  const mockUseVocabulary = useVocabulary as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseMasterItemNames.mockReturnValue({ data: DISCOVERY_MASTER_ITEM_REFS });
    mockUseAllItems.mockReturnValue({ data: DISCOVERY_ALL_ITEMS });
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'new' }) });
    mockUseAddToList.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'list-1' }) });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Safeway', color_code: '#2563eb' },
          { id: 'store-2', name: 'Costco', color_code: '#16a34a' },
        ],
        categories: [{ id: 'cat-1', name: 'Other' }],
      },
    });
    mockUseUndo.mockReturnValue({ pushAction: jest.fn() });
    mockUseMyProfile.mockReturnValue({ data: { warning_preferences: {} } });
    mockUseVocabulary.mockReturnValue({ data: undefined });
  });

  it('shows multi-word items when a partial prefix of any word is typed', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chick');

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
    expect(screen.getByText('Chicken Broth')).toBeTruthy();
  });

  it('shows item when the partial prefix matches a non-first word', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'bone');

    expect(await screen.findByText('Organic Bone Broth')).toBeTruthy();
  });

  it('strips count from query before matching', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '1 chick');

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
    expect(screen.getByText('Chicken Broth')).toBeTruthy();
  });

  it('strips store hint from query before matching', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chick @safe');

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
    expect(screen.getByText('Chicken Broth')).toBeTruthy();
  });

  it('requires all name tokens to match — narrows results as more words are typed', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chick bro');

    expect(await screen.findByText('Chicken Broth')).toBeTruthy();
    expect(screen.queryByText('Chicken Breast')).toBeNull();
  });

  it('shows no fallback rows when input has no name tokens', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 oz @safeway');

    expect(screen.queryByText('Chicken Breast')).toBeNull();
    expect(screen.queryByText('Milk')).toBeNull();
    expect(screen.getByText('Add "2 oz @safeway" (One-time)')).toBeTruthy();
  });

  it('parser exact match takes precedence and exact name shows via parser row', async () => {
    // "milk" exact-matches "Milk" via bag-of-words; prefix fallback also runs but deduplicates.
    // Verifies the item appears exactly once (not duplicated).
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'milk');

    expect(await screen.findByText('Milk')).toBeTruthy();
    expect(screen.queryAllByText('Milk').length).toBe(1);
  });

  it('shows subset matches alongside exact match when parser finds exact bag-of-words match', async () => {
    // "chicken" exact-matches "Chicken" via parser; subset matches ("Chicken Breast",
    // "Chicken Broth") must also appear — not suppressed. Covers architecture principle #6:
    // "Context sorts, never filters".
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chicken');

    expect(await screen.findByText('Chicken')).toBeTruthy();
    expect(screen.getByText('Chicken Breast')).toBeTruthy();
    expect(screen.getByText('Chicken Broth')).toBeTruthy();
    // Exact match must not be duplicated
    expect(screen.queryAllByText('Chicken').length).toBe(1);
  });

  it('prefix fallback matches rank above parser partial-matches with orphans', async () => {
    // "Chicken Boneless" — parser matches "Chicken" (orphan: "boneless") but cannot match
    // "Chicken Boneless Skinless" (requires "skinless" which the user did not type).
    // Prefix fallback finds "Chicken Boneless Skinless" (all input tokens are prefixes of words
    // in the name). It should appear above "Chicken" which left "boneless" as an orphan.
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chicken boneless');

    const bonelessSkinless = await screen.findByText('Chicken Boneless Skinless');
    const chicken = screen.getByText('Chicken');

    const allText = screen.root.findAll((node) => typeof node.props?.children === 'string');
    const bonelessIdx = allText.findIndex((n) => n.props.children === 'Chicken Boneless Skinless');
    const chickenIdx = allText.findIndex((n) => n.props.children === 'Chicken');
    expect(bonelessSkinless).toBeTruthy();
    expect(chicken).toBeTruthy();
    expect(bonelessIdx).toBeLessThan(chickenIdx);
  });
});

// Composition scenario tests — verify that parser alias expansion, prefix fallback,
// and SmartAddItem merge/dedup/ranking work correctly together. These catch bugs at
// integration seams that unit tests on individual pieces would miss.
const ALIAS_SCENARIO_REFS: MasterItemRef[] = [
  { id: 'chicken', name: 'Chicken', default_qty: '1 lb', alternate_qtys: [], aliases: [] },
  { id: 'chicken-breast', name: 'Chicken Breast', default_qty: '1 lb', alternate_qtys: ['2 lb'], aliases: [] },
  { id: 'chicken-breast-strips', name: 'Chicken Breast Strips', default_qty: '1 lb', alternate_qtys: [], aliases: ['Chicken Tenders'] },
  { id: 'chicken-broth', name: 'Chicken Broth', default_qty: '1 can', alternate_qtys: [], aliases: [] },
];

const ALIAS_SCENARIO_ALL_ITEMS: MasterItem[] = ALIAS_SCENARIO_REFS.map((ref) => ({
  ...ref,
  short_name: null,
  default_category_id: 'cat-1',
  created_at: '2024-01-01T00:00:00Z',
  item_store_preferences: [],
}));

describe('SmartAddItem alias composition scenarios', () => {
  const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
  const mockUseAllItems = useAllItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseWordAliases = useWordAliases as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;
  const mockUseMyProfile = useMyProfile as jest.Mock;
  const mockUseVocabulary = useVocabulary as jest.Mock;

  const addItem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    addItem.mockResolvedValue({ id: 'list-1' });

    mockUseMasterItemNames.mockReturnValue({ data: ALIAS_SCENARIO_REFS });
    mockUseAllItems.mockReturnValue({ data: ALIAS_SCENARIO_ALL_ITEMS });
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'new' }) });
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Safeway', color_code: '#2563eb' },
          { id: 'store-2', name: 'Costco', color_code: '#16a34a' },
        ],
        categories: [{ id: 'cat-1', name: 'Other' }],
      },
    });
    mockUseWordAliases.mockReturnValue({
      data: new Map<string, string>([
        ['chk', 'chicken'],
        ['brst', 'breast'],
        ['tndr', 'tenders'],
      ]),
    });
    mockUseUndo.mockReturnValue({ pushAction: jest.fn() });
    mockUseMyProfile.mockReturnValue({ data: { warning_preferences: {} } });
    mockUseVocabulary.mockReturnValue({ data: undefined });
  });

  it('multi-token alias expansion finds exact match and deduplicates with prefix fallback', async () => {
    // "chk brst" → parser expands to "chicken breast" via aliases → matches "Chicken Breast".
    // Prefix fallback also expands "chk" → "chicken" and finds "Chicken Breast".
    // The item should appear exactly once.
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chk brst');

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
    expect(screen.queryAllByText('Chicken Breast').length).toBe(1);
  });

  it('alias expansion composes with quantity and store hint', async () => {
    // "2 chk brst @cost" → qty 2, alias-expanded to "chicken breast", store hint "Costco".
    // Verifies all three systems compose through the real pipeline.
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 chk brst @cost');
    fireEvent.press(await screen.findByText('Chicken Breast'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: '2',
          store_id: 'store-2',
        })
      );
    });
  });

  it('token alias + item alias finds item through both expansion layers', async () => {
    // "chk tndr" → token expansion produces "chicken tenders" → matches item alias
    // "Chicken Tenders" on "Chicken Breast Strips". Tests two alias systems composing.
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chk tndr');

    expect(await screen.findByText('Chicken Tenders')).toBeTruthy();
  });

  it('partial alias expansion ranks full match above orphan match', async () => {
    // "chk brst" with aliases → parser finds "Chicken Breast" (no orphans) and also
    // "Chicken" (orphan: "brst"). The full match should rank above the orphan match.
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chk brst');

    const breast = await screen.findByText('Chicken Breast');
    const chicken = screen.getByText('Chicken');

    const allText = screen.root.findAll((node) => typeof node.props?.children === 'string');
    const breastIdx = allText.findIndex((n) => n.props.children === 'Chicken Breast');
    const chickenIdx = allText.findIndex((n) => n.props.children === 'Chicken');
    expect(breast).toBeTruthy();
    expect(chicken).toBeTruthy();
    expect(breastIdx).toBeLessThan(chickenIdx);
  });

  it('keeps alias-expanded context matches when another token is unmatched', async () => {
    // "chk ddd" should still surface the broader chicken matches from prefix fallback.
    // The unknown token remains an orphan on the parser row, but it must not suppress
    // the other chicken suggestions.
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chk ddd');

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
    expect(screen.getByText('Chicken Broth')).toBeTruthy();
    expect(screen.getByText('Chicken Breast Strips')).toBeTruthy();
    expect(screen.getByText('Chicken')).toBeTruthy();
  });
});

const FUZZY_SCENARIO_REFS: MasterItemRef[] = [
  { id: 'chicken-breast-boneless-skinless', name: 'Chicken Breast Boneless Skinless', default_qty: '1 lb', alternate_qtys: [], aliases: [] },
  { id: 'chicken-breast', name: 'Chicken Breast', default_qty: '1 lb', alternate_qtys: [], aliases: [] },
  { id: 'chicken-brest', name: 'Chicken Brest', default_qty: '1 lb', alternate_qtys: [], aliases: [] },
  { id: 'olive-oil', name: 'Olive Oil', default_qty: '1 bottle', alternate_qtys: ['2 bottles'], aliases: [] },
  { id: 'chicken', name: 'Chicken', default_qty: '1 lb', alternate_qtys: [], aliases: [] },
];

const FUZZY_SCENARIO_ALL_ITEMS: MasterItem[] = FUZZY_SCENARIO_REFS.map((ref) => ({
  ...ref,
  short_name: null,
  default_category_id: 'cat-1',
  created_at: '2024-01-01T00:00:00Z',
  item_store_preferences: [],
}));

describe('SmartAddItem fuzzy composition scenarios', () => {
  const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
  const mockUseAllItems = useAllItems as jest.Mock;
  const mockUseCreateMasterItem = useCreateMasterItem as jest.Mock;
  const mockUseAddToList = useAddToList as jest.Mock;
  const mockUseDeleteListItem = useDeleteListItem as jest.Mock;
  const mockUseMetadata = useMetadata as jest.Mock;
  const mockUseWordAliases = useWordAliases as jest.Mock;
  const mockUseUndo = useUndo as jest.Mock;
  const mockUseMyProfile = useMyProfile as jest.Mock;
  const mockUseVocabulary = useVocabulary as jest.Mock;

  const addItem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    addItem.mockResolvedValue({ id: 'list-1' });

    mockUseMasterItemNames.mockReturnValue({ data: FUZZY_SCENARIO_REFS });
    mockUseAllItems.mockReturnValue({ data: FUZZY_SCENARIO_ALL_ITEMS });
    mockUseCreateMasterItem.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'new' }) });
    mockUseAddToList.mockReturnValue({ mutateAsync: addItem });
    mockUseDeleteListItem.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseMetadata.mockReturnValue({
      data: {
        stores: [
          { id: 'store-1', name: 'Safeway', color_code: '#2563eb' },
          { id: 'store-2', name: 'Costco', color_code: '#16a34a' },
        ],
        categories: [{ id: 'cat-1', name: 'Other' }],
      },
    });
    mockUseWordAliases.mockReturnValue({
      data: new Map<string, string>([['chkn', 'chicken']]),
    });
    mockUseUndo.mockReturnValue({ pushAction: jest.fn() });
    mockUseMyProfile.mockReturnValue({ data: { warning_preferences: {} } });
    mockUseVocabulary.mockReturnValue({ data: undefined });
  });

  it('ranks "Chicken Breast Boneless Skinless" first for "chicken rest boneless"', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chicken rest boneless');

    const top = await screen.findByText('Chicken Breast Boneless Skinless');
    const secondary = screen.getByText('Chicken Breast');
    const allText = screen.root.findAll((node) => typeof node.props?.children === 'string');
    const topIdx = allText.findIndex((node) => node.props.children === 'Chicken Breast Boneless Skinless');
    const secondaryIdx = allText.findIndex((node) => node.props.children === 'Chicken Breast');

    expect(top).toBeTruthy();
    expect(secondary).toBeTruthy();
    expect(topIdx).toBeLessThan(secondaryIdx);
  });

  it('parses fuzzy package in "2 botles olive oil" and uses packaged quantity on add', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), '2 botles olive oil');
    fireEvent.press(await screen.findByText('Olive Oil'));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Olive Oil',
          quantity: expect.stringMatching(/2\s+bottle/),
        })
      );
    });
  });

  it('matches "chicken breasts" to "Chicken Breast"', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chicken breasts');

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
  });

  it('uses fuzzy alias-key expansion for "chk" when only "chkn" alias exists', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chk');

    expect(await screen.findByText('Chicken')).toBeTruthy();
  });

  it('ranks exact interpretation above fuzzy interpretation', async () => {
    render(<SmartAddItem activeStoreId="store-1" />);
    fireEvent.changeText(screen.getByPlaceholderText('Add item...'), 'chicken breast');

    const exact = await screen.findByText('Chicken Breast');
    const fuzzy = screen.getByText('Chicken Brest');
    const allText = screen.root.findAll((node) => typeof node.props?.children === 'string');
    const exactIdx = allText.findIndex((node) => node.props.children === 'Chicken Breast');
    const fuzzyIdx = allText.findIndex((node) => node.props.children === 'Chicken Brest');

    expect(exact).toBeTruthy();
    expect(fuzzy).toBeTruthy();
    expect(exactIdx).toBeLessThan(fuzzyIdx);
  });
});
