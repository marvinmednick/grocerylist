import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useHousehold } from '@/lib/household';

export interface TripSummary {
  id: string;
  started_at: string;
  ended_at: string;
  primary_store_id: string | null;
  user_id: string | null;
  store: { name: string } | null;
  owner: { display_name_short: string | null; display_name: string } | null;
  list_item_quantities: { id: string }[];
}

export interface TripItem {
  id: string;
  name: string;
  quantity: string;
  store_id: string | null;
  store: { name: string } | null;
}

export const useTripHistory = () => {
  const { householdId } = useHousehold();

  return useQuery({
    queryKey: ['trip_history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopping_trips')
        .select(`
          id,
          started_at,
          ended_at,
          primary_store_id,
          user_id,
          store:stores!primary_store_id(name),
          owner:profiles!user_id(display_name_short, display_name),
          list_item_quantities(id)
        `)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false });

      if (error) throw error;
      return data as TripSummary[];
    },
    enabled: !!householdId,
  });
};

export const useTripItems = (tripId: string | null) => {
  return useQuery({
    queryKey: ['trip_items', tripId],
    queryFn: async () => {
      if (!tripId) return [];

      const { data, error } = await supabase
        .from('list_items')
        .select(`
          id,
          name,
          quantities:list_item_quantities!list_item_id(*, store:stores!store_id(name, color_code))
        `)
        .not('archived_at', 'is', null)
        .eq('quantities.trip_id', tripId)
        .order('name', { ascending: true });

      if (error) throw error;
      const tripItems: TripItem[] = [];
      for (const parent of data ?? []) {
        const parentRecord = parent as {
          id: string;
          name: string;
          quantities: Array<{
            id: string;
            quantity: string | null;
            trip_id: string | null;
            store_id: string | null;
            store: { name: string } | null;
          }>;
        };
        for (const entry of parentRecord.quantities ?? []) {
          if (entry.trip_id !== tripId) continue;
          tripItems.push({
            id: entry.id,
            name: parentRecord.name,
            quantity: entry.quantity ?? '',
            store_id: entry.store_id,
            store: entry.store,
          });
        }
      }

      return tripItems;
    },
    enabled: !!tripId,
  });
};
