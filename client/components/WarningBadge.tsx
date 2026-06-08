import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle, HelpCircle, Info, X, XCircle } from 'lucide-react-native';
import { getWarningText, type Warning } from '@/api/items';
import type { AppColors } from '@/constants/Colors';
import { useThemeColors } from '@/lib/theme';

interface WarningBadgeProps {
  warnings?: Warning[];
}

export const WarningBadge: React.FC<WarningBadgeProps> = ({ warnings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const warningDetails = useMemo(() => {
    return (warnings ?? []).map((warning) => ({
      warning,
      text: getWarningText(warning),
    }));
  }, [warnings]);

  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        style={styles.iconRow}
        testID="warning-badge-trigger"
      >
        {warnings.map((warning, index) => {
          if (warning.type === 'avoided') {
            return (
              <View key={`${warning.type}-${index}`} testID="warning-icon-avoided">
                <AlertTriangle size={14} color="#f59e0b" />
              </View>
            );
          }

          if (warning.type === 'unavailable') {
            return (
              <View key={`${warning.type}-${index}`} testID="warning-icon-unavailable">
                <XCircle size={14} color="#ef4444" />
              </View>
            );
          }

          if (warning.type === 'non_preferred') {
            return (
              <View key={`${warning.type}-${index}`} testID="warning-icon-non_preferred">
                <Info size={14} color="#6b7280" />
              </View>
            );
          }

          return (
            <View key={`${warning.type}-${index}`} testID="warning-icon-non_standard_qty">
              <HelpCircle size={14} color="#6b7280" />
            </View>
          );
        })}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsOpen(false)}
          testID="warning-modal-backdrop"
        >
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalCardHeader}>
              <Text style={styles.modalCardTitle}>Warnings</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)} testID="warning-modal-close">
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {warningDetails.map((detail, index) => (
              <View key={`${detail.warning.type}-${index}`} style={styles.modalRow}>
                {detail.warning.type === 'avoided' ? (
                  <AlertTriangle size={14} color="#f59e0b" />
                ) : null}
                {detail.warning.type === 'unavailable' ? (
                  <XCircle size={14} color="#ef4444" />
                ) : null}
                {detail.warning.type === 'non_preferred' ? (
                  <Info size={14} color="#6b7280" />
                ) : null}
                {detail.warning.type !== 'avoided' &&
                detail.warning.type !== 'unavailable' &&
                detail.warning.type !== 'non_preferred' ? (
                  <HelpCircle size={14} color="#6b7280" />
                ) : null}
                <Text style={styles.modalRowText}>{detail.text}</Text>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const makeStyles = (colors: AppColors) => StyleSheet.create({
  wrapper: {
    marginRight: 8,
    position: 'relative',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 320,
  },
  modalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  modalRowText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
