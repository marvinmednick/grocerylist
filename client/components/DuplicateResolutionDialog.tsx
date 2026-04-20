import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ListItem } from '@/api/list';
import type { CombineOption } from '@/lib/quantityFormat';
import type { DuplicateState } from '@/lib/duplicateDetection';

interface DuplicateResolutionDialogProps {
  match: ListItem | null;
  incomingName: string;
  incomingQuantity: string;
  incomingStoreId: string | null;
  combineOptions: CombineOption[] | null;
  duplicateState: DuplicateState;
  storeName?: string;
  incomingStoreName?: string;
  onCombine: (option: CombineOption, targetStoreId?: string) => void;
  onAddNew: () => void;
  onCustom: (customQty: string) => void;
  onDismiss: () => void;
}

export function DuplicateResolutionDialog({
  match,
  incomingQuantity,
  incomingStoreId,
  combineOptions,
  duplicateState,
  storeName,
  incomingStoreName,
  onCombine,
  onAddNew,
  onCustom,
  onDismiss,
}: DuplicateResolutionDialogProps) {
  const insets = useSafeAreaInsets();
  const [customMode, setCustomMode] = useState(false);
  const [customQty, setCustomQty] = useState('');

  const isVisible = !!match;
  const targetEntry = useMemo(() => {
    if (!match) {
      return null;
    }
    return (
      match.quantities.find((entry) => !entry.archived_at && !entry.is_purchased) ??
      match.quantities.find((entry) => !entry.archived_at) ??
      null
    );
  }, [match]);
  const existingStoreName = storeName ?? targetEntry?.store?.name ?? 'this store';
  const existingQty = targetEntry?.quantity ?? incomingQuantity;

  const showCombine = !customMode && !!combineOptions && combineOptions.length > 0 && duplicateState.startsWith('active-');

  const handleDismiss = () => {
    setCustomMode(false);
    setCustomQty('');
    onDismiss();
  };

  const handleCustomConfirm = () => {
    const trimmed = customQty.trim();
    if (!trimmed) {
      return;
    }
    setCustomMode(false);
    setCustomQty('');
    onCustom(trimmed);
  };

  const summaryText = (() => {
    if (duplicateState === 'purchased-other-user') {
      return `Another shopper already purchased ${existingQty}`;
    }
    if (duplicateState === 'purchased-same-trip') {
      return `You already purchased ${existingQty}`;
    }
    return `You already have ${existingQty} at ${existingStoreName}`;
  })();

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleDismiss}>
          <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
            <View style={styles.titleBar}>
              <Text style={styles.titleText}>Duplicate Item</Text>
              <TouchableOpacity testID="duplicate-dialog-close" onPress={handleDismiss}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.content, { paddingBottom: 16 + insets.bottom, paddingTop: insets.top }]}
            >
              <Text style={styles.summary}>{summaryText}</Text>

              {showCombine ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Combine as:</Text>
                  {duplicateState === 'active-different-store' ? (
                    <View style={styles.crossStoreActions}>
                      {combineOptions.map((option, index) => (
                        <View key={`${option.type}-${index}`} style={styles.crossStoreRow}>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => onCombine(option, match?.store_id ?? null)}
                          >
                            <Text style={styles.actionButtonText}>{`${option.label} at ${existingStoreName}`}</Text>
                          </TouchableOpacity>
                          {incomingStoreId ? (
                            <TouchableOpacity
                              style={styles.actionButton}
                              onPress={() => onCombine(option, incomingStoreId)}
                            >
                              <Text style={styles.actionButtonText}>
                                {`${option.label} at ${incomingStoreName ?? 'target store'}`}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.combineRow}>
                      {combineOptions.map((option, index) => (
                        <TouchableOpacity
                          key={`${option.type}-${index}`}
                          style={styles.actionButton}
                          onPress={() => onCombine(option)}
                        >
                          <Text style={styles.actionButtonText}>{option.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}

              {customMode ? (
                <View style={styles.section}>
                  <TextInput
                    testID="duplicate-custom-input"
                    style={styles.customInput}
                    value={customQty}
                    onChangeText={setCustomQty}
                    autoFocus
                    placeholder="e.g. 3 lbs"
                    placeholderTextColor="#9ca3af"
                  />
                  <View style={styles.customActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleCustomConfirm}>
                      <Text style={styles.actionButtonText}>Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCustomMode(false)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.bottomRow}>
                  <TouchableOpacity testID="duplicate-add-new" style={styles.actionButton} onPress={onAddNew}>
                    <Text style={styles.actionButtonText}>Add New</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="duplicate-custom" style={styles.actionButton} onPress={() => setCustomMode(true)}>
                    <Text style={styles.actionButtonText}>Custom</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="duplicate-cancel" onPress={handleDismiss}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
  },
  titleBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    paddingHorizontal: 20,
  },
  summary: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  combineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  crossStoreActions: {
    gap: 8,
  },
  crossStoreRow: {
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 16,
    color: '#111827',
  },
  customActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
