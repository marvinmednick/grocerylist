import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal, Keyboard } from 'react-native';
import { Search, X, ChevronRight } from 'lucide-react-native';
import { useSearchItems } from '@/api/items';
import { useAddToList } from '@/api/list';
import { useMetadata } from '@/api/metadata';

export function SmartAddItem() {
  const [query, setQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Local state for the Edit Form
  const [editQty, setEditQty] = useState('');
  const [editStoreId, setEditStoreId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');

  // API Hooks
  const { data: results = [] } = useSearchItems(query);
  const { mutate: addItem } = useAddToList();
  const { data: metadata } = useMetadata();

  const handleSearch = (text: string) => {
    setQuery(text);
  };

  const clearAndClose = () => {
    setQuery('');
    setIsEditing(false);
    setSelectedItem(null);
    Keyboard.dismiss();
  };

  const onQuickAdd = (item: any) => {
    addItem({
      name: item.name,
      item_id: item.id,
      quantity: item.default_qty || '1',
      store_id: item.default_store_id,
      category_id: item.default_category_id,
    });
    clearAndClose();
  };

  const onOneOffAdd = () => {
    addItem({
      name: query,
      item_id: null,
      quantity: '1',
      // Default to first store/category or "Other" if undefined for now
      store_id: metadata?.stores?.[0]?.id, 
      category_id: metadata?.categories?.find(c => c.name === 'Other')?.id,
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

  const onSaveEdited = () => {
    addItem({
      name: selectedItem ? selectedItem.name : query,
      item_id: selectedItem ? selectedItem.id : null,
      quantity: editQty,
      store_id: editStoreId,
      category_id: editCategoryId,
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
          
          {results.map((item) => (
            <View key={item.id} style={styles.resultRow}>
              <TouchableOpacity 
                style={styles.resultMain}
                onPress={() => onQuickAdd(item)}
              >
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultSubtext}>
                  {item.default_qty || '1'} • {item.store?.name || 'Any Store'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.resultEditBtn}
                onPress={() => onEditAdd(item)}
              >
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          ))}
          
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
    flexDirection: 'row', // CRITICAL
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
    top: 56, // Height + margin
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
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  resultMain: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  resultSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  resultEditBtn: {
    paddingHorizontal: 16,
    height: '100%',
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
    height: '100%',
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