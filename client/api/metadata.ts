import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export const useMetadata = () => {
  return useQuery({
    queryKey: ['metadata'],
    queryFn: async () => {
      const [stores, categories] = await Promise.all([
        supabase.from('stores').select('*').order('name'),
        supabase.from('categories').select('*').order('sort_order'),
      ]);

      if (stores.error) throw stores.error;
      if (categories.error) throw categories.error;

      return {
        stores: stores.data,
        categories: categories.data,
      };
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
};
