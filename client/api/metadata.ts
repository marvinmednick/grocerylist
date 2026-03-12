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
