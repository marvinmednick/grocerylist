import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useHousehold } from '@/lib/household';
import { computeWarnings, type Warning } from '@/api/items';
import type { QuantityParsed } from '@/lib/quantityFormat';

export interface QuantityEntry {
  id: string;
  list_item_id: string;
  quantity: string | null;
  quantity_parsed: QuantityParsed | null;
  store_id: string | null;
  is_purchased: boolean;
  purchased_at: string | null;
  purchased_by: string | null;
  trip_id: string | null;
  archived_at: string | null;
  added_at: string;
  added_by: string | null;
  household_id: string;
  store?: { name: string; color_code: string };
}

export interface ListItem {
  id: string;
  name: string;
  item_id: string | null;
  category_id: string | null;
  store_id: string | null; // deprecated: store lives on quantity entries as of F104
  warnings?: Warning[];
  match_metadata?: {
    matchedName: string;
    canonicalName: string;
    matchedVia: 'alias';
  } | null;
  added_at: string;
  added_by: string | null;
  archived_at: string | null;
  category?: { name: string; sort_order: number };
  master_item?: {
    short_name: string | null;
    default_qty: string | null;
    alternate_qtys: string[] | null;
  } | null;
  quantities: QuantityEntry[];
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

/** Test-only: reset the suppression counter so realtime toast tests start clean. */
export function __resetLocalMutationCount() {
  localMutationCount = 0;
}

type WarningAggregationEntry = {
  id: string;
  quantity: string | null;
  store_id: string | null;
  archived_at: string | null;
};

type WarningAggregationListItem = {
  id: string;
  item_id: string | null;
  quantities: WarningAggregationEntry[];
  master_item: {
    default_qty: string | null;
    alternate_qtys: string[] | null;
    item_store_preferences?: Array<{
      store_id: string;
      status: 'preferred' | 'avoided' | 'unavailable' | 'neutral';
      comment: string | null;
      store?: { id: string; name: string; color_code: string };
    }> | null;
  } | null;
};

const getWarningKey = (warning: Warning): string => {
  if (warning.type === 'avoided' || warning.type === 'unavailable') {
    return [warning.type, warning.store_id, warning.store_name ?? '', warning.comment ?? ''].join('|');
  }

  if (warning.type === 'non_preferred') {
    return [warning.type, ...warning.preferred_stores.slice().sort()].join('|');
  }

  return [warning.type, warning.entered, ...warning.standard.slice().sort()].join('|');
};

const dedupeWarnings = (warnings: Warning[]): Warning[] => {
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = getWarningKey(warning);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const recomputeListItemWarnings = async (listItemId: string) => {
  const { data, error } = await supabase
    .from('list_items')
    .select(`
      id,
      item_id,
      quantities:list_item_quantities!list_item_id(
        id, quantity, store_id, archived_at
      ),
      master_item:items!item_id(
        default_qty,
        alternate_qtys,
        item_store_preferences(
          store_id, status, comment,
          store:stores(id, name, color_code)
        )
      )
    `)
    .eq('id', listItemId)
    .single();

  if (error) throw error;

  const listItem = data as WarningAggregationListItem;
  const warnings =
    !listItem.item_id || !listItem.master_item
      ? []
      : dedupeWarnings(
          (listItem.quantities ?? [])
            .filter((entry) => !entry.archived_at)
            .flatMap((entry) =>
              computeWarnings(
                listItem.master_item?.item_store_preferences,
                entry.store_id,
                entry.quantity,
                listItem.master_item.default_qty,
                listItem.master_item.alternate_qtys
              )
            )
        );

  const { error: updateError } = await supabase
    .from('list_items')
    .update({ warnings })
    .eq('id', listItemId);

  if (updateError) throw updateError;
};

// Fetch the active shopping list
export const useShoppingList = (onRemoteChange?: (event: string, itemName?: string) => void) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleRealtimeChange = (payload: {
      eventType: string;
      new?: Record<string, unknown>;
      old?: Record<string, unknown>;
    }, table: 'list_items' | 'list_item_quantities') => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });

      if (localMutationCount !== 0 || !onRemoteChange) {
        return;
      }

      if (table === 'list_items') {
        const record = (payload.eventType === 'DELETE' ? payload.old : payload.new) || {};
        onRemoteChange(payload.eventType, (record.name as string) || undefined);
        return;
      }

      const listItemId = (payload.new?.list_item_id ?? payload.old?.list_item_id) as string | undefined;
      const parents = queryClient.getQueryData<ListItem[]>(['shopping_list']);
      const parent = parents?.find((item) => item.id === listItemId);
      onRemoteChange(payload.eventType, parent?.name);
    };

    const listItemsChannel = supabase
      .channel('public:list_items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_items',
        },
        (payload) => handleRealtimeChange(payload as never, 'list_items')
      )
      .subscribe();

    const quantitiesChannel = supabase
      .channel('public:list_item_quantities')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_item_quantities',
        },
        (payload) => handleRealtimeChange(payload as never, 'list_item_quantities')
      )
      .subscribe();

    return () => {
      supabase.removeChannel(listItemsChannel);
      supabase.removeChannel(quantitiesChannel);
    };
  }, [queryClient, onRemoteChange]);

  return useQuery({
    queryKey: ['shopping_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          *,
          category:categories!category_id(name, sort_order),
          master_item:items!item_id(short_name, default_qty, alternate_qtys),
          quantities:list_item_quantities!list_item_id(*, store:stores!store_id(name, color_code))
        `)
        .is('archived_at', null)
        .order('added_at', { ascending: false });

      if (error) throw error;
      return (data as ListItem[]).map((parent) => ({
        ...parent,
        quantities: (parent.quantities ?? []).filter((entry) => !entry.archived_at),
      }));
    },
  });
};

// Toggle Purchased Status
export const useTogglePurchased = () => {
  const queryClient = useQueryClient();
  const { userId } = useHousehold();

  return useMutation({
    mutationFn: async ({ id, is_purchased, purchased_by_override }: { id: string; is_purchased: boolean; purchased_by_override?: string | null }) => {
      incrementLocalMutation();
      try {
        const { error } = await supabase
          .from('list_item_quantities')
          .update({
            is_purchased,
            purchased_at: is_purchased ? new Date().toISOString() : null,
            purchased_by: is_purchased ? (purchased_by_override !== undefined ? purchased_by_override : userId) : null,
          })
          .eq('id', id);

        if (error) throw error;
      } finally {
        decrementLocalMutation();
      }
    },
    onMutate: async ({ id, is_purchased, purchased_by_override }) => {
      await queryClient.cancelQueries({ queryKey: ['shopping_list'] });

      const previous = queryClient.getQueryData<ListItem[]>(['shopping_list']);

      queryClient.setQueryData<ListItem[]>(['shopping_list'], (old) =>
        old?.map((parent) => ({
          ...parent,
          quantities: parent.quantities.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  is_purchased,
                  purchased_at: is_purchased ? new Date().toISOString() : null,
                  purchased_by: is_purchased ? (purchased_by_override !== undefined ? purchased_by_override : userId) : null,
                }
              : entry
          ),
        }))
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['shopping_list'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};

// Add item to list
export interface ListItemInsert {
  name: string;
  quantity?: string;
  quantity_parsed?: QuantityParsed | null;
  item_id?: string | null;
  store_id?: string | null;
  category_id?: string | null;
  warnings?: Warning[];
  match_metadata?: {
    matchedName: string;
    canonicalName: string;
    matchedVia: 'alias';
  } | null;
}

export const useAddToList = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async (newItem: ListItemInsert) => {
      if (!householdId) throw new Error('No household ID found');

      incrementLocalMutation();
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const addedBy = session?.user?.id ?? null;

        const { data: parent, error: parentError } = await supabase
          .from('list_items')
          .insert({
            name: newItem.name,
            item_id: newItem.item_id ?? null,
            category_id: newItem.category_id ?? null,
            warnings: newItem.warnings,
            match_metadata: newItem.match_metadata,
            added_by: addedBy,
            household_id: householdId,
          })
          .select()
          .single();

        if (parentError) throw parentError;

        const { data: entry, error: entryError } = await supabase
          .from('list_item_quantities')
          .insert({
            list_item_id: parent.id,
            quantity: newItem.quantity ?? null,
            quantity_parsed: newItem.quantity_parsed ?? null,
            store_id: newItem.store_id ?? null,
            added_by: addedBy,
            household_id: householdId,
          })
          .select()
          .single();

        if (entryError) {
          await supabase.from('list_items').delete().eq('id', parent.id);
          throw entryError;
        }

        return { parent, entry };
      } finally {
        decrementLocalMutation();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};

export const useAddQuantityEntry = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async ({
      listItemId,
      quantity,
      quantityParsed,
      storeId,
    }: {
      listItemId: string;
      quantity: string | null;
      quantityParsed: QuantityParsed | null;
      storeId: string | null;
    }) => {
      if (!householdId) throw new Error('No household ID found');

      incrementLocalMutation();
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const addedBy = session?.user?.id ?? null;

        const { data, error } = await supabase
          .from('list_item_quantities')
          .insert({
            list_item_id: listItemId,
            quantity,
            quantity_parsed: quantityParsed,
            store_id: storeId,
            added_by: addedBy,
            household_id: householdId,
          })
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

// Update existing list item parent fields
export const useUpdateListItemFields = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      category_id?: string | null;
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

// Update existing quantity entry fields
export const useUpdateQuantityEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      quantity?: string | null;
      quantity_parsed?: QuantityParsed | null;
      store_id?: string | null;
    }) => {
      const storeChanged = 'store_id' in updates;

      incrementLocalMutation();
      try {
        const { data, error } = await supabase
          .from('list_item_quantities')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        if (storeChanged) {
          await recomputeListItemWarnings((data as QuantityEntry).list_item_id);
        }

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

// Delete quantity entry, and delete parent when no siblings remain
export const useDeleteListItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId }: { entryId: string }) => {
      incrementLocalMutation();
      try {
        const { data: entry, error: fetchError } = await supabase
          .from('list_item_quantities')
          .select('list_item_id')
          .eq('id', entryId)
          .single();

        if (fetchError) throw fetchError;

        const listItemId = entry.list_item_id as string;

        const { count, error: countError } = await supabase
          .from('list_item_quantities')
          .select('*', { count: 'exact', head: true })
          .eq('list_item_id', listItemId)
          .is('archived_at', null)
          .neq('id', entryId);

        if (countError) throw countError;

        const { error: deleteEntryError } = await supabase
          .from('list_item_quantities')
          .delete()
          .eq('id', entryId);

        if (deleteEntryError) throw deleteEntryError;

        const parentDeleted = (count ?? 0) === 0;
        if (parentDeleted) {
          const { error: deleteParentError } = await supabase
            .from('list_items')
            .delete()
            .eq('id', listItemId);
          if (deleteParentError) throw deleteParentError;
        }

        return { entryId, listItemId, parentDeleted };
      } finally {
        decrementLocalMutation();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping_list'] });
    },
  });
};

// End Trip (Create trip record and archive purchased quantity entries)
export const useEndTrip = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async ({ store_id, user_id: targetUserId }: { store_id?: string; user_id?: string } = {}) => {
      if (!householdId) throw new Error('No household ID found');

      const {
        data: { user: currentAuthUser },
      } = await supabase.auth.getUser();

      incrementLocalMutation();
      try {
        const { data: trip, error: tripError } = await supabase
          .from('shopping_trips')
          .insert({
            primary_store_id: store_id || null,
            status: 'completed',
            ended_at: new Date().toISOString(),
            household_id: householdId,
            user_id: targetUserId ?? currentAuthUser?.id ?? null,
          })
          .select()
          .single();

        if (tripError) throw tripError;

        let entriesUpdate = supabase
          .from('list_item_quantities')
          .update({ archived_at: new Date().toISOString(), trip_id: trip.id })
          .eq('is_purchased', true)
          .is('archived_at', null);

        if (store_id) {
          entriesUpdate = entriesUpdate.eq('store_id', store_id);
        }

        if (targetUserId) {
          entriesUpdate = entriesUpdate.eq('purchased_by', targetUserId);
        }

        const { data: items, error: itemsError } = await entriesUpdate.select();
        if (itemsError) throw itemsError;

        const { error: archiveParentsError } = await supabase.rpc('archive_empty_list_items');
        if (archiveParentsError) throw archiveParentsError;

        return { trip, items: items ?? [] };
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
        const { data: entries, error: fetchEntriesError } = await supabase
          .from('list_item_quantities')
          .select('list_item_id')
          .eq('trip_id', trip_id);

        if (fetchEntriesError) throw fetchEntriesError;

        const parentIds = Array.from(new Set((entries ?? []).map((entry) => entry.list_item_id as string)));

        const { error: revertEntriesError } = await supabase
          .from('list_item_quantities')
          .update({ archived_at: null, trip_id: null })
          .eq('trip_id', trip_id);

        if (revertEntriesError) throw revertEntriesError;

        if (parentIds.length > 0) {
          const { error: revertParentsError } = await supabase
            .from('list_items')
            .update({ archived_at: null })
            .in('id', parentIds);

          if (revertParentsError) throw revertParentsError;
        }

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
