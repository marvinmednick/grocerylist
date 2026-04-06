import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Abbreviations } from '@/components/Abbreviations';
import {
  useAbbreviationSuggestions,
  useCreateWordAlias,
  useDeleteWordAlias,
  useWordAliases,
} from '@/api/aliases';
import { useMasterItemNames } from '@/api/items';
import { useVocabulary } from '@/api/vocabulary';

jest.mock('@/api/aliases');
jest.mock('@/api/items');
jest.mock('@/api/vocabulary');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUseWordAliases = useWordAliases as jest.Mock;
const mockUseAbbreviationSuggestions = useAbbreviationSuggestions as jest.Mock;
const mockUseCreateWordAlias = useCreateWordAlias as jest.Mock;
const mockUseDeleteWordAlias = useDeleteWordAlias as jest.Mock;
const mockUseMasterItemNames = useMasterItemNames as jest.Mock;
const mockUseVocabulary = useVocabulary as jest.Mock;

describe('Abbreviations', () => {
  const createMutateAsync = jest.fn();
  const deleteMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    createMutateAsync.mockResolvedValue({});
    deleteMutateAsync.mockResolvedValue({});

    mockUseWordAliases.mockReturnValue({
      data: new Map<string, string>([
        ['chk', 'chicken'],
        ['chx', 'chicken'],
        ['bf', 'beef'],
      ]),
    });
    mockUseAbbreviationSuggestions.mockReturnValue({
      data: new Map<string, string[]>([['chicken', ['ckn', 'chx']]]),
    });
    mockUseCreateWordAlias.mockReturnValue({ mutateAsync: createMutateAsync, isPending: false });
    mockUseDeleteWordAlias.mockReturnValue({ mutateAsync: deleteMutateAsync, isPending: false });
    mockUseMasterItemNames.mockReturnValue({
      data: [
        { id: '1', name: 'Chicken Breast', aliases: ['Tenders'], default_qty: null, alternate_qtys: [] },
        { id: '2', name: 'Beef Stew', aliases: [], default_qty: null, alternate_qtys: [] },
      ],
    });
    mockUseVocabulary.mockReturnValue({
      data: {
        units: [{ id: 'u-1', canonical: 'oz', aliases: ['ounce'] }],
        packages: [{ id: 'p-1', canonical: 'can', aliases: [], plural: 'cans' }],
        sizeDescriptors: [{ id: 's-1', canonical: 'large', aliases: ['lg'] }],
      },
    });
  });

  it('renders when visible and close button triggers onClose', () => {
    const onClose = jest.fn();
    render(<Abbreviations visible={true} onClose={onClose} />);

    expect(screen.getByText('Abbreviations')).toBeTruthy();
    fireEvent.press(screen.getByTestId('abbreviations-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when visible is false', () => {
    render(<Abbreviations visible={false} onClose={jest.fn()} />);
    expect(screen.queryByText('Abbreviations')).toBeNull();
  });

  it('switches views and preserves independent search values', () => {
    render(<Abbreviations visible={true} onClose={jest.fn()} />);

    const search = screen.getByTestId('abbreviations-search-input');
    fireEvent.changeText(search, 'chicken');
    fireEvent.press(screen.getByTestId('abbrev-view-alias'));
    fireEvent.changeText(screen.getByTestId('abbreviations-search-input'), 'chk');
    fireEvent.press(screen.getByTestId('abbrev-view-canonical'));

    expect(screen.getByTestId('abbreviations-search-input').props.value).toBe('chicken');
    fireEvent.press(screen.getByTestId('abbrev-view-alias'));
    expect(screen.getByTestId('abbreviations-search-input').props.value).toBe('chk');
  });

  it('applies OR-search semantics and shows unknown placeholder warning', () => {
    render(<Abbreviations visible={true} onClose={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('abbreviations-search-input'), 'beef mysteryword');
    expect(screen.getByText('beef')).toBeTruthy();
    expect(screen.getByText('doesn\'t appear in any of your items')).toBeTruthy();
  });

  it('opens existing row in edit dialog and supports adding/removing aliases', async () => {
    render(<Abbreviations visible={true} onClose={jest.fn()} />);

    fireEvent.press(screen.getByText('chicken'));
    expect(screen.queryByTestId('abbrev-dialog-canonical-input')).toBeNull();
    // "chk" appears in both the row (highlighted alias) and the dialog chip
    expect(screen.getAllByText('chk').length).toBeGreaterThanOrEqual(2);

    fireEvent.changeText(screen.getByTestId('abbrev-dialog-new-alias-input'), 'NEWALIAS');
    fireEvent(screen.getByTestId('abbrev-dialog-new-alias-input'), 'submitEditing');
    expect(screen.getByText('newalias')).toBeTruthy();
    fireEvent.press(screen.getAllByText('×')[0]);
    // After removing chip, "chk" still visible in the row behind the dialog
    expect(screen.getAllByText('chk').length).toBeGreaterThanOrEqual(1);

    fireEvent.press(screen.getByTestId('abbrev-dialog-save'));
    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({ alias: 'newalias', canonical: 'chicken' });
      expect(deleteMutateAsync).toHaveBeenCalledWith('chk');
    });
  });

  it('opens placeholder row with editable canonical input', () => {
    render(<Abbreviations visible={true} onClose={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('abbreviations-search-input'), 'newword');
    fireEvent.press(screen.getByText('newword'));
    expect(screen.getByTestId('abbrev-dialog-canonical-input')).toBeTruthy();
  });

  it('enforces single-token alias rule and lowercases alias input', () => {
    render(<Abbreviations visible={true} onClose={jest.fn()} />);

    fireEvent.press(screen.getByText('chicken'));
    fireEvent.changeText(screen.getByTestId('abbrev-dialog-new-alias-input'), 'two words');
    fireEvent(screen.getByTestId('abbrev-dialog-new-alias-input'), 'submitEditing');
    expect(screen.getByText('Alias must be a single word')).toBeTruthy();
  });

  it('renders suggestions and tapping one adds it', () => {
    render(<Abbreviations visible={true} onClose={jest.fn()} />);

    fireEvent.press(screen.getByText('chicken'));
    fireEvent.press(screen.getByText('ckn'));
    expect(screen.getByText('ckn')).toBeTruthy();
  });

  it('shows duplicate alias warning and disables Save', () => {
    render(<Abbreviations visible={true} onClose={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('abbreviations-search-input'), 'newword');
    fireEvent.press(screen.getByText('newword'));
    fireEvent.changeText(screen.getByTestId('abbrev-dialog-canonical-input'), 'newword');
    fireEvent.changeText(screen.getByTestId('abbrev-dialog-new-alias-input'), 'chk');
    fireEvent(screen.getByTestId('abbrev-dialog-new-alias-input'), 'submitEditing');

    expect(screen.getByText(/Alias already used by another canonical word/)).toBeTruthy();
    expect(screen.getByTestId('abbrev-dialog-save').props.accessibilityState.disabled).toBe(true);
  });

  it('shows vocabulary and item-name conflict warnings', () => {
    render(<Abbreviations visible={true} onClose={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('abbreviations-search-input'), 'newword');
    fireEvent.press(screen.getByText('newword'));
    fireEvent.changeText(screen.getByTestId('abbrev-dialog-canonical-input'), 'newword');

    fireEvent.changeText(screen.getByTestId('abbrev-dialog-new-alias-input'), 'can');
    fireEvent(screen.getByTestId('abbrev-dialog-new-alias-input'), 'submitEditing');
    expect(screen.getByText(/Matches size\/package\/unit vocabulary/)).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('abbrev-dialog-new-alias-input'), 'chicken');
    fireEvent(screen.getByTestId('abbrev-dialog-new-alias-input'), 'submitEditing');
    expect(screen.getByText(/"chicken" appears in 1 item/)).toBeTruthy();
  });

  it('delete flow removes all aliases for a canonical word', async () => {
    render(<Abbreviations visible={true} onClose={jest.fn()} />);

    fireEvent.press(screen.getByText('chicken'));
    fireEvent.press(screen.getByTestId('abbrev-dialog-delete-trigger'));
    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => {
      expect(deleteMutateAsync).toHaveBeenCalledWith('chk');
      expect(deleteMutateAsync).toHaveBeenCalledWith('chx');
    });
  });

  it('uses initialSearch to prefill canonical search', () => {
    render(<Abbreviations visible={true} onClose={jest.fn()} initialSearch="beef" />);
    expect(screen.getByTestId('abbreviations-search-input').props.value).toBe('beef');
    expect(screen.getByText('beef')).toBeTruthy();
  });
});
