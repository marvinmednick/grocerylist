import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { Search, Tag, Store, Plus } from 'lucide-react-native';
import { useAllItems, useCreateMasterItem, useUpdateMasterItem } from '@/api/items';
import { useMetadata } from '@/api/metadata';

export default function ItemsScreen() {
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const { data: items, isLoading, error } = useAllItems(search);
  const { data: metadata } = useMetadata();
  const { mutate: createItem } = useCreateMasterItem();
  const { mutate: updateItem } = useUpdateMasterItem();

  // Form State
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [altQtys, setAltQtys] = useState('');
  const [storeId, setStoreId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const openModal = (item: any = null) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setQty(item.default_qty || '');
      setAltQtys(item.alternate_qtys ? item.alternate_qtys.join(', ') : '');
      setStoreId(item.default_store_id || metadata?.stores?.[0]?.id || '');
      setCategoryId(item.default_category_id || metadata?.categories?.[0]?.id || '');
    } else {
      setEditingItem(null);
      setName('');
      setQty('');
      setAltQtys('');
      setStoreId(metadata?.stores?.[0]?.id || '');
      setCategoryId(metadata?.categories?.[0]?.id || '');
    }
    setIsModalVisible(true);
  };

  const handleSave = () => {
    if (!name) return;

    const payload = {
      name,
      default_qty: qty,
      alternate_qtys: altQtys.split(',').map(s => s.trim()).filter(s => s.length > 0),
      default_store_id: storeId,
      default_category_id: categoryId,
    };

    if (editingItem) {
      updateItem({ id: editingItem.id, ...payload });
    } else {
      createItem(payload);
    }
    
    setIsModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Header / Search */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Master Database</Text>
          <TouchableOpacity 
            style={styles.addBtn}
            onPress={() => openModal()}
          >
            <Plus size={24} color="#2563eb" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchBar}>
          <Search size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your library..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {/* List */}
      {error ? (
        <View style={styles.center}>
          <Text style={{ color: 'red', padding: 20, textAlign: 'center' }}>
            Error loading items: {(error as any).message}
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.itemCard}
              onPress={() => openModal(item)}
            >
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>
                  {item.name}{item.default_qty ? ` - ${item.default_qty}` : ''}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Tag size={12} color="#6b7280" />
                    <Text style={styles.badgeText}>{item.category?.name || 'Uncategorized'}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Store size={12} color="#6b7280" />
                    <Text style={styles.badgeText}>{item.store?.name || 'Any Store'}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No items found in your library.</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Item Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingItem ? 'Edit Item' : 'New Master Item'}
            </Text>
            
            <Text style={styles.label}>Item Name</Text>
            <TextInput 
              style={styles.modalInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Milk"
            />

            <Text style={styles.label}>Default Quantity</Text>
            <TextInput 
              style={styles.modalInput}
              value={qty}
              onChangeText={setQty}
              placeholder="e.g. 1 gal"
            />

            <Text style={styles.label}>Alternate Quantities (comma separated)</Text>
            <TextInput 
              style={styles.modalInput}
              value={altQtys}
              onChangeText={setAltQtys}
              placeholder="e.g. 1/2 gal, 2 gal"
            />

            <Text style={styles.label}>Default Store</Text>
            <View style={styles.tagsContainer}>
              {metadata?.stores?.map(store => (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => setStoreId(store.id)}
                  style={[styles.tag, storeId === store.id ? styles.tagActive : styles.tagInactive]}
                >
                  <Text style={storeId === store.id ? styles.tagTextActive : styles.tagTextInactive}>
                    {store.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.tagsContainer}>
              {metadata?.categories?.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={[styles.tag, categoryId === cat.id ? styles.tagActive : styles.tagInactive]}
                >
                  <Text style={categoryId === cat.id ? styles.tagTextActive : styles.tagTextInactive}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>
                  {editingItem ? 'Update Item' : 'Save to Library'}
                </Text>
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
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  addBtn: { backgroundColor: '#eff6ff', padding: 8, borderRadius: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 12, height: 44, borderRadius: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#111827' },
  listContent: { padding: 16 },
  itemCard: { backgroundColor: '#f9fafb', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  badgeRow: { flexDirection: 'row', marginTop: 8, gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  badgeText: { fontSize: 12, color: '#4b5563', marginLeft: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase' },
  modalInput: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  tagActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tagInactive: { backgroundColor: 'white', borderColor: '#d1d5db' },
  tagTextActive: { color: 'white' },
  tagTextInactive: { color: '#374151' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center' },
  cancelBtnText: { fontWeight: '700', color: '#4b5563' },
  saveBtnText: { fontWeight: '700', color: 'white' },
});