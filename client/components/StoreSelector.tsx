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
import { Check, Pencil, Trash2, X } from 'lucide-react-native';
import { useCreateStore, useDeleteStore, useMetadata, useStoreCascadeInfo, useUpdateStore } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

interface StoreOption {
  id: string;
  name: string;
  color_code: string;
}

export const StoreSelector: React.FC<StoreSelectorProps> = ({ activeStoreId, onStoreChange }) => {
  const insets = useSafeAreaInsets();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreColor, setNewStoreColor] = useState(STORE_COLORS[0]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreOption | null>(null);
  const [editStoreName, setEditStoreName] = useState('');
  const [editStoreColor, setEditStoreColor] = useState(STORE_COLORS[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: metadata } = useMetadata();
  const createStoreMutation = useCreateStore();
  const updateStoreMutation = useUpdateStore();
  const deleteStoreMutation = useDeleteStore();
  const { pushAction } = useUndo();
  const cascadeQuery = useStoreCascadeInfo(showDeleteConfirm ? editingStore?.id ?? null : null);
  const cascadeInfo = cascadeQuery?.data;
  const createStore = createStoreMutation?.mutateAsync;

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

  const openEditModal = (store: StoreOption) => {
    setEditingStore(store);
    setEditStoreName(store.name);
    setEditStoreColor(store.color_code);
    setShowDeleteConfirm(false);
    setIsDropdownOpen(false);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditingStore(null);
    setEditStoreName('');
    setEditStoreColor(STORE_COLORS[0]);
    setShowDeleteConfirm(false);
    setIsEditModalOpen(false);
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

  const handleUpdateStore = async () => {
    if (!editingStore || !editStoreName.trim()) return;

    const prev = { id: editingStore.id, name: editingStore.name, color_code: editingStore.color_code };
    const next = { id: editingStore.id, name: editStoreName.trim(), color_code: editStoreColor };

    await updateStoreMutation.mutateAsync(next);
    pushAction({
      label: `Renamed store to ${next.name}`,
      undo: async () => {
        await updateStoreMutation.mutateAsync(prev);
      },
      redo: async () => {
        await updateStoreMutation.mutateAsync(next);
      },
    });
    closeEditModal();
  };

  const handleDeleteStore = async () => {
    if (!editingStore) return;

    const deletedId = editingStore.id;
    await deleteStoreMutation.mutateAsync(deletedId);

    if (deletedId === activeStoreId) {
      const remaining = stores.filter((store) => store.id !== deletedId);
      onStoreChange(remaining.length > 0 ? remaining[0].id : '');
    }

    closeEditModal();
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
                <TouchableOpacity
                  testID={`edit-store-btn-${store.id}`}
                  onPress={() => openEditModal(store)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.editStoreBtn}
                >
                  <Pencil size={14} color="#9ca3af" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addStoreRow} onPress={openCreateModal}>
              <Text style={styles.addStoreText}>+ Add new store</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      <Modal visible={isCreateModalOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, { paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom }]}
        >
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

      <Modal visible={isEditModalOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, { paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom }]}
        >
          <View style={styles.modalCard}>
            <View style={styles.editModalHeader}>
              <TouchableOpacity
                testID="edit-store-trash-btn"
                onPress={() => setShowDeleteConfirm(true)}
                style={styles.trashPill}
              >
                <Trash2 size={16} color="#dc2626" />
              </TouchableOpacity>
              <Text style={styles.editModalTitle}>Edit Store</Text>
              <TouchableOpacity onPress={closeEditModal} style={styles.modalCloseBtn}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Name</Text>
              <TextInput
                testID="edit-store-name-input"
                style={styles.input}
                value={editStoreName}
                onChangeText={setEditStoreName}
                placeholder="Store name"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.label}>Color</Text>
              <View style={styles.colorRow}>
                {STORE_COLORS.map((color) => {
                  const isSelected = color === editStoreColor;
                  return (
                    <TouchableOpacity
                      key={`edit-${color}`}
                      testID={`edit-store-color-${color}`}
                      onPress={() => setEditStoreColor(color)}
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

              {showDeleteConfirm ? (
                <View style={styles.deleteConfirmSection}>
                  <Text style={styles.deleteConfirmText}>
                    {cascadeInfo
                      ? `Deleting ${editStoreName.trim() || editingStore?.name || 'this store'} will remove preferences for ${cascadeInfo.itemPrefsCount} item(s) and unassign ${cascadeInfo.activeListItemsCount} active list item(s). This cannot be undone.`
                      : 'Loading...'}
                  </Text>
                  <View style={styles.deleteConfirmActions}>
                    <TouchableOpacity style={styles.cancelDeleteBtn} onPress={() => setShowDeleteConfirm(false)}>
                      <Text style={styles.cancelDeleteBtnText}>Cancel delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteStore}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeEditModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addButton, !editStoreName.trim() && styles.addButtonDisabled]}
                disabled={!editStoreName.trim()}
                onPress={handleUpdateStore}
              >
                <Text style={styles.addButtonText}>Save</Text>
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
  editStoreBtn: {
    padding: 4,
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseBtn: {
    padding: 4,
  },
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
  deleteConfirmSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    gap: 10,
  },
  deleteConfirmText: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 18,
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelDeleteBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelDeleteBtnText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  trashPill: {
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 8,
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
