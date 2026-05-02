import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VocabularyType } from '@/api/vocabulary';
import { VocabularyManagement } from '@/components/VocabularyManagement';
import type { AppColors } from '@/constants/Colors';
import { useThemeColors } from '@/lib/theme';

interface SizesAndPackagesProps {
  visible: boolean;
  onClose: () => void;
}

export function SizesAndPackages({ visible, onClose }: SizesAndPackagesProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
              <X size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.menuContent}>
            <TouchableOpacity
              testID="vocab-nav-units"
              style={styles.navRow}
              onPress={() => setActiveScreen('units')}
            >
              <Text style={styles.navRowText}>Units</Text>
              <ChevronRight size={18} color={colors.textDisabled} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="vocab-nav-packages"
              style={styles.navRow}
              onPress={() => setActiveScreen('packages')}
            >
              <Text style={styles.navRowText}>Packages</Text>
              <ChevronRight size={18} color={colors.textDisabled} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="vocab-nav-sizes"
              style={styles.navRow}
              onPress={() => setActiveScreen('size_descriptors')}
            >
              <Text style={styles.navRowText}>Sizes</Text>
              <ChevronRight size={18} color={colors.textDisabled} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  menuContent: {
    paddingBottom: 24,
  },
  navRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
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
    color: colors.textPrimary,
  },
});
