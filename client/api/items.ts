import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface MasterItem {
  id: string;
  name: string;
  default_qty: string | null;
  alternate_qtys: string[] | null;
  default_category_id: string | null;
  default_store_id: string | null;
  category?: { name: string };
  store?: { name: string };
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
          store:stores!default_store_id(name)
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
          store:stores!default_store_id(name)
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
  
  return useMutation({
    mutationFn: async (newItem: { 
      name: string; 
      default_category_id?: string; 
      default_store_id?: string;
      default_qty?: string;
      alternate_qtys?: string[];
    }) => {
      const { data, error } = await supabase
        .from('items')
        .insert(newItem)
        .select()
        .single();
        
      if (error) throw error;
      return data;
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

  return useMutation({
    mutationFn: async ({ id, ...updates }: { 
      id: string;
      name?: string; 
      default_category_id?: string; 
      default_store_id?: string;
      default_qty?: string;
      alternate_qtys?: string[];
    }) => {
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['all_items'] });
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] }); // Invalidate list in case names changed
    },
  });
};
