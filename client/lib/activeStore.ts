import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_STORE_KEY = '@active_store_id';

export const loadActiveStoreId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(ACTIVE_STORE_KEY);
};

export const saveActiveStoreId = async (id: string): Promise<void> => {
  await AsyncStorage.setItem(ACTIVE_STORE_KEY, id);
};
