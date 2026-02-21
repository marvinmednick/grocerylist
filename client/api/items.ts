import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useHousehold } from '@/lib/household';

export interface MasterItem {
  id: string;
  name: string;
  default_qty: string | null;
  alternate_qtys: string[] | null;
  default_category_id: string | null;
  default_store_id: string | null;
  category?: { name: string };
  store?: { name: string };
  item_stores?: { store: { id: string; name: string } }[];
}

// Fetch all items (or search)
export const useSearchItems = (query: string) => {
  return useQuery({
    queryKey: ['items', query],
    queryFn: async () => {
      // If query is empty, return nothing (for the autocomplete dropdown)
      if (query.length < 2) return [];
      
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          category:categories!default_category_id(name),
          store:stores!default_store_id(name),
          item_stores(
            store:stores(id, name)
          )
        `)
        .ilike('name', `${query}%`)
        .limit(10);

      if (error) throw error;
      return data as MasterItem[];
    },
    enabled: query.length >= 2, // Only run if query is long enough
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
          store:stores!default_store_id(name),
          item_stores(
            store:stores(id, name)
          )
        `)
        .order('name');

      if (searchTerm.length > 0) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query.limit(100); // Limit to 100 for MVP performance
      
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
      default_category_id?: string | null;
      default_store_id?: string | null;
      default_qty?: string;
      alternate_qtys?: string[];
      store_ids?: string[];
    }) => {
      if (!householdId) throw new Error('No household ID found');
      const { store_ids, ...itemData } = newItem;

      const { data: item, error } = await supabase
        .from('items')
        .insert({ ...itemData, household_id: householdId })
        .select()
        .single();

      if (error) throw error;

      // Link to multiple stores if provided
      if (store_ids && store_ids.length > 0) {
        const links = store_ids.map(sid => ({
          item_id: item.id,
          store_id: sid,
          is_preferred: sid === newItem.default_store_id,
          household_id: householdId,
        }));
        const { error: linkError } = await supabase.from('item_stores').insert(links);
        if (linkError) throw linkError;
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
    mutationFn: async ({ id, store_ids, ...updates }: {
      id: string;
      name?: string;
      default_category_id?: string | null;
      default_store_id?: string | null;
      default_qty?: string;
      alternate_qtys?: string[];
      store_ids?: string[];
    }) => {
      if (!householdId) throw new Error('No household ID found');
      // 1. Update core item data
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // 2. Sync stores (Delete old, Insert new)
      if (store_ids) {
        await supabase.from('item_stores').delete().eq('item_id', id);

        if (store_ids.length > 0) {
          const links = store_ids.map(sid => ({
            item_id: id,
            store_id: sid,
            is_preferred: sid === updates.default_store_id,
            household_id: householdId,
          }));
          await supabase.from('item_stores').insert(links);
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
