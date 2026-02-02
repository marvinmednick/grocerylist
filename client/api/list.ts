import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export interface ListItem {
  id: string;
  name: string;
  quantity: string;
  is_purchased: boolean;
  category_id: string | null;
  store_id: string | null;
  item_id: string | null; // Link to master item
  store?: { name: string; color_code: string };
  category?: { name: string; sort_order: number };
}

// Fetch the active shopping list
export const useShoppingList = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to real-time changes
    const channel = supabase
      .channel('public:list_items')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'list_items',
        },
        (payload) => {
          // Ideally we would optimistically merge the payload, but invalidating is safer and fast enough for MVP
          console.log('Realtime update received:', payload);
          queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['shopping_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          *,
          store:stores(name, color_code),
          category:categories(name, sort_order)
        `)
        .is('purchased_at', null) // Only active items
        .order('is_purchased', { ascending: true }) // Unbought first
        .order('added_at', { ascending: false });

      if (error) throw error;
      return data as ListItem[];
    },
  });
};

// Add item to list
export const useAddToList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newItem: {
      name: string;
      item_id?: string | null;
      quantity?: string;
      store_id?: string;
      category_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('list_items')
        .insert(newItem)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};

// Toggle Purchased Status
export const useTogglePurchased = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_purchased }: { id: string; is_purchased: boolean }) => {
      const { data, error } = await supabase
        .from('list_items')
        .update({ 
          is_purchased,
          purchased_at: is_purchased ? null : new Date().toISOString() // Logic for "Cleanup" will be different, for now simple toggle
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, is_purchased }) => {
      // Optimistic Update
      await queryClient.cancelQueries({ queryKey: ['shopping_list'] });
      const previousList = queryClient.getQueryData(['shopping_list']);

      queryClient.setQueryData(['shopping_list'], (old: ListItem[] | undefined) => {
        if (!old) return [];
        return old.map(item => 
          item.id === id ? { ...item, is_purchased } : item
        );
      });

      return { previousList };
    },
    onError: (err, variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(['shopping_list'], context.previousList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};
