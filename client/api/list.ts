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
  trip_id?: string | null;
  store?: { name: string; color_code: string };
  category?: { name: string; sort_order: number };
}

// Fetch the active shopping list
export const useShoppingList = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('public:list_items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_items',
        },
        () => {
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
          store:stores!store_id(name, color_code),
          category:categories!category_id(name, sort_order)
        `)
        .is('archived_at', null)
        .order('added_at', { ascending: false });

      if (error) throw error;
      return data as ListItem[];
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
          purchased_at: is_purchased ? new Date().toISOString() : null
        })
        .eq('id', id)
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

// Add item to list
export interface ListItemInsert {
  name: string;
  quantity?: string;
  item_id?: string | null;
  store_id?: string | null;
  category_id?: string | null;
}

export const useAddToList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newItem: ListItemInsert) => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from('list_items')
        .insert({ ...newItem, added_by: session?.user?.id })
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

// Update existing list item
export const useUpdateListItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      name?: string;
      quantity?: string;
      store_id?: string | null;
      category_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('list_items')
        .update(updates)
        .eq('id', id)
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

// Delete item from list
export const useDeleteListItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('list_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};

// End Trip (Create trip record and archive purchased items)
export const useEndTrip = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ store_id }: { store_id?: string } = {}) => {
      const { data: trip, error: tripError } = await supabase
        .from('shopping_trips')
        .insert({
          primary_store_id: store_id || null,
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (tripError) throw tripError;

      let query = supabase
        .from('list_items')
        .update({ 
          archived_at: new Date().toISOString(),
          trip_id: trip.id 
        })
        .eq('is_purchased', true)
        .is('archived_at', null);

      if (store_id) {
        query = query.eq('store_id', store_id);
      }

      const { data: items, error: itemsError } = await query.select();
      if (itemsError) throw itemsError;

      return { trip, items };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};

// Revert Archival
export const useRevertArchival = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ trip_id }: { trip_id: string }) => {
      const { error: itemsError } = await supabase
        .from('list_items')
        .update({ archived_at: null, trip_id: null })
        .eq('trip_id', trip_id);
      if (itemsError) throw itemsError;

      await supabase.from('shopping_trips').delete().eq('id', trip_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};
