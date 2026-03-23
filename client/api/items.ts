import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useHousehold } from '@/lib/household';

export interface ItemStorePreference {
  store_id: string;
  status: 'preferred' | 'avoided' | 'unavailable' | 'neutral';
  comment: string | null;
  store?: { id: string; name: string; color_code: string };
}

export interface StorePreferenceInput {
  store_id: string;
  status: 'preferred' | 'avoided' | 'unavailable' | 'neutral';
  comment?: string | null;
}

export interface MasterItem {
  id: string;
  name: string;
  short_name?: string | null;
  default_qty: string | null;
  alternate_qtys: string[] | null;
  default_category_id: string | null;
  category?: { name: string };
  item_store_preferences?: ItemStorePreference[];
}

export type Warning =
  | {
      type: 'avoided' | 'unavailable';
      store_id: string;
      store_name?: string;
      comment?: string | null;
    }
  | {
      type: 'non_preferred';
      preferred_stores: string[];
    }
  | {
      type: 'non_standard_qty';
      entered: string;
      standard: string[];
    };

export const getWarningText = (warning: Warning): string => {
  if (warning.type === 'avoided') {
    const storeName = warning.store_name || warning.store_id || 'a store';
    if (warning.comment) {
      return `Avoided at ${storeName} — ${warning.comment}`;
    }
    return `Avoided at ${storeName}`;
  }

  if (warning.type === 'unavailable') {
    const storeName = warning.store_name || warning.store_id || 'a store';
    return `Unavailable at ${storeName}`;
  }

  if (warning.type === 'non_preferred') {
    const stores = warning.preferred_stores?.join(', ') || 'none';
    return `Preferred at: ${stores}`;
  }

  const entered = warning.entered || 'unknown';
  const standard = warning.standard?.join(', ') || 'none';
  return `Qty ${entered} is non-standard (usual: ${standard})`;
};

export const computeWarnings = (
  preferences: ItemStorePreference[] | null | undefined,
  activeStoreId: string | null | undefined,
  quantity: string | null | undefined,
  defaultQty: string | null,
  alternateQtys: string[] | null
): Warning[] => {
  const warnings: Warning[] = [];
  const allPreferences = preferences ?? [];

  if (activeStoreId) {
    const activePreference = allPreferences.find((pref) => pref.store_id === activeStoreId);
    if (activePreference?.status === 'avoided') {
      warnings.push({
        type: 'avoided',
        store_id: activePreference.store_id,
        store_name: activePreference.store?.name,
        comment: activePreference.comment,
      });
    } else if (activePreference?.status === 'unavailable') {
      warnings.push({
        type: 'unavailable',
        store_id: activePreference.store_id,
        store_name: activePreference.store?.name,
        comment: activePreference.comment,
      });
    }

    const preferredStores = allPreferences.filter((pref) => pref.status === 'preferred');
    if (preferredStores.length > 0 && !preferredStores.some((pref) => pref.store_id === activeStoreId)) {
      warnings.push({
        type: 'non_preferred',
        preferred_stores: preferredStores.map((pref) => pref.store?.name || pref.store_id),
      });
    }
  }

  if (quantity) {
    const standard = [defaultQty, ...(alternateQtys ?? [])].filter(
      (value): value is string => Boolean(value && value.trim().length > 0)
    );

    if (standard.length > 0 && !standard.includes(quantity)) {
      warnings.push({
        type: 'non_standard_qty',
        entered: quantity,
        standard,
      });
    }
  }

  return warnings;
};

// Fetch all items (or search)
export const useSearchItems = (query: string) => {
  return useQuery({
    queryKey: ['items', query],
    queryFn: async () => {
      if (query.length < 2) return [];

      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          category:categories!default_category_id(name),
          item_store_preferences(
            store_id, status, comment,
            store:stores(id, name, color_code)
          )
        `)
        .ilike('name', `${query}%`)
        .limit(10);

      if (error) throw error;
      return data as MasterItem[];
    },
    enabled: query.length >= 2,
  });
};

export const useItemById = (itemId: string | null) => {
  return useQuery({
    queryKey: ['item', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          category:categories!default_category_id(name),
          item_store_preferences(
            store_id, status, comment,
            store:stores(id, name, color_code)
          )
        `)
        .eq('id', itemId)
        .single();

      if (error) throw error;
      return data as MasterItem;
    },
    enabled: itemId !== null,
  });
};

// Fetch ALL items for the management screen
export const useAllItems = (searchTerm: string = '') => {
  return useQuery({
    queryKey: ['all_items', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('items')
        .select(`
          *,
          category:categories!default_category_id(name),
          item_store_preferences(
            store_id, status, comment,
            store:stores(id, name, color_code)
          )
        `)
        .order('name');

      if (searchTerm.length > 0) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      return data as MasterItem[];
    },
  });
};

// Create a new Master Item
export const useCreateMasterItem = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async (newItem: {
      name: string;
      short_name?: string | null;
      default_category_id?: string | null;
      default_qty?: string;
      alternate_qtys?: string[];
      store_preferences?: StorePreferenceInput[];
    }) => {
      if (!householdId) throw new Error('No household ID found');
      const { store_preferences, ...itemData } = newItem;

      const { data: item, error } = await supabase
        .from('items')
        .insert({ ...itemData, household_id: householdId })
        .select()
        .single();

      if (error) throw error;

      if (store_preferences && store_preferences.length > 0) {
        const preferences = store_preferences.map((preference) => ({
          item_id: item.id,
          store_id: preference.store_id,
          status: preference.status,
          comment: preference.comment || null,
          household_id: householdId,
        }));
        const { error: preferenceError } = await supabase.from('item_store_preferences').insert(preferences);
        if (preferenceError) throw preferenceError;
      }

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['all_items'] });
    },
  });
};

// Update an existing Master Item
export const useUpdateMasterItem = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async ({ id, store_preferences, ...updates }: {
      id: string;
      name?: string;
      short_name?: string | null;
      default_category_id?: string | null;
      default_qty?: string;
      alternate_qtys?: string[];
      store_preferences?: StorePreferenceInput[];
    }) => {
      if (!householdId) throw new Error('No household ID found');

      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (store_preferences) {
        const { error: deleteError } = await supabase.from('item_store_preferences').delete().eq('item_id', id);
        if (deleteError) throw deleteError;

        if (store_preferences.length > 0) {
          const preferences = store_preferences.map((preference) => ({
            item_id: id,
            store_id: preference.store_id,
            status: preference.status,
            comment: preference.comment || null,
            household_id: householdId,
          }));
          const { error: insertError } = await supabase.from('item_store_preferences').insert(preferences);
          if (insertError) throw insertError;
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['all_items'] });
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};
