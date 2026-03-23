import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHousehold } from '@/lib/household';

export const useMetadata = () => {
  const { householdId } = useHousehold();

  return useQuery({
    queryKey: ['metadata', householdId],
    queryFn: async () => {
      const [stores, categories] = await Promise.all([
        supabase.from('stores').select('*').eq('household_id', householdId!).order('name'),
        supabase.from('categories').select('*').order('sort_order'),
      ]);

      if (stores.error) throw stores.error;
      if (categories.error) throw categories.error;

      return {
        stores: stores.data,
        categories: categories.data,
      };
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!householdId,
  });
};

export const useCreateStore = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async ({ name, color_code }: { name: string; color_code: string }) => {
      if (!householdId) throw new Error('No household ID found');

      const { data, error } = await supabase
        .from('stores')
        .insert({ name, color_code, household_id: householdId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata'] });
    },
  });
};

export const useUpdateStore = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async ({ id, name, color_code }: { id: string; name: string; color_code: string }) => {
      if (!householdId) throw new Error('No household ID found');

      const { data, error } = await supabase
        .from('stores')
        .update({ name, color_code })
        .eq('id', id)
        .eq('household_id', householdId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata'] });
    },
  });
};

export const useDeleteStore = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async (storeId: string) => {
      if (!householdId) throw new Error('No household ID found');

      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', storeId)
        .eq('household_id', householdId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata'] });
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};

export const useStoreCascadeInfo = (storeId: string | null) => {
  return useQuery({
    queryKey: ['store-cascade', storeId],
    queryFn: async () => {
      if (!storeId) return { itemPrefsCount: 0, activeListItemsCount: 0 };

      const [prefsResult, listItemsResult] = await Promise.all([
        supabase
          .from('item_store_preferences')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', storeId),
        supabase
          .from('list_items')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', storeId)
          .is('archived_at', null),
      ]);

      if (prefsResult.error) throw prefsResult.error;
      if (listItemsResult.error) throw listItemsResult.error;

      return {
        itemPrefsCount: prefsResult.count ?? 0,
        activeListItemsCount: listItemsResult.count ?? 0,
      };
    },
    enabled: !!storeId,
    staleTime: 0,
  });
};
