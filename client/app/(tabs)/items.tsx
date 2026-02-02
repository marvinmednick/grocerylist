import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Search, Tag, Store } from 'lucide-react-native';
import { useAllItems } from '@/api/items';

export default function ItemsScreen() {
  const [search, setSearch] = useState('');
  const { data: items, isLoading } = useAllItems(search);

  return (
    <View className="flex-1 bg-white">
      {/* Header / Search */}
      <View className="px-4 py-4 border-b border-gray-100 bg-white">
        <Text className="text-2xl font-bold mb-4">Master Database</Text>
        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 h-12">
          <Search size={20} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-900"
            placeholder="Search your library..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View className="h-4" />}
          ListEmptyComponent={
            <View className="mt-10 items-center">
              <Text className="text-gray-400">No items found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity className="flex-row items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-900">{item.name}</Text>
                <View className="flex-row mt-2 space-x-4">
                  <View className="flex-row items-center bg-white px-2 py-1 rounded-md border border-gray-200">
                    <Tag size={12} color="#6b7280" />
                    <Text className="text-xs text-gray-600 ml-1">
                      {item.category?.name || 'Uncategorized'}
                    </Text>
                  </View>
                  
                  <View className="flex-row items-center bg-white px-2 py-1 rounded-md border border-gray-200 ml-2">
                    <Store size={12} color="#6b7280" />
                    <Text className="text-xs text-gray-600 ml-1">
                      {item.store?.name || 'Any Store'}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}