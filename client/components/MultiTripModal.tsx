import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Circle, X } from 'lucide-react-native';
import type { AppColors } from '@/constants/Colors';
import { useThemeColors } from '@/lib/theme';

export interface TripUser {
  userId: string;
  displayName: string;
  displayNameShort: string | null;
  color: string;
  itemCount: number;
}

interface MultiTripModalProps {
  visible: boolean;
  storeName: string;
  users: TripUser[];
  onConfirm: (selectedUserIds: string[]) => void;
  onCancel: () => void;
}

const getInitials = (user: TripUser): string => {
  if (user.displayNameShort) {
    return user.displayNameShort.slice(0, 2).toUpperCase();
  }

  const fallbackName = user.displayName.split('@')[0] || user.displayName;
  return fallbackName.slice(0, 2).toUpperCase();
};

export const MultiTripModal: React.FC<MultiTripModalProps> = ({
  visible,
  storeName,
  users,
  onConfirm,
  onCancel,
}) => {
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setSelectedUserIds(new Set(users.map((user) => user.userId)));
    }
  }, [visible, users]);

  const selectedCount = selectedUserIds.size;
  const selectedIds = useMemo(() => Array.from(selectedUserIds), [selectedUserIds]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  return (
    <Modal animationType="slide" transparent={false} visible={visible}>
      <SafeAreaView style={styles.container} testID="multi-trip-modal">
        <View style={styles.header}>
          <Text style={styles.title}>End Trips at {storeName}</Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={users}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => {
            const isSelected = selectedUserIds.has(item.userId);
            return (
              <Pressable
                testID={`multi-trip-user-row-${item.userId}`}
                onPress={() => toggleUser(item.userId)}
                style={styles.userRow}
              >
                <View testID={`multi-trip-initials-${item.userId}`} style={[styles.initialsBadge, { backgroundColor: item.color }]}>
                  <Text style={styles.initialsText}>{getInitials(item)}</Text>
                </View>

                <View style={styles.userContent}>
                  <Text style={styles.userName}>{item.displayName}</Text>
                  <Text style={styles.itemCount}>({item.itemCount} items)</Text>
                </View>

                <View testID={`multi-trip-checkbox-${item.userId}`}>
                  {isSelected ? <CheckCircle2 size={24} color={colors.primary} /> : <Circle size={24} color={colors.inputBorder} />}
                </View>
              </Pressable>
            );
          }}
        />

        <View style={styles.footer}>
          <TouchableOpacity testID="multi-trip-cancel" onPress={onCancel} style={[styles.button, styles.cancelButton]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="multi-trip-confirm"
            onPress={() => onConfirm(selectedIds)}
            style={[styles.button, styles.confirmButton, selectedCount === 0 && styles.confirmButtonDisabled]}
            disabled={selectedCount === 0}
          >
            <Text style={styles.confirmText}>End Selected Trips</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  initialsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  initialsText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: '700',
  },
  userContent: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemCount: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.buttonSecondary,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.buttonSecondaryText,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
});
