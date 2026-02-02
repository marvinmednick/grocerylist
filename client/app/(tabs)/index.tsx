import React from 'react';
import { StyleSheet, View, Text, SectionList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { SmartAddItem } from '@/components/SmartAddItem';
import { useShoppingList, useTogglePurchased, ListItem } from '@/api/list';

export default function ShoppingListScreen() {
  const { data: listItems, isLoading } = useShoppingList();
  const { mutate: togglePurchased } = useTogglePurchased();

  // Group items by Store for SectionList
  const sections = React.useMemo(() => {
    if (!listItems) return [];
    
    const groups: Record<string, ListItem[]> = {};
    
    listItems.forEach(item => {
      const storeName = item.store?.name || 'Other';
      if (!groups[storeName]) {
        groups[storeName] = [];
      }
      groups[storeName].push(item);
    });

    return Object.entries(groups).map(([title, data]) => ({
      title,
      data,
    }));
  }, [listItems]);

  return (
    <View style={styles.container}>
      {/* Search Bar Container */}
      <View style={styles.headerContainer}>
        <SmartAddItem />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      ) : (
        <SectionList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.itemRow}
              activeOpacity={0.7}
              onPress={() => togglePurchased({ id: item.id, is_purchased: !item.is_purchased })}
            >
              {/* Col 1: Checkbox */}
              <View style={styles.colCheckbox}>
                {item.is_purchased ? (
                  <CheckCircle2 size={24} color="#10b981" />
                ) : (
                  <Circle size={24} color="#d1d5db" />
                )}
              </View>

              {/* Col 2: Name */}
              <View style={styles.colName}>
                 <Text 
                    style={[styles.nameText, item.is_purchased && styles.strikethrough]} 
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
              </View>

              {/* Col 3: Quantity */}
              {item.quantity ? (
                 <View style={styles.colQty}>
                   <Text style={styles.qtyText}>{item.quantity}</Text>
                 </View>
              ) : <View style={styles.colQty} />}

               {/* Col 4: Category */}
               <View style={styles.colCategory}>
                 <Text style={styles.categoryText} numberOfLines={1}>
                    {item.category?.name || '—'}
                 </Text>
               </View>
            </TouchableOpacity>
          )}
          stickySectionHeadersEnabled={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Your list is empty.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    zIndex: 10,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row', // CRITICAL
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    backgroundColor: '#ffffff',
    width: '100%',
  },
  colCheckbox: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
  },
  colName: {
    flex: 1, // Takes up remaining space
    marginRight: 8,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  colQty: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  colCategory: {
    width: 80,
    alignItems: 'flex-end',
  },
  categoryText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
});