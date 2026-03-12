import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadActiveStoreId, saveActiveStoreId } from '../activeStore';

describe('activeStore helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no stored value', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

    const value = await loadActiveStoreId();

    expect(value).toBeNull();
  });

  it('returns stored store ID', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('store-123');

    const value = await loadActiveStoreId();

    expect(value).toBe('store-123');
  });

  it('saves store ID to AsyncStorage', async () => {
    await saveActiveStoreId('store-456');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@active_store_id', 'store-456');
  });
});
