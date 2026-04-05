import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { VocabularyManagement } from '@/components/VocabularyManagement';
import {
  useCreateVocabularyEntry,
  useDeleteVocabularyEntry,
  useResetVocabularyToDefaults,
  useUpdateVocabularyEntry,
  useVocabulary,
} from '@/api/vocabulary';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/api/vocabulary', () => ({
  useVocabulary: jest.fn(),
  useCreateVocabularyEntry: jest.fn(),
  useUpdateVocabularyEntry: jest.fn(),
  useDeleteVocabularyEntry: jest.fn(),
  useResetVocabularyToDefaults: jest.fn(),
}));

describe('VocabularyManagement', () => {
  const mockUseVocabulary = useVocabulary as jest.Mock;
  const mockUseCreateVocabularyEntry = useCreateVocabularyEntry as jest.Mock;
  const mockUseUpdateVocabularyEntry = useUpdateVocabularyEntry as jest.Mock;
  const mockUseDeleteVocabularyEntry = useDeleteVocabularyEntry as jest.Mock;
  const mockUseResetVocabularyToDefaults = useResetVocabularyToDefaults as jest.Mock;

  const createMutateAsync = jest.fn();
  const updateMutateAsync = jest.fn();
  const deleteMutateAsync = jest.fn();
  const resetMutateAsync = jest.fn();

  const units = [
    { id: 'u-1', canonical: 'can', aliases: ['cans'] },
    { id: 'u-2', canonical: 'box', aliases: ['boxes'] },
    { id: 'u-3', canonical: 'jar', aliases: ['jars'] },
  ];
  const packages = [
    { id: 'p-1', canonical: 'can', aliases: [], plural: 'cans' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    createMutateAsync.mockResolvedValue({});
    updateMutateAsync.mockResolvedValue({});
    deleteMutateAsync.mockResolvedValue({});
    resetMutateAsync.mockResolvedValue({});

    mockUseVocabulary.mockReturnValue({
      data: {
        units,
        packages,
        sizeDescriptors: [],
      },
      isLoading: false,
    });

    mockUseCreateVocabularyEntry.mockReturnValue({ mutateAsync: createMutateAsync, isPending: false });
    mockUseUpdateVocabularyEntry.mockReturnValue({ mutateAsync: updateMutateAsync, isPending: false });
    mockUseDeleteVocabularyEntry.mockReturnValue({ mutateAsync: deleteMutateAsync });
    mockUseResetVocabularyToDefaults.mockReturnValue({ mutateAsync: resetMutateAsync });
  });

  const renderComponent = (type: 'units' | 'packages' | 'size_descriptors' = 'units') =>
    render(<VocabularyManagement type={type} onBack={jest.fn()} onClose={jest.fn()} />);

  it('renders all vocabulary entries in the list', () => {
    renderComponent();

    expect(screen.getByText('can')).toBeTruthy();
    expect(screen.getByText('box')).toBeTruthy();
    expect(screen.getByText('jar')).toBeTruthy();
  });

  it('opens Add Entry dialog when add button is pressed', () => {
    renderComponent();

    fireEvent.press(screen.getByText('+ Add Entry'));

    expect(screen.getByText('Add Entry')).toBeTruthy();
    const input = screen.getByTestId('vocabulary-canonical-input');
    expect(input.props.value).toBe('');
  });

  it('saves a new entry when Save is pressed', async () => {
    renderComponent();

    fireEvent.press(screen.getByText('+ Add Entry'));
    fireEvent.changeText(screen.getByTestId('vocabulary-canonical-input'), 'punnet');
    fireEvent.press(screen.getByTestId('vocabulary-save-button'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({ canonical: 'punnet', aliases: [] });
    });
  });

  it('opens Edit Entry dialog when an entry row is pressed', () => {
    renderComponent();

    fireEvent.press(screen.getByText('can'));

    expect(screen.getByText('Edit Entry')).toBeTruthy();
    expect(screen.getByTestId('vocabulary-canonical-input').props.value).toBe('can');
    expect(screen.getAllByText('cans').length).toBeGreaterThan(0);
  });

  it('updates an entry when Save is pressed in edit mode', async () => {
    renderComponent();

    fireEvent.press(screen.getByText('can'));
    fireEvent.changeText(screen.getByTestId('vocabulary-canonical-input'), 'tin');
    fireEvent.press(screen.getByTestId('vocabulary-save-button'));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith({ id: 'u-1', canonical: 'tin', aliases: ['cans'] });
    });
  });

  it('shows delete confirmation when Trash2 is pressed', () => {
    renderComponent();

    fireEvent.press(screen.getByText('can'));
    fireEvent.press(screen.getByTestId('vocabulary-delete-trigger'));

    expect(screen.getByText('Delete can? This cannot be undone.')).toBeTruthy();
  });

  it('deletes entry when delete confirmation is confirmed', async () => {
    renderComponent();

    fireEvent.press(screen.getByText('can'));
    fireEvent.press(screen.getByTestId('vocabulary-delete-trigger'));
    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => {
      expect(deleteMutateAsync).toHaveBeenCalledWith('u-1');
    });
  });

  it('hides delete confirmation when Cancel delete is pressed', () => {
    renderComponent();

    fireEvent.press(screen.getByText('can'));
    fireEvent.press(screen.getByTestId('vocabulary-delete-trigger'));
    fireEvent.press(screen.getByText('Cancel delete'));

    expect(screen.queryByText('Delete can? This cannot be undone.')).toBeNull();
    expect(screen.getByText('Edit Entry')).toBeTruthy();
  });

  it('shows reset confirmation when Reset to Defaults is pressed', () => {
    renderComponent();

    fireEvent.press(screen.getByText('Reset to Defaults'));

    expect(
      screen.getByText('Reset Units to defaults? This will remove any custom entries and restore the standard list.')
    ).toBeTruthy();
  });

  it('calls resetToDefaults.mutateAsync when reset is confirmed', async () => {
    renderComponent();

    fireEvent.press(screen.getByText('Reset to Defaults'));
    fireEvent.press(screen.getByText('Reset'));

    await waitFor(() => {
      expect(resetMutateAsync).toHaveBeenCalled();
    });
  });

  it('hides reset confirmation when Cancel is pressed', () => {
    renderComponent();

    fireEvent.press(screen.getByText('Reset to Defaults'));
    fireEvent.press(screen.getByText('Cancel'));

    expect(
      screen.queryByText('Reset Units to defaults? This will remove any custom entries and restore the standard list.')
    ).toBeNull();
  });

  it('adds an alias chip when alias input is submitted', async () => {
    renderComponent();

    fireEvent.press(screen.getByText('+ Add Entry'));
    fireEvent.press(screen.getByText('+ Add alias'));
    fireEvent.changeText(screen.getByTestId('vocabulary-new-alias-input'), 'punnets');
    fireEvent(screen.getByTestId('vocabulary-new-alias-input'), 'submitEditing', {
      nativeEvent: { text: 'punnets' },
    });

    expect(await screen.findByText('punnets')).toBeTruthy();
  });

  it('removes an alias chip when × is pressed', () => {
    renderComponent();

    fireEvent.press(screen.getByText('can'));
    expect(screen.getAllByText('cans').length).toBeGreaterThan(1);

    fireEvent.press(screen.getByTestId('alias-remove-0'));

    expect(screen.getAllByText('cans')).toHaveLength(1);
  });

  it('disables Save when canonical input is empty', () => {
    renderComponent();

    fireEvent.press(screen.getByText('+ Add Entry'));

    expect(screen.getByTestId('vocabulary-save-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('shows plural input when type is packages', () => {
    renderComponent('packages');

    fireEvent.press(screen.getByText('+ Add Entry'));
    expect(screen.getByTestId('vocabulary-plural-input')).toBeTruthy();
  });

  it('hides plural input when type is units', () => {
    renderComponent('units');

    fireEvent.press(screen.getByText('+ Add Entry'));
    expect(screen.queryByTestId('vocabulary-plural-input')).toBeNull();
  });

  it('pre-fills plural input with canonical + s on add', () => {
    renderComponent('packages');

    fireEvent.press(screen.getByText('+ Add Entry'));
    fireEvent.changeText(screen.getByTestId('vocabulary-canonical-input'), 'bottle');

    expect(screen.getByTestId('vocabulary-plural-input').props.value).toBe('bottles');
  });

  it('preserves manually set plural when canonical changes', () => {
    renderComponent('packages');

    fireEvent.press(screen.getByText('+ Add Entry'));
    fireEvent.changeText(screen.getByTestId('vocabulary-canonical-input'), 'can');
    fireEvent.changeText(screen.getByTestId('vocabulary-plural-input'), 'custom-plural');
    fireEvent.changeText(screen.getByTestId('vocabulary-canonical-input'), 'tin');

    expect(screen.getByTestId('vocabulary-plural-input').props.value).toBe('custom-plural');
  });

  it('passes plural to createEntry on save for packages', async () => {
    renderComponent('packages');

    fireEvent.press(screen.getByText('+ Add Entry'));
    fireEvent.changeText(screen.getByTestId('vocabulary-canonical-input'), 'sleeve');
    fireEvent.changeText(screen.getByTestId('vocabulary-plural-input'), 'sleeves');
    fireEvent.press(screen.getByTestId('vocabulary-save-button'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({ canonical: 'sleeve', plural: 'sleeves', aliases: [] });
    });
  });
});
