import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VocabularyType } from '@/api/vocabulary';
import { VocabularyManagement } from '@/components/VocabularyManagement';

interface SizesAndPackagesProps {
  visible: boolean;
  onClose: () => void;
}

export function SizesAndPackages({ visible, onClose }: SizesAndPackagesProps) {
  const insets = useSafeAreaInsets();
  const [activeScreen, setActiveScreen] = useState<VocabularyType | null>(null);

  useEffect(() => {
    if (!visible) {
      setActiveScreen(null);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {activeScreen ? (
        <VocabularyManagement
          type={activeScreen}
          onBack={() => setActiveScreen(null)}
          onClose={onClose}
        />
      ) : (
        <View style={[styles.container, { paddingTop: insets.top || 20 }]}> 
          <View style={styles.header}>
            <Text style={styles.title}>Sizes & Packages</Text>
            <TouchableOpacity testID="sizes-packages-close" onPress={onClose} style={styles.closeButton}>
              <X size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.menuContent}>
            <TouchableOpacity
              testID="vocab-nav-units"
              style={styles.navRow}
              onPress={() => setActiveScreen('units')}
            >
              <Text style={styles.navRowText}>Units</Text>
              <ChevronRight size={18} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity
              testID="vocab-nav-packages"
              style={styles.navRow}
              onPress={() => setActiveScreen('packages')}
            >
              <Text style={styles.navRowText}>Packages</Text>
              <ChevronRight size={18} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity
              testID="vocab-nav-sizes"
              style={styles.navRow}
              onPress={() => setActiveScreen('size_descriptors')}
            >
              <Text style={styles.navRowText}>Sizes</Text>
              <ChevronRight size={18} color="#9ca3af" />
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
  },
  menuContent: {
    paddingBottom: 24,
  },
  navRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navRowText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
