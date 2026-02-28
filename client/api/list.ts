import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useHousehold } from '@/lib/household';

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

// --- Local mutation tracking ---
let localMutationCount = 0;
function incrementLocalMutation() {
  localMutationCount++;
}
function decrementLocalMutation() {
  setTimeout(() => {
    localMutationCount = Math.max(0, localMutationCount - 1);
  }, 500);
}

// Fetch the active shopping list
export const useShoppingList = (onRemoteChange?: (event: string, itemName?: string) => void) => {
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
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['shopping_list'] });

          if (localMutationCount === 0 && onRemoteChange) {
            const eventType = payload.eventType;
            const record = (payload.new as Record<string, unknown>) || {};
            const itemName = (record.name as string) || undefined;
            onRemoteChange(eventType, itemName);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, onRemoteChange]);

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
      incrementLocalMutation();
      try {
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
      } finally {
        decrementLocalMutation();
      }
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
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async (newItem: ListItemInsert) => {
      if (!householdId) throw new Error('No household ID found');
      incrementLocalMutation();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data, error } = await supabase
          .from('list_items')
          .insert({ ...newItem, added_by: session?.user?.id, household_id: householdId })
          .select()
          .single();

        if (error) throw error;
        return data;
      } finally {
        decrementLocalMutation();
      }
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
      incrementLocalMutation();
      try {
        const { data, error } = await supabase
          .from('list_items')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } finally {
        decrementLocalMutation();
      }
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
      incrementLocalMutation();
      try {
        const { error } = await supabase.from('list_items').delete().eq('id', id);
        if (error) throw error;
      } finally {
        decrementLocalMutation();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};

// End Trip (Create trip record and archive purchased items)
export const useEndTrip = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async ({ store_id }: { store_id?: string } = {}) => {
      if (!householdId) throw new Error('No household ID found');
      const { data: { user } } = await supabase.auth.getUser();
      incrementLocalMutation();
      try {
        const { data: trip, error: tripError } = await supabase
          .from('shopping_trips')
          .insert({
            primary_store_id: store_id || null,
            status: 'completed',
            ended_at: new Date().toISOString(),
            household_id: householdId,
            user_id: user?.id ?? null,
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
      } finally {
        decrementLocalMutation();
      }
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
      incrementLocalMutation();
      try {
        const { error: itemsError } = await supabase
          .from('list_items')
          .update({ archived_at: null, trip_id: null })
          .eq('trip_id', trip_id);
        if (itemsError) throw itemsError;

        await supabase.from('shopping_trips').delete().eq('id', trip_id);
      } finally {
        decrementLocalMutation();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};
