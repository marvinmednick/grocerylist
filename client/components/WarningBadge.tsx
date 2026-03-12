import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, HelpCircle, Info, XCircle } from 'lucide-react-native';

export interface Warning {
  type: 'avoided' | 'unavailable' | 'non_preferred' | 'non_standard_qty';
  store_id?: string;
  store_name?: string;
  comment?: string | null;
  preferred_stores?: string[];
  entered?: string;
  standard?: string[];
}

interface WarningBadgeProps {
  warnings?: Warning[];
}

const getWarningText = (warning: Warning): string => {
  if (warning.type === 'avoided') {
    const storeName = warning.store_name || warning.store_id || 'a store';
    if (warning.comment) {
      return `Avoided at ${storeName} — ${warning.comment}`;
    }
    return `Avoided at ${storeName}`;
  }

  if (warning.type === 'unavailable') {
    const storeName = warning.store_name || warning.store_id || 'a store';
    return `Unavailable at ${storeName}`;
  }

  if (warning.type === 'non_preferred') {
    const stores = warning.preferred_stores?.join(', ') || 'none';
    return `Preferred at: ${stores}`;
  }

  const entered = warning.entered || 'unknown';
  const standard = warning.standard?.join(', ') || 'none';
  return `Qty ${entered} is non-standard (usual: ${standard})`;
};

export const WarningBadge: React.FC<WarningBadgeProps> = ({ warnings }) => {
  const [isOpen, setIsOpen] = useState(false);

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

      {isOpen ? (
        <>
          <Pressable style={styles.overlay} onPress={() => setIsOpen(false)} testID="warning-popover-overlay" />
          <View style={styles.popover}>
            {warningDetails.map((detail, index) => (
              <Text key={`${detail.warning.type}-${index}`} style={styles.popoverText}>
                {detail.text}
              </Text>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginRight: 8,
    position: 'relative',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overlay: {
    position: 'absolute',
    top: -300,
    right: -300,
    bottom: -300,
    left: -300,
    zIndex: 999,
  },
  popover: {
    position: 'absolute',
    right: 0,
    top: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 200,
    maxWidth: 280,
    zIndex: 1000,
  },
  popoverText: {
    color: '#111827',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
});
