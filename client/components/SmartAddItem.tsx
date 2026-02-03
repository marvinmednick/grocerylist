import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal, Keyboard } from 'react-native';
import { Search, X, ChevronRight } from 'lucide-react-native';
import { useSearchItems, useCreateMasterItem } from '@/api/items';
import { useAddToList, useDeleteListItem } from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';

export function SmartAddItem() {
  const [query, setQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Local state for dropdown selections: itemId -> { qty, storeId }
  const [selections, setSelections] = useState<Record<string, { qty: string, storeId: string }>>({});

  // Local state for the Edit Form
  const [editQty, setEditQty] = useState('');
  const [editStoreId, setEditStoreId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');

  // API Hooks
  const { data: results = [] } = useSearchItems(query);
  const { mutateAsync: addItem } = useAddToList();
  const { mutateAsync: createMasterItem } = useCreateMasterItem(); 
  const { mutateAsync: deleteItem } = useDeleteListItem();
  const { data: metadata } = useMetadata();
  const { pushAction } = useUndo();

  const getSelection = (item: any) => {
    return selections[item.id] || { 
      qty: item.default_qty || '1', 
      storeId: item.default_store_id 
    };
  };

  const toggleSelection = (itemId: string, updates: any) => {
    const item = results.find(r => r.id === itemId);
    setSelections(prev => ({
      ...prev,
      [itemId]: { ...getSelection(item), ...updates }
    }));
  };

  const handleSearch = (text: string) => {
    setQuery(text);
  };

  const clearAndClose = () => {
    setQuery('');
    setIsEditing(false);
    setSelectedItem(null);
    setSelections({});
    Keyboard.dismiss();
  };

  const onCommitAdd = async (item: any) => {
    const selection = getSelection(item);
    const name = item.name;
    
    const forwardAction = async () => {
      return await addItem({
        name: item.name,
        item_id: item.id,
        quantity: selection.qty,
        store_id: selection.storeId,
        category_id: item.default_category_id,
      });
    };

    const result = await forwardAction();

    pushAction({
      label: `Added ${name} (${selection.qty})`,
      undo: async () => {
        await deleteItem(result.id);
      },
      redo: async () => {
        await forwardAction();
      }
    });
    
    clearAndClose();
  };

  const onOneOffAdd = async () => {
    const name = query;
    const forwardAction = async () => {
      return await addItem({
        name: query,
        item_id: null,
        quantity: '1',
        store_id: metadata?.stores?.[0]?.id, 
        category_id: metadata?.categories?.find(c => c.name === 'Other')?.id,
      });
    };

    const result = await forwardAction();

    pushAction({
      label: `Added ${name}`,
      undo: async () => {
        await deleteItem(result.id);
      },
      redo: async () => {
        await forwardAction();
      }
    });

    clearAndClose();
  };

  const onEditAdd = (item: any) => {
    setSelectedItem(item);
    setEditQty(item.default_qty || '1');
    setEditStoreId(item.default_store_id || metadata?.stores?.[0]?.id);
    setEditCategoryId(item.default_category_id || metadata?.categories?.[0]?.id);
    setIsEditing(true);
  };

  const onSaveEdited = async () => {
    let itemId = selectedItem?.id;
    const itemName = selectedItem?.name || query;

    if (!itemId) {
      try {
        const newItem = await createMasterItem({
          name: itemName,
          default_qty: editQty,
          default_store_id: editStoreId,
          default_category_id: editCategoryId,
        });
        itemId = newItem.id;
      } catch (err) {
        console.error('Failed to create master item:', err);
      }
    }

    const forwardAction = async () => {
      return await addItem({
        name: itemName,
        item_id: itemId || null,
        quantity: editQty,
        store_id: editStoreId,
        category_id: editCategoryId,
      });
    };

    const result = await forwardAction();

    pushAction({
      label: `Added ${itemName}`,
      undo: async () => {
        await deleteItem(result.id);
      },
      redo: async () => {
        await forwardAction();
      }
    });

    clearAndClose();
  };


  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Search size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Add item..."
          value={query}
          onChangeText={handleSearch}
          placeholderTextColor="#9ca3af"
        />
        {query.length > 0 && (
           <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
             <X size={18} color="#6b7280" />
           </TouchableOpacity>
        )}
      </View>

      {/* Grouped Dropdown */}
      {(results.length > 0 || query.length > 1) && (
        <View style={styles.dropdown}>
          {results.length > 0 && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>BEST MATCHES</Text>
            </View>
          )}
          
          {results.map((item) => {
            const selection = getSelection(item);
            
            return (
              <View key={item.id} style={styles.resultRowComplex}>
                <View style={styles.resultMainSection}>
                  <TouchableOpacity 
                    style={styles.resultHeader}
                    onPress={() => onCommitAdd(item)}
                  >
                    <Text style={styles.resultName}>{item.name}</Text>
                  </TouchableOpacity>

                  {/* Inline Qty Pills */}
                  <View style={styles.inlinePillRow}>
                    <Text style={styles.inlineLabel}>Qty: </Text>
                    {[item.default_qty || '1', ...(item.alternate_qtys || [])].map((q: string) => {
                      const isActive = selection.qty === q;
                      return (
                        <TouchableOpacity 
                          key={q} 
                          style={[styles.inlinePill, isActive && styles.pillActiveBlue]}
                          onPress={() => toggleSelection(item.id, { qty: q })}
                        >
                          <Text style={[styles.inlinePillText, isActive && styles.pillTextActive]}>{q}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Inline Store Pills */}
                  <View style={styles.inlinePillRow}>
                    <Text style={styles.inlineLabel}>Store: </Text>
                    {Array.from(new Set([
                      item.default_store_id, 
                      ...(item.item_stores?.map((s: any) => s.store.id) || [])
                    ])).filter(Boolean).map((sid: any) => {
                      const storeName = sid === item.default_store_id 
                        ? (item.store?.name || 'Any Store')
                        : item.item_stores?.find((s: any) => s.store.id === sid)?.store.name;
                      
                      const isActive = selection.storeId === sid;
                      return (
                        <TouchableOpacity 
                          key={sid} 
                          style={[styles.inlinePill, isActive && styles.pillActiveGreen]}
                          onPress={() => toggleSelection(item.id, { storeId: sid })}
                        >
                          <Text style={[styles.inlinePillText, isActive && styles.pillTextActive]}>{storeName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.resultEditBtn}
                  onPress={() => onEditAdd(item)}
                >
                  <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            );
          })}
          
          {/* Create New / One Off */}
          <View style={styles.createRow}>
             <TouchableOpacity 
                style={styles.createMain}
                onPress={onOneOffAdd}
              >
                <Text style={styles.createText}>Add "{query}" (One-time)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={styles.createEditBtn}
                onPress={() => onEditAdd({ name: query, id: null })}
              >
                 <ChevronRight size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Inline-Edit "Form" Modal */}
      <Modal visible={isEditing} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit: {selectedItem?.name || query}
            </Text>
            
            <Text style={styles.label}>Quantity</Text>
            <TextInput 
              style={styles.modalInput}
              value={editQty}
              onChangeText={setEditQty}
              placeholder="e.g. 1 gal"
            />

            {selectedItem?.alternate_qtys?.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.label}>Usual Quantities</Text>
                <View style={styles.tagsContainer}>
                  {selectedItem.alternate_qtys.map((q: string) => (
                    <TouchableOpacity
                      key={q}
                      onPress={() => setEditQty(q)}
                      style={[
                        styles.tag,
                        editQty === q ? styles.tagActive : styles.tagInactive
                      ]}
                    >
                      <Text style={editQty === q ? styles.tagTextActive : styles.tagTextInactive}>
                        {q}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

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
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.saveBtn]}
                onPress={onSaveEdited}
              >
                <Text style={styles.saveText}>Add to List</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  pillActiveGreen: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
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
  resultSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
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
    paddingVertical: 12,
    backgroundColor: '#eff6ff',
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
    marginBottom: 16,
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
