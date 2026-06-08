import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useCreateVocabularyEntry,
  useDeleteVocabularyEntry,
  useResetVocabularyToDefaults,
  useUpdateVocabularyEntry,
  useVocabulary,
  type VocabRow,
  type VocabularyType,
} from '@/api/vocabulary';
import type { AppColors } from '@/constants/Colors';
import { useThemeColors } from '@/lib/theme';

interface VocabularyManagementProps {
  type: VocabularyType;
  onBack: () => void;
  onClose: () => void;
}

const SCREEN_TITLES: Record<VocabularyType, string> = {
  units: 'Units',
  packages: 'Packages',
  size_descriptors: 'Sizes',
};

export function VocabularyManagement({ type, onBack, onClose }: VocabularyManagementProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: vocabulary, isLoading } = useVocabulary();
  const createEntry = useCreateVocabularyEntry(type);
  const updateEntry = useUpdateVocabularyEntry(type);
  const deleteEntry = useDeleteVocabularyEntry(type);
  const resetToDefaults = useResetVocabularyToDefaults(type);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VocabRow | null>(null);
  const [canonicalInput, setCanonicalInput] = useState('');
  const [pluralInput, setPluralInput] = useState('');
  const [pluralEditedManually, setPluralEditedManually] = useState(false);
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAliasInput, setNewAliasInput] = useState('');
  const [showNewAliasInput, setShowNewAliasInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const entries = useMemo(() => {
    if (!vocabulary) return [];
    return (vocabulary[type === 'size_descriptors' ? 'sizeDescriptors' : type] ?? []) as VocabRow[];
  }, [type, vocabulary]);

  const title = SCREEN_TITLES[type];

  const openAddDialog = () => {
    setEditingEntry(null);
    setCanonicalInput('');
    setPluralInput('');
    setPluralEditedManually(false);
    setAliases([]);
    setNewAliasInput('');
    setShowNewAliasInput(false);
    setShowDeleteConfirm(false);
    setDialogVisible(true);
  };

  const openEditDialog = (entry: VocabRow) => {
    setEditingEntry(entry);
    setCanonicalInput(entry.canonical);
    setPluralInput(entry.plural ?? '');
    setPluralEditedManually(false);
    setAliases([...entry.aliases]);
    setNewAliasInput('');
    setShowNewAliasInput(false);
    setShowDeleteConfirm(false);
    setDialogVisible(true);
  };

  const closeDialog = () => {
    setDialogVisible(false);
    setEditingEntry(null);
    setCanonicalInput('');
    setPluralInput('');
    setPluralEditedManually(false);
    setAliases([]);
    setNewAliasInput('');
    setShowNewAliasInput(false);
    setShowDeleteConfirm(false);
  };

  const commitAlias = () => {
    const trimmed = newAliasInput.trim();
    if (trimmed.length > 0) {
      setAliases((prev) => [...prev, trimmed]);
    }
    setNewAliasInput('');
    setShowNewAliasInput(false);
  };

  const handleCanonicalChange = (value: string) => {
    setCanonicalInput(value);
    if (type === 'packages' && !pluralEditedManually) {
      const trimmed = value.trim();
      setPluralInput(trimmed ? `${trimmed}s` : '');
    }
  };

  const handlePluralChange = (value: string) => {
    setPluralEditedManually(true);
    setPluralInput(value);
  };

  const handleSave = async () => {
    const canonical = canonicalInput.trim();
    const plural = pluralInput.trim();
    if (!canonical) return;
    if (type === 'packages' && !plural) return;

    if (editingEntry) {
      await updateEntry.mutateAsync({
        id: editingEntry.id,
        canonical,
        aliases,
        ...(type === 'packages' ? { plural } : {}),
      });
    } else {
      await createEntry.mutateAsync({
        canonical,
        aliases,
        ...(type === 'packages' ? { plural } : {}),
      });
    }

    closeDialog();
  };

  const handleDelete = async () => {
    if (!editingEntry) return;
    await deleteEntry.mutateAsync(editingEntry.id);
    closeDialog();
  };

  const saveDisabled =
    canonicalInput.trim().length === 0 ||
    (type === 'packages' && pluralInput.trim().length === 0) ||
    createEntry.isPending ||
    updateEntry.isPending;

  return (
    <View style={[styles.container, { paddingTop: insets.top || 20, paddingBottom: insets.bottom || 16 }]}> 
      <View style={styles.header}>
        <TouchableOpacity testID="vocabulary-back" style={styles.iconButton} onPress={onBack}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity testID="vocabulary-close" style={styles.iconButton} onPress={onClose}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.entryRow} onPress={() => openEditDialog(item)}>
              <Text style={styles.entryCanonical}>{item.canonical}</Text>
              {item.aliases.length > 0 ? (
                <Text style={styles.entryAliases}>{item.aliases.join(', ')}</Text>
              ) : (
                <Text style={styles.entryAliasesEmpty}>No aliases</Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No entries yet.</Text>}
        />
      )}

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={openAddDialog}>
          <Text style={styles.primaryButtonText}>+ Add Entry</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetButton} onPress={() => setShowResetConfirm(true)}>
          <Text style={styles.resetButtonText}>Reset to Defaults</Text>
        </TouchableOpacity>

        {showResetConfirm ? (
          <View style={styles.confirmContainer}>
            <Text style={styles.confirmText}>
              Reset {title} to defaults? This will remove any custom entries and restore the standard list.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelButton} onPress={() => setShowResetConfirm(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={async () => {
                  await resetToDefaults.mutateAsync();
                  setShowResetConfirm(false);
                }}
              >
                <Text style={styles.confirmDeleteText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      <Modal visible={dialogVisible} animationType="fade" transparent={true} onRequestClose={closeDialog}>
        <Pressable style={styles.dialogBackdrop} onPress={closeDialog}>
          <Pressable style={styles.dialogCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.dialogHeader}>
              {editingEntry ? (
                <TouchableOpacity
                  testID="vocabulary-delete-trigger"
                  style={styles.deletePill}
                  onPress={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={16} color={colors.destructiveText} />
                </TouchableOpacity>
              ) : (
                <View style={styles.deletePillSpacer} />
              )}
              <Text style={styles.dialogTitle}>{editingEntry ? 'Edit Entry' : 'Add Entry'}</Text>
              <TouchableOpacity style={styles.iconButton} onPress={closeDialog}>
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Canonical</Text>
            <TextInput
              testID="vocabulary-canonical-input"
              style={styles.textInput}
              value={canonicalInput}
              onChangeText={handleCanonicalChange}
              placeholder="e.g. bottle"
              autoCapitalize="none"
            />

            {type === 'packages' ? (
              <>
                <Text style={styles.inputLabel}>Plural form</Text>
                <TextInput
                  testID="vocabulary-plural-input"
                  style={styles.textInput}
                  value={pluralInput}
                  onChangeText={handlePluralChange}
                  placeholder="e.g. cans"
                  autoCapitalize="none"
                />
              </>
            ) : null}

            <Text style={styles.inputLabel}>Aliases</Text>
            <View style={styles.aliasChipsWrap}>
              {aliases.map((alias, index) => (
                <View key={`${alias}-${index}`} style={styles.aliasChip}>
                  <Text style={styles.aliasChipText}>{alias}</Text>
                  <TouchableOpacity
                    testID={`alias-remove-${index}`}
                    onPress={() => setAliases((prev) => prev.filter((_, chipIndex) => chipIndex !== index))}
                  >
                    <Text style={styles.aliasChipRemove}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.aliasAddButton} onPress={() => setShowNewAliasInput(true)}>
                <Text style={styles.aliasAddText}>+ Add alias</Text>
              </TouchableOpacity>
            </View>

            {showNewAliasInput ? (
              <TextInput
                testID="vocabulary-new-alias-input"
                style={styles.textInput}
                value={newAliasInput}
                onChangeText={setNewAliasInput}
                placeholder="Alias"
                autoFocus
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={commitAlias}
                onBlur={commitAlias}
              />
            ) : null}

            {showDeleteConfirm ? (
              <View style={styles.confirmContainer}>
                <Text style={styles.confirmText}>
                  Delete {editingEntry?.canonical ?? canonicalInput}? This cannot be undone.
                </Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity style={styles.confirmCancelButton} onPress={() => setShowDeleteConfirm(false)}>
                    <Text style={styles.confirmCancelText}>Cancel delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmDeleteButton} onPress={handleDelete}>
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogCancelButton} onPress={closeDialog}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogSaveButton, saveDisabled && styles.dialogSaveButtonDisabled]}
                onPress={handleSave}
                disabled={saveDisabled}
                testID="vocabulary-save-button"
              >
                <Text style={styles.dialogSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
    marginBottom: 12,
  },
  iconButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  entryRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  entryCanonical: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  entryAliases: {
    fontSize: 13,
    color: colors.textDisabled,
  },
  entryAliasesEmpty: {
    fontSize: 13,
    color: colors.textDisabled,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textDisabled,
    fontSize: 14,
    marginTop: 24,
  },
  actionsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  resetButton: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  resetButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  confirmContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.destructiveSurface,
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  confirmText: {
    color: colors.destructiveText,
    fontSize: 13,
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmCancelButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  confirmCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmDeleteButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#dc2626',
  },
  confirmDeleteText: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  deletePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.destructiveSurface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deletePillSpacer: {
    width: 46,
    height: 34,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDisabled,
    textTransform: 'uppercase',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  aliasChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aliasChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceRaised,
  },
  aliasChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  aliasChipRemove: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  aliasAddButton: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
  },
  aliasAddText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  dialogCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  dialogCancelText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  dialogSaveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  dialogSaveButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  dialogSaveText: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
});
