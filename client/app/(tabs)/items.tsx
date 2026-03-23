import React, { useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Search, Tag, Store, Plus, X, ChevronDown } from 'lucide-react-native';
import { useAllItems, useCreateMasterItem, useUpdateMasterItem, MasterItem, ItemStorePreference } from '@/api/items';
import { useMetadata } from '@/api/metadata';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderActions } from '@/components/HeaderActions';
import { useUndo } from '@/api/undoContext';

type PreferenceStatus = 'neutral' | 'preferred' | 'avoided' | 'unavailable';

type StorePreferencesState = Record<string, { status: PreferenceStatus; comment: string }>;

const STATUS_OPTIONS: Array<{ label: string; value: PreferenceStatus }> = [
  { label: '—', value: 'neutral' },
  { label: 'Pref.', value: 'preferred' },
  { label: 'Avoid', value: 'avoided' },
  { label: 'Unavailable', value: 'unavailable' },
];
const STORE_FILTER_THRESHOLD = 6;

export default function ItemsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);

  const { data: items, isLoading, error } = useAllItems(search);
  const { data: metadata } = useMetadata();
  const { mutateAsync: createItem } = useCreateMasterItem();
  const { mutateAsync: updateItem } = useUpdateMasterItem();
  const { pushAction } = useUndo();

  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [qty, setQty] = useState('');
  const [altQtys, setAltQtys] = useState('');
  const [storePreferences, setStorePreferences] = useState<StorePreferencesState>({});
  const [categoryId, setCategoryId] = useState('');
  const [selectedPrefStoreId, setSelectedPrefStoreId] = useState('');
  const [prefDropdownOpen, setPrefDropdownOpen] = useState(false);
  const [prefStoreFilterText, setPrefStoreFilterText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const initializeStorePreferences = (item: MasterItem | null = null): StorePreferencesState => {
    const base = Object.fromEntries(
      (metadata?.stores ?? []).map((store) => [store.id, { status: 'neutral', comment: '' }])
    ) as StorePreferencesState;

    if (!item?.item_store_preferences) {
      return base;
    }

    item.item_store_preferences.forEach((preference: ItemStorePreference) => {
      base[preference.store_id] = {
        status: preference.status,
        comment: preference.comment || '',
      };
    });

    return base;
  };

  const openModal = (item: MasterItem | null = null) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setShortName(item.short_name || '');
      setQty(item.default_qty || '');
      setAltQtys(item.alternate_qtys ? item.alternate_qtys.join(', ') : '');
      setStorePreferences(initializeStorePreferences(item));
      setCategoryId(item.default_category_id || '');
    } else {
      setEditingItem(null);
      setName('');
      setShortName('');
      setQty('');
      setAltQtys('');
      setStorePreferences(initializeStorePreferences());
      setCategoryId('');
    }
    setSelectedPrefStoreId('');
    setPrefStoreFilterText('');
    setPrefDropdownOpen(false);
    setIsModalVisible(true);
  };

  const updateStoreStatus = (storeId: string, status: PreferenceStatus) => {
    setStorePreferences((prev) => ({
      ...prev,
      [storeId]: { ...prev[storeId], status },
    }));
  };

  const updateStoreComment = (storeId: string, comment: string) => {
    setStorePreferences((prev) => ({
      ...prev,
      [storeId]: {
        status: prev[storeId]?.status || 'neutral',
        comment,
      },
    }));
  };

  const buildStorePreferencesPayload = () => {
    return Object.entries(storePreferences)
      .filter(([, preference]) => preference.status !== 'neutral' || (preference.comment?.trim().length ?? 0) > 0)
      .map(([store_id, preference]) => ({
        store_id,
        status: preference.status as PreferenceStatus,
        comment: preference.comment || null,
      }));
  };

  const handleSave = async () => {
    if (!name) return;

    const payload = {
      name,
      short_name: shortName || null,
      default_qty: qty,
      alternate_qtys: altQtys
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
      default_category_id: categoryId || null,
      store_preferences: buildStorePreferencesPayload(),
    };

    if (editingItem) {
      const oldSnapshot = {
        name: editingItem.name,
        short_name: editingItem.short_name || null,
        default_qty: editingItem.default_qty || '',
        alternate_qtys: editingItem.alternate_qtys || [],
        default_category_id: editingItem.default_category_id || null,
        store_preferences: (editingItem.item_store_preferences || []).map((preference: ItemStorePreference) => ({
          store_id: preference.store_id,
          status: preference.status,
          comment: preference.comment || null,
        })),
      };

      await updateItem({ id: editingItem.id, ...payload });
      pushAction({
        label: `Edited ${name}`,
        undo: async () => {
          await updateItem({ id: editingItem.id, ...oldSnapshot });
        },
        redo: async () => {
          await updateItem({ id: editingItem.id, ...payload });
        },
      });
    } else {
      await createItem(payload);
    }

    setIsModalVisible(false);
  };

  const selectedPrefStore = metadata?.stores?.find((store) => store.id === selectedPrefStoreId) || null;
  const selectedPrefStatus: PreferenceStatus = selectedPrefStoreId
    ? (storePreferences[selectedPrefStoreId]?.status ?? 'neutral')
    : 'neutral';
  const allPrefStores = metadata?.stores ?? [];
  const filteredPrefStores = prefStoreFilterText.trim()
    ? allPrefStores.filter((store) =>
        store.name.toLowerCase().includes(prefStoreFilterText.toLowerCase())
      )
    : allPrefStores;

  const summaryRows = (['preferred', 'avoided', 'unavailable'] as const)
    .map((status) => {
      const matchingStores = allPrefStores
        .filter((store) => storePreferences[store.id]?.status === status)
        .sort((a, b) => a.name.localeCompare(b.name));
      const label = STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
      return { status, label, matchingStores };
    })
    .filter((group) => group.matchingStores.length > 0);

  const commentRows = allPrefStores.filter(
    (store) => (storePreferences[store.id]?.comment?.trim().length ?? 0) > 0
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || 16 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Master Database</Text>
          <View style={styles.titleRowActions}>
            <TouchableOpacity testID="open-new-item-modal-btn" style={styles.addBtn} onPress={() => openModal()}>
              <Plus size={24} color="#2563eb" />
            </TouchableOpacity>
            <HeaderActions />
          </View>
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

      {error ? (
        <View style={styles.center}>
          <Text style={{ color: 'red', padding: 20, textAlign: 'center' }}>
            Error loading items: {(error as Error).message}
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
          renderItem={({ item }) => {
            const preferredStore = item.item_store_preferences?.find((preference) => preference.status === 'preferred');

            return (
              <TouchableOpacity style={styles.itemCard} onPress={() => openModal(item)}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>
                    {item.name}
                    {item.default_qty ? ` — ${item.default_qty}` : ''}
                  </Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <Tag size={12} color="#6b7280" />
                      <Text style={styles.badgeText}>{item.category?.name || 'Uncategorized'}</Text>
                    </View>
                    <View style={styles.badge}>
                      <Store size={12} color="#6b7280" />
                      <Text style={styles.badgeText}>{preferredStore?.store?.name || 'Any Store'}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No items found in your library.</Text>
            </View>
          }
        />
      )}

      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'New Master Item'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView ref={scrollViewRef} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Item Name</Text>
              <TextInput style={styles.modalInput} value={name} onChangeText={setName} placeholder="e.g. Milk" />

              <Text style={styles.label}>Short Name (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={shortName}
                onChangeText={setShortName}
                placeholder="e.g. PB, OJ"
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

              <Text style={styles.label}>Store Preferences</Text>
              <View style={styles.storePreferenceContainer}>
                <TouchableOpacity
                  testID="pref-store-dropdown-trigger"
                  style={styles.dropdownTrigger}
                  onPress={() => {
                    setPrefStoreFilterText('');
                    setPrefDropdownOpen((prev) => !prev);
                  }}
                >
                  <View style={styles.dropdownValue}>
                    {selectedPrefStore ? (
                      <>
                        <View style={[styles.storeColorDot, { backgroundColor: selectedPrefStore.color_code }]} />
                        <Text style={styles.storeNameText}>{selectedPrefStore.name}</Text>
                      </>
                    ) : (
                      <Text style={styles.dropdownPlaceholder}>Select store...</Text>
                    )}
                  </View>
                  <ChevronDown size={16} color="#6b7280" />
                </TouchableOpacity>

                {prefDropdownOpen ? (
                  <View style={styles.dropdownMenu}>
                    {allPrefStores.length > STORE_FILTER_THRESHOLD ? (
                      <TextInput
                        testID="pref-store-filter-input"
                        style={styles.storeFilterInput}
                        value={prefStoreFilterText}
                        onChangeText={setPrefStoreFilterText}
                        placeholder="Filter stores..."
                        placeholderTextColor="#9ca3af"
                        autoFocus
                      />
                    ) : null}
                    {filteredPrefStores.map((store) => (
                      <TouchableOpacity
                        key={store.id}
                        testID={`pref-store-option-${store.id}`}
                        style={styles.dropdownOption}
                        onPress={() => {
                          setSelectedPrefStoreId(store.id);
                          setPrefDropdownOpen(false);
                          setPrefStoreFilterText('');
                        }}
                      >
                        <View style={[styles.storeColorDot, { backgroundColor: store.color_code }]} />
                        <Text style={styles.storeNameText}>{store.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {filteredPrefStores.length === 0 ? (
                      <Text style={styles.noStoresText}>No stores match</Text>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.segmentedContainer}>
                  {STATUS_OPTIONS.map((option) => {
                    const selected = selectedPrefStatus === option.value;
                    return (
                      <TouchableOpacity
                        key={`pref-pill-${option.value}`}
                        testID={`pref-status-pill-${option.value}`}
                        onPress={() => {
                          if (!selectedPrefStoreId) return;
                          updateStoreStatus(selectedPrefStoreId, option.value);
                        }}
                        style={[styles.segment, selected ? styles.segmentSelected : styles.segmentUnselected]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            selected ? styles.segmentTextSelected : styles.segmentTextUnselected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {selectedPrefStoreId ? (
                  <View style={styles.inlineCommentSection}>
                    <Text style={styles.label}>Comment</Text>
                    <TextInput
                      testID="inline-comment-input"
                      style={styles.modalInput}
                      value={storePreferences[selectedPrefStoreId]?.comment ?? ''}
                      onChangeText={(text) => updateStoreComment(selectedPrefStoreId, text)}
                      onFocus={() => {
                        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
                      }}
                      placeholder="Add a note about this store..."
                      placeholderTextColor="#9ca3af"
                      multiline
                    />
                  </View>
                ) : null}

                {summaryRows.map((group) => (
                  <View key={`summary-${group.status}`} style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{group.label}:</Text>
                    <View style={styles.summaryStores}>
                      {group.matchingStores.map((store) => (
                        <TouchableOpacity
                          key={`summary-store-${group.status}-${store.id}`}
                          testID={`summary-store-${store.id}`}
                          onPress={() => setSelectedPrefStoreId(store.id)}
                        >
                          <Text style={styles.summaryStoreName}>{store.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.label}>All Store Comments</Text>
              <View style={styles.storePreferenceContainer}>
                {commentRows.length === 0 ? (
                  <Text style={styles.emptyCommentText}>No comments yet.</Text>
                ) : (
                  commentRows.map((store) => (
                    <TouchableOpacity
                      key={`comment-row-${store.id}`}
                      testID={`comment-row-${store.id}`}
                      style={styles.commentRow}
                      onPress={() => setSelectedPrefStoreId(store.id)}
                    >
                      <Text style={styles.commentRowText}>{store.name} — "{storePreferences[store.id]?.comment || ''}"</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              <Text style={styles.label}>Category</Text>
              <View style={styles.tagsContainer}>
                <TouchableOpacity
                  testID="category-chip-none"
                  key="none"
                  onPress={() => setCategoryId('')}
                  style={[styles.tag, categoryId === '' ? styles.tagActive : styles.tagInactive]}
                >
                  <Text style={categoryId === '' ? styles.tagTextActive : styles.tagTextInactive}>None</Text>
                </TouchableOpacity>
                {metadata?.categories?.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    testID={`category-chip-${category.id}`}
                    onPress={() => setCategoryId(category.id)}
                    style={[styles.tag, categoryId === category.id ? styles.tagActive : styles.tagInactive]}
                  >
                    <Text style={categoryId === category.id ? styles.tagTextActive : styles.tagTextInactive}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="item-modal-save-btn" style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titleRowActions: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  addBtn: { backgroundColor: '#eff6ff', padding: 8, borderRadius: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#111827' },
  listContent: { padding: 16 },
  itemCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 12,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  badgeRow: { flexDirection: 'row', marginTop: 8, gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  badgeText: { fontSize: 12, color: '#4b5563', marginLeft: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalCloseBtn: { padding: 4 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
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
  storePreferenceContainer: {
    marginBottom: 24,
    gap: 10,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownPlaceholder: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  storeFilterInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noStoresText: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#6b7280',
  },
  storeColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  storeNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  segmentedContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segment: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentSelected: {
    backgroundColor: '#2563eb',
  },
  segmentUnselected: {
    backgroundColor: '#f3f4f6',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextSelected: {
    color: '#ffffff',
  },
  segmentTextUnselected: {
    color: '#374151',
  },
  inlineCommentSection: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  summaryStores: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryStoreName: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  },
  emptyCommentText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  commentRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  commentRowText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  tagActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tagInactive: { backgroundColor: 'white', borderColor: '#d1d5db' },
  tagTextActive: { color: 'white', fontWeight: '600' },
  tagTextInactive: { color: '#374151' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  cancelBtnText: { fontWeight: '700', color: '#4b5563' },
  saveBtnText: { fontWeight: '700', color: 'white' },
});
