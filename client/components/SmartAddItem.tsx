import React, { useRef, useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal, Keyboard, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { Search, X, ChevronRight } from 'lucide-react-native';
import { computeWarnings, getWarningText, useSearchItems, useCreateMasterItem, type MasterItem, type Warning } from '@/api/items';
import { useAddToList, useDeleteListItem } from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';
import { useMyProfile } from '@/api/profile';
import { WarningCallout } from '@/components/WarningCallout';

interface SmartAddItemProps {
  disabled?: boolean;
  activeStoreId: string;
  onWarningToast?: (message: string) => void;
}

// EditTarget covers both master items (from search) and one-off items (no master record yet)
type EditTarget = MasterItem | { name: string; id: null };

const DEFAULT_WARNING_PREFS = {
  avoided: 'toast_and_badge',
  unavailable: 'toast_and_badge',
  non_preferred: 'badge_only',
  non_standard_qty: 'badge_only',
} as const;

export function SmartAddItem({ disabled = false, activeStoreId, onWarningToast }: SmartAddItemProps) {
  const [query, setQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EditTarget | null>(null);
  const [selections, setSelections] = useState<Record<string, { qty: string }>>({});
  const [otherQtyPopoverItemId, setOtherQtyPopoverItemId] = useState<string | null>(null);
  const [otherQtyInput, setOtherQtyInput] = useState('');
  const [oneOffQty, setOneOffQty] = useState('1');
  const [oneOffQtyPopoverOpen, setOneOffQtyPopoverOpen] = useState(false);
  const [oneOffQtyInput, setOneOffQtyInput] = useState('');

  const [editQty, setEditQty] = useState('');
  const [editStoreId, setEditStoreId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const editQtyInputRef = useRef<TextInput>(null);

  const { data: results = [] } = useSearchItems(query);
  const { mutateAsync: addItem } = useAddToList();
  const { mutateAsync: createMasterItem } = useCreateMasterItem();
  const { mutateAsync: deleteItem } = useDeleteListItem();
  const { data: metadata } = useMetadata();
  const myProfileQuery = useMyProfile();
  const myProfile = myProfileQuery?.data;
  const { pushAction } = useUndo();

  const getSelection = (item: MasterItem) => {
    return selections[item.id] || {
      qty: item.default_qty || '1',
    };
  };

  const toggleSelection = (itemId: string, updates: { qty: string }) => {
    const item = results.find((result) => result.id === itemId);
    setSelections((prev) => ({
      ...prev,
      [itemId]: { ...getSelection(item), ...updates },
    }));
  };

  const clearAndClose = () => {
    setQuery('');
    setIsEditing(false);
    setSelectedItem(null);
    setSelections({});
    setOtherQtyPopoverItemId(null);
    setOtherQtyInput('');
    setOneOffQty('1');
    setOneOffQtyPopoverOpen(false);
    setOneOffQtyInput('');
    Keyboard.dismiss();
  };

  const maybeTriggerWarningToast = (warnings: Warning[]) => {
    if (!onWarningToast || warnings.length === 0) {
      return;
    }

    const prefs = myProfile?.warning_preferences ?? DEFAULT_WARNING_PREFS;
    const shouldToast = warnings.some((warning) => {
      if (warning.type === 'non_preferred') {
        return false;
      }
      return prefs[warning.type] === 'toast_and_badge';
    });

    if (!shouldToast) {
      return;
    }

    const message = warnings.map((warning) => getWarningText(warning)).join(' • ').trim();
    if (message.length > 0) {
      onWarningToast(message);
    }
  };

  const onCommitAdd = async (item: MasterItem) => {
    Keyboard.dismiss();
    const selection = getSelection(item);
    const name = item.name;
    const warnings = computeWarnings(
      item.item_store_preferences,
      activeStoreId,
      selection.qty,
      item.default_qty,
      item.alternate_qtys
    );

    const forwardAction = async () => {
      return await addItem({
        name: item.name,
        item_id: item.id,
        quantity: selection.qty,
        store_id: activeStoreId || null,
        category_id: item.default_category_id,
        warnings,
      });
    };

    const result = await forwardAction();
    const tracker = { currentId: result.id };

    pushAction({
      label: `Added ${name} (${selection.qty})`,
      undo: async () => {
        await deleteItem(tracker.currentId);
      },
      redo: async () => {
        const redone = await forwardAction();
        tracker.currentId = redone.id;
      },
    });

    clearAndClose();
    setTimeout(() => maybeTriggerWarningToast(warnings), 400);
  };

  const onOneOffAdd = async () => {
    const name = query;
    const forwardAction = async () => {
      return await addItem({
        name: query,
        item_id: null,
        quantity: oneOffQty,
        store_id: activeStoreId || null,
        category_id: null,
        warnings: [],
      });
    };

    const result = await forwardAction();
    const tracker = { currentId: result.id };

    pushAction({
      label: `Added ${name}`,
      undo: async () => {
        await deleteItem(tracker.currentId);
      },
      redo: async () => {
        const redone = await forwardAction();
        tracker.currentId = redone.id;
      },
    });

    clearAndClose();
  };

  const selectedMasterItem = selectedItem?.id ? selectedItem : null;
  const editWarnings = selectedMasterItem
    ? computeWarnings(
        selectedMasterItem.item_store_preferences,
        editStoreId,
        editQty,
        selectedMasterItem.default_qty,
        selectedMasterItem.alternate_qtys
      )
    : [];

  const onEditAdd = (item: EditTarget) => {
    Keyboard.dismiss();
    setSelectedItem(item);
    setEditQty(item.default_qty || '1');
    setEditStoreId(activeStoreId || metadata?.stores?.[0]?.id || '');
    setEditCategoryId(item.default_category_id || '');
    setIsEditing(true);
  };

  const onOneOffEditAdd = async () => {
    const itemName = selectedItem?.name || query;
    const forwardAction = async () => {
      return await addItem({
        name: itemName,
        item_id: null,
        quantity: editQty,
        store_id: editStoreId || null,
        category_id: editCategoryId || null,
        warnings: [],
      });
    };

    const result = await forwardAction();
    const tracker = { currentId: result.id };

    pushAction({
      label: `Added ${itemName}`,
      undo: async () => {
        await deleteItem(tracker.currentId);
      },
      redo: async () => {
        const redone = await forwardAction();
        tracker.currentId = redone.id;
      },
    });

    clearAndClose();
  };

  const onSaveEdited = async () => {
    editQtyInputRef.current?.blur();
    let itemId = selectedItem?.id;
    const itemName = selectedItem?.name || query;

    if (!itemId) {
      try {
        const newItem = await createMasterItem({
          name: itemName,
          default_qty: editQty,
          default_category_id: editCategoryId || null,
        });
        itemId = newItem.id;
      } catch (err) {
        console.error('Failed to create master item:', err);
        return;
      }
    }

    const warnings = selectedItem?.id
      ? computeWarnings(
          selectedItem.item_store_preferences,
          editStoreId,
          editQty,
          selectedItem.default_qty,
          selectedItem.alternate_qtys
        )
      : [];

    const forwardAction = async () => {
      return await addItem({
        name: itemName,
        item_id: itemId || null,
        quantity: editQty,
        store_id: editStoreId || null,
        category_id: editCategoryId || null,
        warnings,
      });
    };

    const result = await forwardAction();
    const tracker = { currentId: result.id };

    pushAction({
      label: `Added ${itemName}`,
      undo: async () => {
        await deleteItem(tracker.currentId);
      },
      redo: async () => {
        const redone = await forwardAction();
        tracker.currentId = redone.id;
      },
    });

    clearAndClose();
    setTimeout(() => maybeTriggerWarningToast(warnings), 400);
  };

  return (
    <View style={[styles.container, disabled && { opacity: 0.6 }]}>
      <View style={styles.searchBar}>
        <Search size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder={disabled ? 'Loading household...' : 'Add item...'}
          value={query}
          onChangeText={setQuery}
          placeholderTextColor="#9ca3af"
          editable={!disabled}
        />
        {query.length > 0 && !disabled && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
            <X size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {(results.length > 0 || query.length > 1) && (
        <View style={styles.dropdown}>
          {results.length > 0 && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>BEST MATCHES</Text>
            </View>
          )}

          {results.map((item) => {
            const selection = getSelection(item);
            const qtyOptions = [item.default_qty || '1', ...(item.alternate_qtys || [])];
            const hasCustomQty = !qtyOptions.includes(selection.qty);

            return (
              <View key={item.id} style={styles.resultRowComplex}>
                <View style={styles.resultMainSection}>
                  <TouchableOpacity style={styles.resultHeader} onPress={() => onCommitAdd(item)}>
                    <Text style={styles.resultName}>{item.name}</Text>
                  </TouchableOpacity>

                  <View style={styles.inlinePillRow}>
                    <Text style={styles.inlineLabel}>Qty: </Text>
                    {qtyOptions.map((qtyOption: string) => {
                      const isActive = selection.qty === qtyOption;
                      return (
                        <TouchableOpacity
                          key={qtyOption}
                          style={[styles.inlinePill, isActive && styles.pillActiveBlue]}
                          onPress={() => toggleSelection(item.id, { qty: qtyOption })}
                        >
                          <Text style={[styles.inlinePillText, isActive && styles.pillTextActive]}>{qtyOption}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      testID={`result-qty-chip-other-${item.id}`}
                      style={[styles.inlinePill, hasCustomQty && styles.pillActiveBlue]}
                      onPress={() => {
                        setOtherQtyPopoverItemId(item.id);
                        setOtherQtyInput('');
                      }}
                    >
                      <Text style={[styles.inlinePillText, hasCustomQty && styles.pillTextActive]}>
                        {hasCustomQty ? selection.qty : 'Other'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {otherQtyPopoverItemId === item.id && (
                    <View style={styles.otherQtyPopover}>
                      <TextInput
                        style={styles.otherQtyInput}
                        value={otherQtyInput}
                        onChangeText={setOtherQtyInput}
                        placeholder="e.g. 3 lbs"
                        placeholderTextColor="#9ca3af"
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          const trimmed = otherQtyInput.trim();
                          if (trimmed) {
                            toggleSelection(item.id, { qty: trimmed });
                          }
                          setOtherQtyPopoverItemId(null);
                        }}
                      />
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  testID={`edit-add-${item.id}`}
                  style={styles.resultEditBtn}
                  onPress={() => onEditAdd(item)}
                >
                  <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={styles.createRow}>
            <View style={styles.createMain}>
              <TouchableOpacity style={styles.createMainButton} onPress={onOneOffAdd}>
                <Text style={styles.createText}>Add "{query}" (One-time)</Text>
              </TouchableOpacity>
              <View style={styles.inlinePillRow}>
                <Text style={styles.inlineLabel}>Qty: </Text>
                <TouchableOpacity
                  testID="one-off-qty-chip-1"
                  style={[styles.inlinePill, oneOffQty === '1' && styles.pillActiveBlue]}
                  onPress={() => setOneOffQty('1')}
                >
                  <Text style={[styles.inlinePillText, oneOffQty === '1' && styles.pillTextActive]}>1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="one-off-qty-chip-other"
                  style={[styles.inlinePill, oneOffQty !== '1' && styles.pillActiveBlue]}
                  onPress={() => {
                    setOneOffQtyInput('');
                    setOneOffQtyPopoverOpen(true);
                  }}
                >
                  <Text style={[styles.inlinePillText, oneOffQty !== '1' && styles.pillTextActive]}>
                    {oneOffQty !== '1' ? oneOffQty : 'Other'}
                  </Text>
                </TouchableOpacity>
              </View>
              {oneOffQtyPopoverOpen && (
                <View style={styles.otherQtyPopover}>
                  <TextInput
                    style={styles.otherQtyInput}
                    value={oneOffQtyInput}
                    onChangeText={setOneOffQtyInput}
                    placeholder="e.g. 3 lbs"
                    placeholderTextColor="#9ca3af"
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      const trimmed = oneOffQtyInput.trim();
                      if (trimmed.length > 0) {
                        setOneOffQty(trimmed);
                      }
                      setOneOffQtyPopoverOpen(false);
                    }}
                  />
                </View>
              )}
            </View>
            <TouchableOpacity
              testID="edit-add-one-off"
              style={styles.createEditBtn}
              onPress={() => onEditAdd({ name: query, id: null })}
            >
              <ChevronRight size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={isEditing} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedItem?.name || query}</Text>
              <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.modalCloseBtn}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedMasterItem ? (
              <WarningCallout warnings={editWarnings} />
            ) : null}

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                ref={editQtyInputRef}
                style={styles.modalInput}
                value={editQty}
                onChangeText={setEditQty}
                placeholder="e.g. 1 gal"
              />

              {selectedItem?.alternate_qtys?.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.label}>Usual Quantities</Text>
                  <View style={styles.tagsContainer}>
                    {selectedItem.alternate_qtys.map((qtyOption: string) => (
                      <TouchableOpacity
                        key={qtyOption}
                        onPress={() => setEditQty(qtyOption)}
                        style={[styles.tag, editQty === qtyOption ? styles.tagActive : styles.tagInactive]}
                      >
                        <Text style={editQty === qtyOption ? styles.tagTextActive : styles.tagTextInactive}>
                          {qtyOption}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <Text style={styles.label}>Store</Text>
              <View style={styles.tagsContainer}>
                {metadata?.stores?.map((store) => (
                  <TouchableOpacity
                    key={store.id}
                    testID={`edit-store-${store.id}`}
                    onPress={() => setEditStoreId(store.id)}
                    style={[styles.tag, editStoreId === store.id ? styles.tagActive : styles.tagInactive]}
                  >
                    <Text style={editStoreId === store.id ? styles.tagTextActive : styles.tagTextInactive}>
                      {store.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              {selectedItem?.id ? (
                <TouchableOpacity style={[styles.actionBtn, styles.saveBtn, { flex: 1 }]} onPress={onSaveEdited}>
                  <Text style={styles.saveText}>Add to List</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={[styles.actionBtn, styles.saveBtn, { flex: 1 }]} onPress={onOneOffEditAdd}>
                    <Text style={styles.saveText}>Add to List</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn, { flex: 1 }]} onPress={onSaveEdited}>
                    <Text style={styles.cancelText}>Save & Add</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    zIndex: 50,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  dropdown: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
  },
  resultRowComplex: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  resultMainSection: {
    flex: 1,
    padding: 12,
  },
  resultHeader: {
    marginBottom: 4,
  },
  pillActiveBlue: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  inlinePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  inlineLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    width: 40,
  },
  inlinePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  inlinePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4b5563',
  },
  otherQtyPopover: {
    marginTop: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  otherQtyInput: {
    fontSize: 13,
    color: '#111827',
    height: 32,
  },
  resultEditBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderLeftWidth: 1,
    borderLeftColor: '#f3f4f6',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  createMain: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#eff6ff',
  },
  createMainButton: {
    paddingVertical: 4,
  },
  createText: {
    color: '#2563eb',
    fontWeight: '500',
  },
  createEditBtn: {
    paddingHorizontal: 16,
    height: 48,
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    borderLeftWidth: 1,
    borderLeftColor: '#bfdbfe',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
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
