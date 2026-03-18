import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useCreateStore, useMetadata } from '@/api/metadata';

const STORE_COLORS = [
  '#005596',
  '#00674b',
  '#e31837',
  '#bc2026',
  '#2563eb',
  '#16a34a',
  '#ea580c',
  '#9333ea',
  '#0d9488',
  '#db2777',
];

interface StoreSelectorProps {
  activeStoreId: string;
  onStoreChange: (storeId: string) => void;
}

export const StoreSelector: React.FC<StoreSelectorProps> = ({ activeStoreId, onStoreChange }) => {
  const { data: metadata } = useMetadata();
  const createStoreMutation = useCreateStore();
  const createStore = createStoreMutation?.mutateAsync;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreColor, setNewStoreColor] = useState(STORE_COLORS[0]);

  const stores = metadata?.stores ?? [];
  const activeStore = useMemo(
    () => stores.find((store) => store.id === activeStoreId),
    [stores, activeStoreId]
  );

  const openCreateModal = () => {
    setIsDropdownOpen(false);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setNewStoreName('');
    setNewStoreColor(STORE_COLORS[0]);
    setIsCreateModalOpen(false);
  };

  const handleCreateStore = async () => {
    if (!newStoreName.trim() || !createStore) return;

    const created = await createStore({
      name: newStoreName.trim(),
      color_code: newStoreColor,
    });
    onStoreChange(created.id);
    closeCreateModal();
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        testID="store-selector-trigger"
        style={styles.trigger}
        onPress={() => setIsDropdownOpen((prev) => !prev)}
      >
        <Text
          style={[
            styles.activeStoreText,
            activeStore ? { color: activeStore.color_code } : styles.placeholderText,
          ]}
          numberOfLines={1}
        >
          {activeStore ? activeStore.name : 'Select Store'}
        </Text>
        <Text style={styles.chevronText}> ▾</Text>
      </TouchableOpacity>

      {isDropdownOpen ? (
        <>
          <Pressable
            style={styles.overlay}
            onPress={() => setIsDropdownOpen(false)}
            testID="store-selector-overlay"
          />
          <View style={styles.dropdown}>
            {stores.map((store) => (
              <TouchableOpacity
                key={store.id}
                style={styles.dropdownRow}
                onPress={() => {
                  onStoreChange(store.id);
                  setIsDropdownOpen(false);
                }}
              >
                <View style={[styles.storeDot, { backgroundColor: store.color_code }]} />
                <Text style={styles.storeName}>{store.name}</Text>
                {store.id === activeStoreId ? (
                  <View testID={`active-store-check-${store.id}`}>
                    <Check size={16} color="#2563eb" />
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addStoreRow} onPress={openCreateModal}>
              <Text style={styles.addStoreText}>+ Add new store</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      <Modal visible={isCreateModalOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Store</Text>
              <TouchableOpacity onPress={closeCreateModal} style={styles.modalCloseBtn}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Name</Text>
              <TextInput
                testID="new-store-name-input"
                style={styles.input}
                value={newStoreName}
                onChangeText={setNewStoreName}
                placeholder="Store name"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.label}>Color</Text>
              <View style={styles.colorRow}>
                {STORE_COLORS.map((color) => {
                  const isSelected = color === newStoreColor;
                  return (
                    <TouchableOpacity
                      key={color}
                      testID={`store-color-${color}`}
                      onPress={() => setNewStoreColor(color)}
                      style={[
                        styles.colorCircle,
                        {
                          backgroundColor: color,
                          borderWidth: 2,
                          borderColor: isSelected ? 'white' : 'transparent',
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeCreateModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addButton, !newStoreName.trim() && styles.addButtonDisabled]}
                disabled={!newStoreName.trim()}
                onPress={handleCreateStore}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 20,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 220,
  },
  activeStoreText: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholderText: {
    color: '#6b7280',
  },
  chevronText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6b7280',
  },
  overlay: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 30,
  },
  dropdown: {
    position: 'absolute',
    top: 34,
    left: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 220,
    zIndex: 40,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  storeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  storeName: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  addStoreRow: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addStoreText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalCloseBtn: { padding: 4 },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
    fontSize: 16,
    marginBottom: 16,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
