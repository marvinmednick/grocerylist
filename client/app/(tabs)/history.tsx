import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, X } from 'lucide-react-native';
import { useTripHistory, useTripItems, TripSummary, TripItem } from '@/api/trips';
import { supabase } from '@/lib/supabase';
import { HeaderActions } from '@/components/HeaderActions';

const getOwnerName = (trip: TripSummary) => {
  return trip.owner?.display_name_short ?? trip.owner?.display_name?.split('@')[0] ?? 'Unknown';
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripSummary | null>(null);

  const { data: trips, isLoading } = useTripHistory();
  const { data: tripItems, isLoading: isTripItemsLoading } = useTripItems(selectedTrip?.id ?? null);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };

    loadUser();
  }, []);

  const renderTripRow = ({ item }: { item: TripSummary }) => {
    const isOwnTrip = item.user_id === currentUserId || item.user_id === null;
    const itemCountText = `${item.list_item_quantities.length} items`;
    const detailsText = isOwnTrip ? itemCountText : `· ${getOwnerName(item)} · ${itemCountText}`;

    return (
      <Pressable
        style={styles.tripRow}
        onPress={() => setSelectedTrip(item)}
        testID={`trip-row-${item.id}`}>
        <View style={styles.tripRowLeft}>
          <Text style={styles.storeName}>{item.store?.name ?? 'All Stores'}</Text>
          <Text style={styles.tripMeta}>{new Date(item.ended_at).toLocaleDateString()}</Text>
          <Text style={styles.tripMeta}>{detailsText}</Text>
        </View>
        <ChevronRight size={20} color="#6b7280" />
      </Pressable>
    );
  };

  const renderTripItem = ({ item }: { item: TripItem }) => {
    const showStore = selectedTrip && item.store_id !== selectedTrip.primary_store_id && item.store?.name;
    const quantityText = item.quantity ?? '';

    return (
      <View style={styles.itemRow}>
        <Text style={styles.itemText}>{item.name}</Text>
        <Text style={styles.itemText}>
          {quantityText}
          {showStore ? ` (${item.store?.name})` : ''}
        </Text>
      </View>
    );
  };

  const selectedTripDate = selectedTrip ? new Date(selectedTrip.ended_at).toLocaleDateString() : '';
  const selectedStoreName = selectedTrip?.store?.name ?? 'All Stores';
  const selectedIsOwnTrip = selectedTrip
    ? selectedTrip.user_id === currentUserId || selectedTrip.user_id === null
    : true;
  const selectedOwnerName = selectedTrip ? getOwnerName(selectedTrip) : '';

  return (
    <View style={styles.container}>
      <View style={[styles.screenHeader, { paddingTop: insets.top || 20 }]}>
        <Text style={styles.screenTitle}>History</Text>
        <HeaderActions />
      </View>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" testID="history-loading" />
        </View>
      ) : (
        <FlatList
          data={trips ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderTripRow}
          contentContainerStyle={(trips?.length ?? 0) === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No past trips yet</Text>}
        />
      )}

      <Modal visible={selectedTrip !== null} animationType="slide" onRequestClose={() => setSelectedTrip(null)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: (insets.top || 18) + 8 }]}>
            <Text style={styles.modalTitle} testID="history-modal-title">
              {selectedIsOwnTrip
                ? `${selectedStoreName} — ${selectedTripDate}`
                : `${selectedStoreName} — ${selectedTripDate} · ${selectedOwnerName}`}
            </Text>
            <TouchableOpacity onPress={() => setSelectedTrip(null)} testID="history-close-modal">
              <X size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          {isTripItemsLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#2563eb" testID="trip-items-loading" />
            </View>
          ) : (
            <FlatList
              data={tripItems ?? []}
              keyExtractor={(item) => item.id}
              renderItem={renderTripItem}
              contentContainerStyle={(tripItems?.length ?? 0) === 0 ? styles.emptyContainer : styles.listContent}
              ListEmptyComponent={<Text style={styles.emptyText}>No items in this trip</Text>}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  screenHeader: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  tripRow: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripRowLeft: {
    flex: 1,
    gap: 4,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  tripMeta: {
    fontSize: 14,
    color: '#4b5563',
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  itemRow: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 15,
    color: '#111827',
  },
});
