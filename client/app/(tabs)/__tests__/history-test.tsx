import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HistoryScreen from '../history';
import { useTripHistory, useTripItems } from '@/api/trips';
import { supabase } from '@/lib/supabase';

const safeAreaMetrics = { insets: { top: 44, bottom: 34, left: 0, right: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };

jest.mock('@/api/trips');
jest.mock('@/api/undoContext', () => ({
  useUndo: () => ({
    undoLastAction: jest.fn(),
    redoLastAction: jest.fn(),
    canUndo: false,
    canRedo: false,
    undoStack: [],
    redoStack: [],
  }),
}));
jest.mock('@/components/UserAvatar', () => ({
  UserAvatar: () => {
    const { Text } = require('react-native');
    return <Text>Avatar Stub</Text>;
  },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

const mockUseTripHistory = useTripHistory as jest.Mock;
const mockUseTripItems = useTripItems as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;

const currentUserId = 'user-123';
const otherUserId = 'user-456';

const makeTrip = (overrides: Partial<any> = {}) => ({
  id: 'trip-1',
  started_at: '2025-01-15T18:00:00.000Z',
  ended_at: '2025-01-15T20:00:00.000Z',
  primary_store_id: 'store-1',
  user_id: currentUserId,
  store: { name: 'Safeway' },
  owner: { display_name_short: 'Sarah', display_name: 'sarah@test.com' },
  list_items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  ...overrides,
});

const renderScreen = async () => {
  render(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <HistoryScreen />
    </SafeAreaProvider>
  );
  await waitFor(() => {
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
};

describe('HistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: currentUserId } } });
    mockUseTripHistory.mockReturnValue({ data: [], isLoading: false });
    mockUseTripItems.mockReturnValue({ data: [], isLoading: false });
  });

  it('shows a loading indicator while trip history is loading', async () => {
    mockUseTripHistory.mockReturnValue({ data: undefined, isLoading: true });

    await renderScreen();

    expect(screen.getByTestId('history-loading')).toBeTruthy();
  });

  it('shows empty state when there are no past trips', async () => {
    mockUseTripHistory.mockReturnValue({ data: [], isLoading: false });

    await renderScreen();

    expect(screen.getByText('No past trips yet')).toBeTruthy();
  });

  it('renders header actions (undo, redo, avatar)', async () => {
    await renderScreen();

    expect(screen.getByTestId('header-undo-button')).toBeTruthy();
    expect(screen.getByTestId('header-redo-button')).toBeTruthy();
    expect(screen.getByText('Avatar Stub')).toBeTruthy();
  });

  it('renders a row for each past trip', async () => {
    mockUseTripHistory.mockReturnValue({
      data: [makeTrip({ id: 'trip-1' }), makeTrip({ id: 'trip-2' })],
      isLoading: false,
    });

    await renderScreen();

    expect(screen.getAllByTestId(/trip-row-/)).toHaveLength(2);
  });

  it('displays store name from trip data', async () => {
    mockUseTripHistory.mockReturnValue({ data: [makeTrip({ store: { name: 'Safeway' } })], isLoading: false });

    await renderScreen();

    expect(screen.getByText('Safeway')).toBeTruthy();
  });

  it('displays "All Stores" when primary_store_id is null', async () => {
    mockUseTripHistory.mockReturnValue({
      data: [makeTrip({ primary_store_id: null, store: null })],
      isLoading: false,
    });

    await renderScreen();

    expect(screen.getByText('All Stores')).toBeTruthy();
  });

  it('displays formatted end date', async () => {
    const endedAt = '2025-01-15T20:00:00.000Z';
    mockUseTripHistory.mockReturnValue({
      data: [makeTrip({ ended_at: endedAt })],
      isLoading: false,
    });

    await renderScreen();

    expect(screen.getByText(new Date(endedAt).toLocaleDateString())).toBeTruthy();
  });

  it('displays item count', async () => {
    mockUseTripHistory.mockReturnValue({
      data: [makeTrip({ list_items: [{ id: '1' }, { id: '2' }, { id: '3' }], user_id: null })],
      isLoading: false,
    });

    await renderScreen();

    expect(screen.getByText('3 items')).toBeTruthy();
  });

  it('does not show owner name for current user trips', async () => {
    mockUseTripHistory.mockReturnValue({
      data: [makeTrip({ user_id: currentUserId, owner: { display_name_short: 'Sarah', display_name: 'sarah@test.com' } })],
      isLoading: false,
    });

    await renderScreen();

    await waitFor(() => {
      expect(screen.queryByText('Sarah')).toBeNull();
    });
  });

  it('shows owner display_name_short for other users trips', async () => {
    mockUseTripHistory.mockReturnValue({
      data: [makeTrip({ user_id: otherUserId, owner: { display_name_short: 'Sarah', display_name: 'sarah@test.com' } })],
      isLoading: false,
    });

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText('· Sarah · 3 items')).toBeTruthy();
    });
  });

  it('falls back to email prefix when display_name_short is null', async () => {
    mockUseTripHistory.mockReturnValue({
      data: [makeTrip({ user_id: otherUserId, owner: { display_name_short: null, display_name: 'sarah@test.com' } })],
      isLoading: false,
    });

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByText('· sarah · 3 items')).toBeTruthy();
    });
  });

  it('treats user_id null trips as own trips', async () => {
    mockUseTripHistory.mockReturnValue({
      data: [makeTrip({ user_id: null, owner: { display_name_short: 'Sarah', display_name: 'sarah@test.com' } })],
      isLoading: false,
    });

    await renderScreen();

    await waitFor(() => {
      expect(screen.queryByText('Sarah')).toBeNull();
    });
  });

  it('opens detail modal when a trip row is pressed', async () => {
    mockUseTripHistory.mockReturnValue({ data: [makeTrip()], isLoading: false });

    await renderScreen();

    fireEvent.press(screen.getByTestId('trip-row-trip-1'));

    expect(screen.getByTestId('history-modal-title')).toBeTruthy();
  });

  it('modal header shows store and date for own trip without owner', async () => {
    const trip = makeTrip({ id: 'trip-own', user_id: currentUserId, store: { name: 'Safeway' } });
    mockUseTripHistory.mockReturnValue({ data: [trip], isLoading: false });

    await renderScreen();

    fireEvent.press(screen.getByTestId('trip-row-trip-own'));

    const expectedTitle = `Safeway — ${new Date(trip.ended_at).toLocaleDateString()}`;
    await waitFor(() => {
      expect(screen.getByText(expectedTitle)).toBeTruthy();
      expect(screen.queryByText(/Sarah/)).toBeNull();
    });
  });

  it('modal header shows owner name for other users trip', async () => {
    const trip = makeTrip({
      id: 'trip-other',
      user_id: otherUserId,
      owner: { display_name_short: 'Sarah', display_name: 'sarah@test.com' },
      store: { name: 'Safeway' },
    });
    mockUseTripHistory.mockReturnValue({ data: [trip], isLoading: false });

    await renderScreen();

    fireEvent.press(screen.getByTestId('trip-row-trip-other'));

    const expectedTitle = `Safeway — ${new Date(trip.ended_at).toLocaleDateString()} · Sarah`;
    await waitFor(() => {
      expect(screen.getByText(expectedTitle)).toBeTruthy();
    });
  });

  it('shows trip items in the detail modal', async () => {
    mockUseTripHistory.mockReturnValue({ data: [makeTrip()], isLoading: false });
    mockUseTripItems.mockReturnValue({
      data: [
        { id: 'item-1', name: 'Milk', quantity: '1', store_id: 'store-1', store: { name: 'Safeway' } },
        { id: 'item-2', name: 'Eggs', quantity: '12', store_id: 'store-2', store: { name: 'Costco' } },
      ],
      isLoading: false,
    });

    await renderScreen();

    fireEvent.press(screen.getByTestId('trip-row-trip-1'));

    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
  });

  it('shows store name in parentheses for items from a different store', async () => {
    // makeTrip has primary_store_id: 'store-1'; item-2 is from 'store-2' (different)
    mockUseTripHistory.mockReturnValue({ data: [makeTrip()], isLoading: false });
    mockUseTripItems.mockReturnValue({
      data: [
        { id: 'item-1', name: 'Milk', quantity: '1', store_id: 'store-1', store: { name: 'Safeway' } },
        { id: 'item-2', name: 'Eggs', quantity: '12', store_id: 'store-2', store: { name: 'Costco' } },
      ],
      isLoading: false,
    });

    await renderScreen();
    fireEvent.press(screen.getByTestId('trip-row-trip-1'));

    // Milk is from the primary store — no store label
    expect(screen.queryByText('1 (Safeway)')).toBeNull();
    // Eggs is from a different store — store name appears in parentheses
    expect(screen.getByText('12 (Costco)')).toBeTruthy();
  });

  it('closes the modal when the close button is pressed', async () => {
    mockUseTripHistory.mockReturnValue({ data: [makeTrip()], isLoading: false });

    await renderScreen();

    fireEvent.press(screen.getByTestId('trip-row-trip-1'));
    expect(screen.getByTestId('history-modal-title')).toBeTruthy();

    fireEvent.press(screen.getByTestId('history-close-modal'));

    expect(screen.queryByTestId('history-modal-title')).toBeNull();
  });
});
