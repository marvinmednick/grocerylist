import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, SectionList, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { CheckCircle2, Circle, Archive, RotateCcw, Trash2 } from 'lucide-react-native';
import { SmartAddItem } from '@/components/SmartAddItem';
import { useShoppingList, useTogglePurchased, useUpdateListItem, useEndTrip, useDeleteListItem, useRevertArchival, ListItem } from '@/api/list';
import { useUndo } from '@/api/undoContext';
import { useMetadata } from '@/api/metadata';

export default function ShoppingListScreen() {
  const { data: listItems, isLoading } = useShoppingList();
  const { mutateAsync: togglePurchased } = useTogglePurchased();
  const { mutateAsync: updateListItem } = useUpdateListItem();
  const { mutateAsync: endTrip } = useEndTrip();
  const { mutateAsync: deleteItem } = useDeleteListItem();
  const { mutateAsync: revertArchival } = useRevertArchival();
  
  const { undoLastAction, pushAction, canUndo, undoStack } = useUndo();
  const { data: metadata } = useMetadata();

  // Undo state
  const [lastTripId, setLastTripId] = useState<string | null>(null);

  // Edit State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editStoreId, setEditStoreId] = useState('');

  useEffect(() => {
    if (lastTripId) {
      const timer = setTimeout(() => setLastTripId(null), 10000); // 10 seconds
      return () => clearTimeout(timer);
    }
  }, [lastTripId]);

  // Group items by Store for SectionList
  const sections = React.useMemo(() => {
    if (!listItems) return [];
    const groups: Record<string, { id: string; data: ListItem[] }> = {};
    listItems.forEach(item => {
      const storeName = item.store?.name || 'Other';
      const storeId = item.store_id || '';
      if (!groups[storeName]) groups[storeName] = { id: storeId, data: [] };
      groups[storeName].data.push(item);
    });
    return Object.entries(groups).map(([title, { id, data }]) => ({ title, id, data }));
  }, [listItems]);

  const handleToggle = async (item: ListItem) => {
    const newStatus = !item.is_purchased;
    await togglePurchased({ id: item.id, is_purchased: newStatus });
    
    pushAction({
      label: `${newStatus ? 'Checked' : 'Unchecked'} ${item.name}`,
      undo: async () => {
        await togglePurchased({ id: item.id, is_purchased: !newStatus });
      }
    });
  };

  const openEditModal = (item: ListItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditQty(item.quantity || '');
    setEditStoreId(item.store_id || '');
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    const previousState = {
      name: editingItem.name,
      quantity: editingItem.quantity,
      store_id: editingItem.store_id,
    };

    const updates = {
      name: editName,
      quantity: editQty,
      store_id: editStoreId,
    };

    await updateListItem({ id: editingItem.id, ...updates });

    pushAction({
      label: `Edited ${editName}`,
      undo: async () => {
        await updateListItem({ id: editingItem.id, ...previousState });
      }
    });

    setIsEditModalVisible(false);
    setEditingItem(null);
  };

  const handleDelete = async () => {
    if (!editingItem) return;

    const itemToDelete = { ...editingItem };
    await deleteItem(itemToDelete.id);

    pushAction({
      label: `Deleted ${itemToDelete.name}`,
      undo: async () => {
        await addItem({
          name: itemToDelete.name,
          quantity: itemToDelete.quantity,
          store_id: itemToDelete.store_id,
          category_id: itemToDelete.category_id,
          item_id: itemToDelete.item_id,
        });
      }
    });

    setIsEditModalVisible(false);
    setEditingItem(null);
  };

  const handleEndTrip = async (storeId?: string, storeName?: string) => {
    const title = storeName ? `End Trip at ${storeName}?` : 'End All Shopping Trips?';
    if (confirm(`${title}\n\nThis will archive all purchased items.`)) {
      try {
        const result = await endTrip({ store_id: storeId });
        if (result?.trip?.id) {
          pushAction({
            label: `Ended trip ${storeName || 'All'}`,
            undo: async () => {
              await revertArchival({ trip_id: result.trip.id });
            }
          });
        }
      } catch (err) {
        console.error('Failed to end trip:', err);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Global Header */}
      <View style={styles.globalHeader}>
        <Text style={styles.globalTitle}>Shopping List</Text>
        <TouchableOpacity 
          onPress={undoLastAction} 
          disabled={!canUndo}
          style={[styles.headerUndoBtn, !canUndo && { opacity: 0.3 }]}
        >
          <RotateCcw size={20} color={canUndo ? "#2563eb" : "#9ca3af"} />
          {undoStack.length > 0 && (
            <View style={styles.undoBadge}>
              <Text style={styles.undoBadgeText}>{undoStack.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.headerContainer}>
        <SmartAddItem />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0000ff" /></View>
      ) : (
        <SectionList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title, id, data } }) => {
            const hasPurchased = data.some(item => item.is_purchased);
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
                {hasPurchased && (
                  <TouchableOpacity onPress={() => handleEndTrip(id, title)} style={styles.inlineEndTripBtn}>
                    <Archive size={14} color="#2563eb" />
                    <Text style={styles.inlineEndTripText}>End Trip</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              {/* Col 1: Checkbox (Toggle Zone) */}
              <TouchableOpacity 
                style={styles.colCheckbox}
                onPress={() => handleToggle(item)}
              >
                {item.is_purchased ? <CheckCircle2 size={24} color="#10b981" /> : <Circle size={24} color="#d1d5db" />}
              </TouchableOpacity>

              {/* Col 2: Name (Edit Zone) */}
              <TouchableOpacity 
                style={styles.colName}
                onPress={() => openEditModal(item)}
              >
                 <Text style={[styles.nameText, item.is_purchased && styles.strikethrough]} numberOfLines={1}>
                    {item.name}{item.quantity ? ` - ${item.quantity}` : ''}
                  </Text>
              </TouchableOpacity>

               <View style={styles.colCategory}>
                 <Text style={styles.categoryText} numberOfLines={1}>{item.category?.name || '—'}</Text>
               </View>
            </View>
          )}
          stickySectionHeadersEnabled={true}
          ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>Your list is empty.</Text></View>}
          ListFooterComponent={() => {
            const hasAnyPurchased = listItems?.some(item => item.is_purchased);
            if (!hasAnyPurchased) return null;
            return (
              <TouchableOpacity style={styles.globalEndTripBtn} onPress={() => handleEndTrip()}>
                <Archive size={20} color="white" />
                <Text style={styles.globalEndTripText}>End All Shopping Trips</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={isEditModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Item</Text>
              <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Name</Text>
            <TextInput 
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
            />

            <Text style={styles.label}>Quantity</Text>
            <TextInput 
              style={styles.modalInput}
              value={editQty}
              onChangeText={setEditQty}
            />

            <Text style={styles.label}>Store</Text>
            <View style={styles.tagsContainer}>
              {metadata?.stores?.map(store => (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => setEditStoreId(store.id)}
                  style={[
                    styles.tag,
                    editStoreId === store.id ? styles.tagActive : styles.tagInactive
                  ]}
                >
                  <Text style={editStoreId === store.id ? styles.tagTextActive : styles.tagTextInactive}>
                    {store.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.saveBtn]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  globalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  globalTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  headerUndoBtn: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    position: 'relative',
  },
  undoBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  undoBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
  },
  headerContainer: { paddingTop: 8, paddingBottom: 8, backgroundColor: '#ffffff', zIndex: 10, width: '100%', maxWidth: 600, alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  listContent: { paddingBottom: 100 },
  sectionHeader: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderText: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9fafb', backgroundColor: '#ffffff', width: '100%' },
  colCheckbox: { marginRight: 12, width: 24, alignItems: 'center' },
  colName: { flex: 1, marginRight: 8 },
  nameText: { fontSize: 16, fontWeight: '500', color: '#111827' },
  strikethrough: { textDecorationLine: 'line-through', color: '#9ca3af' },
  colCategory: { width: 80, alignItems: 'flex-end' },
  categoryText: { fontSize: 12, color: '#9ca3af' },
  inlineEndTripBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe' },
  inlineEndTripText: { fontSize: 11, fontWeight: '700', color: '#2563eb', marginLeft: 4 },
  globalEndTripBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', margin: 20, padding: 16, borderRadius: 16, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  globalEndTripText: { color: 'white', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  emptyContainer: { padding: 32, alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', fontSize: 16 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tagInactive: {
    backgroundColor: 'white',
    borderColor: '#d1d5db',
  },
  tagTextActive: {
    color: 'white',
  },
  tagTextInactive: {
    color: '#374151',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#e5e7eb',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
  },
  cancelText: {
    fontWeight: '700',
    color: '#374151',
  },
  saveText: {
    fontWeight: '700',
    color: 'white',
  },
});