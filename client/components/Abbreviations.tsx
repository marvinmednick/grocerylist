import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAbbreviationSuggestions,
  useCreateWordAlias,
  useDeleteWordAlias,
  useWordAliases,
} from '@/api/aliases';
import { useMasterItemNames } from '@/api/items';
import { useVocabulary } from '@/api/vocabulary';
import { DEFAULT_VOCABULARY } from '@/lib/vocabulary';
import type { AppColors } from '@/constants/Colors';
import { useThemeColors } from '@/lib/theme';

type ViewMode = 'canonical' | 'alias';

interface AbbreviationsProps {
  visible: boolean;
  onClose: () => void;
  initialSearch?: string;
}

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9-]/g, '').trim())
    .filter((token) => token.length > 0);
}

function normalizeList(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.toLowerCase().trim())
        .filter((value) => value.length > 0)
    )
  );
}

export function Abbreviations({ visible, onClose, initialSearch }: AbbreviationsProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: wordAliasMap = new Map<string, string>() } = useWordAliases();
  const { data: suggestionsMap = new Map<string, string[]>() } = useAbbreviationSuggestions();
  const { data: itemNames = [] } = useMasterItemNames();
  const { data: vocabulary } = useVocabulary();
  const createWordAlias = useCreateWordAlias();
  const deleteWordAlias = useDeleteWordAlias();

  const [viewMode, setViewMode] = useState<ViewMode>('canonical');
  const [canonicalSearch, setCanonicalSearch] = useState(initialSearch ?? '');
  const [aliasSearch, setAliasSearch] = useState('');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogCanonical, setDialogCanonical] = useState('');
  const [dialogCanonicalEditable, setDialogCanonicalEditable] = useState(false);
  const [dialogAliases, setDialogAliases] = useState<string[]>([]);
  const [dialogNewAliasInput, setDialogNewAliasInput] = useState('');
  const [dialogExistingId, setDialogExistingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [aliasInputError, setAliasInputError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setViewMode('canonical');
      setCanonicalSearch(initialSearch ?? '');
      setAliasSearch('');
      setDialogVisible(false);
      setShowDeleteConfirm(false);
    }
  }, [initialSearch, visible]);

  const canonicalRows = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const [alias, canonical] of wordAliasMap.entries()) {
      const canonicalWord = canonical.toLowerCase().trim();
      const aliasWord = alias.toLowerCase().trim();
      if (!canonicalWord || !aliasWord) continue;
      const existing = grouped.get(canonicalWord) ?? [];
      grouped.set(canonicalWord, [...existing, aliasWord]);
    }

    return Array.from(grouped.entries())
      .map(([canonical, aliases]) => ({
        canonical,
        aliases: Array.from(new Set(aliases)).sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.canonical.localeCompare(b.canonical));
  }, [wordAliasMap]);

  const aliasRows = useMemo(() => {
    return Array.from(wordAliasMap.entries())
      .map(([alias, canonical]) => ({
        alias: alias.toLowerCase().trim(),
        canonical: canonical.toLowerCase().trim(),
      }))
      .sort((a, b) => a.alias.localeCompare(b.alias));
  }, [wordAliasMap]);

  const itemWordSet = useMemo(() => {
    const words = new Set<string>();
    itemNames.forEach((item) => {
      tokenize(item.name).forEach((word) => words.add(word));
      (item.aliases ?? []).forEach((alias) => {
        tokenize(alias).forEach((word) => words.add(word));
      });
    });
    return words;
  }, [itemNames]);

  const aliasItemCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    itemNames.forEach((item) => {
      const words = new Set<string>([
        ...tokenize(item.name),
        ...(item.aliases ?? []).flatMap((alias) => tokenize(alias)),
      ]);
      words.forEach((word) => {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      });
    });
    return counts;
  }, [itemNames]);

  const vocabularyWordSet = useMemo(() => {
    const source = vocabulary ?? DEFAULT_VOCABULARY;
    const words = new Set<string>();
    source.units.forEach((entry) => {
      words.add(entry.canonical.toLowerCase());
      entry.aliases.forEach((alias) => words.add(alias.toLowerCase()));
    });
    source.packages.forEach((entry) => {
      words.add(entry.canonical.toLowerCase());
      words.add((entry.plural ?? `${entry.canonical}s`).toLowerCase());
      entry.aliases.forEach((alias) => words.add(alias.toLowerCase()));
    });
    source.sizeDescriptors.forEach((entry) => {
      words.add(entry.canonical.toLowerCase());
      entry.aliases.forEach((alias) => words.add(alias.toLowerCase()));
    });
    return words;
  }, [vocabulary]);

  const openDialog = ({
    canonical,
    canonicalEditable,
    aliases,
    existingId,
  }: {
    canonical: string;
    canonicalEditable: boolean;
    aliases: string[];
    existingId: string | null;
  }) => {
    setDialogCanonical(canonical.toLowerCase().trim());
    setDialogCanonicalEditable(canonicalEditable);
    setDialogAliases(normalizeList(aliases));
    setDialogNewAliasInput('');
    setDialogExistingId(existingId);
    setShowDeleteConfirm(false);
    setAliasInputError(null);
    setDialogVisible(true);
  };

  const closeDialog = () => {
    setDialogVisible(false);
    setDialogCanonical('');
    setDialogCanonicalEditable(false);
    setDialogAliases([]);
    setDialogNewAliasInput('');
    setDialogExistingId(null);
    setShowDeleteConfirm(false);
    setAliasInputError(null);
  };

  const currentSearch = viewMode === 'canonical' ? canonicalSearch : aliasSearch;
  const searchTerms = normalizeList(currentSearch.split(/\s+/));

  const prefixMatchesAny = (term: string, words: string[]) =>
    words.some((word) => word.startsWith(term));

  const filteredCanonicalRows = useMemo(() => {
    if (searchTerms.length === 0) {
      return canonicalRows;
    }
    return canonicalRows.filter((row) => {
      const words = [row.canonical, ...row.aliases];
      return searchTerms.some((term) => prefixMatchesAny(term, words));
    });
  }, [canonicalRows, searchTerms]);

  const filteredAliasRows = useMemo(() => {
    if (searchTerms.length === 0) {
      return aliasRows;
    }
    return aliasRows.filter((row) => {
      const words = [row.alias, row.canonical];
      return searchTerms.some((term) => prefixMatchesAny(term, words));
    });
  }, [aliasRows, searchTerms]);

  const unmatchedTerms = useMemo(() => {
    if (searchTerms.length === 0) return [];
    return searchTerms.filter((term) => {
      if (viewMode === 'canonical') {
        return !canonicalRows.some((row) => prefixMatchesAny(term, [row.canonical, ...row.aliases]));
      }
      return !aliasRows.some((row) => prefixMatchesAny(term, [row.alias, row.canonical]));
    });
  }, [aliasRows, canonicalRows, searchTerms, viewMode]);

  const canonicalNormalized = dialogCanonical.toLowerCase().trim();
  const existingAliasesForCanonical = useMemo(
    () =>
      Array.from(wordAliasMap.entries())
        .filter(([, canonical]) => canonical.toLowerCase().trim() === canonicalNormalized)
        .map(([alias]) => alias.toLowerCase().trim()),
    [canonicalNormalized, wordAliasMap]
  );

  const duplicateAliasConflicts = useMemo(() => {
    return dialogAliases.filter((alias) => {
      const existingCanonical = wordAliasMap.get(alias);
      return Boolean(existingCanonical && existingCanonical !== canonicalNormalized);
    });
  }, [canonicalNormalized, dialogAliases, wordAliasMap]);

  const vocabConflicts = useMemo(
    () => dialogAliases.filter((alias) => vocabularyWordSet.has(alias)),
    [dialogAliases, vocabularyWordSet]
  );

  const itemNameConflicts = useMemo(
    () => dialogAliases.map((alias) => ({ alias, count: aliasItemCountMap.get(alias) ?? 0 })).filter((entry) => entry.count > 0),
    [aliasItemCountMap, dialogAliases]
  );

  const canonicalUnknown = canonicalNormalized.length > 0 && !itemWordSet.has(canonicalNormalized);
  const saveDisabled =
    canonicalNormalized.length === 0 ||
    dialogAliases.length === 0 ||
    duplicateAliasConflicts.length > 0 ||
    createWordAlias.isPending ||
    deleteWordAlias.isPending;

  const addDialogAlias = (rawAlias: string) => {
    const normalized = rawAlias.toLowerCase().trim();
    if (!normalized) {
      setAliasInputError(null);
      return;
    }
    if (/\s/.test(normalized)) {
      setAliasInputError('Alias must be a single word');
      return;
    }
    if (dialogAliases.includes(normalized)) {
      setAliasInputError('Alias already added');
      return;
    }
    setDialogAliases((prev) => [...prev, normalized]);
    setAliasInputError(null);
    setDialogNewAliasInput('');
  };

  const handleSave = async () => {
    const nextAliases = normalizeList(dialogAliases);
    const previousAliases = normalizeList(existingAliasesForCanonical);
    const toDelete = previousAliases.filter((alias) => !nextAliases.includes(alias));
    const toCreate = nextAliases.filter((alias) => !previousAliases.includes(alias));

    for (const alias of toDelete) {
      await deleteWordAlias.mutateAsync(alias);
    }
    for (const alias of toCreate) {
      await createWordAlias.mutateAsync({ alias, canonical: canonicalNormalized });
    }

    closeDialog();
  };

  const handleDeleteCanonical = async () => {
    for (const alias of existingAliasesForCanonical) {
      await deleteWordAlias.mutateAsync(alias);
    }
    closeDialog();
  };

  const canonicalSuggestions = useMemo(() => {
    const fromApi = suggestionsMap.get(canonicalNormalized) ?? [];
    return normalizeList(fromApi).filter((alias) => !dialogAliases.includes(alias));
  }, [canonicalNormalized, dialogAliases, suggestionsMap]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top || 20, paddingBottom: insets.bottom || 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Abbreviations</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} testID="abbreviations-close">
            <X size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            testID="abbrev-view-canonical"
            style={[styles.segment, viewMode === 'canonical' ? styles.segmentActive : styles.segmentInactive]}
            onPress={() => setViewMode('canonical')}
          >
            <Text style={viewMode === 'canonical' ? styles.segmentTextActive : styles.segmentTextInactive}>
              Canonical → Aliases
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="abbrev-view-alias"
            style={[styles.segment, viewMode === 'alias' ? styles.segmentActive : styles.segmentInactive]}
            onPress={() => setViewMode('alias')}
          >
            <Text style={viewMode === 'alias' ? styles.segmentTextActive : styles.segmentTextInactive}>
              Alias → Canonical
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          testID="abbreviations-search-input"
          style={styles.searchInput}
          value={currentSearch}
          onChangeText={(value) => (viewMode === 'canonical' ? setCanonicalSearch(value) : setAliasSearch(value))}
          placeholder={viewMode === 'canonical' ? 'Search canonical words or aliases' : 'Search aliases or canonical words'}
          autoCapitalize="none"
          placeholderTextColor={colors.textDisabled}
        />

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          {viewMode === 'canonical'
            ? filteredCanonicalRows.map((row) => (
                <TouchableOpacity
                  key={`canonical-${row.canonical}`}
                  style={styles.row}
                  onPress={() =>
                    openDialog({
                      canonical: row.canonical,
                      canonicalEditable: false,
                      aliases: row.aliases,
                      existingId: row.canonical,
                    })
                  }
                >
                  <Text style={styles.rowPrimary}>{row.canonical}</Text>
                  <Text style={styles.rowSecondary}>
                    {row.aliases.map((alias, index) => {
                      const isMatched = searchTerms.length > 0 && searchTerms.some((term) => alias.startsWith(term));
                      return (
                        <Text key={alias}>
                          {index > 0 ? ', ' : ''}
                          <Text style={isMatched ? styles.aliasMatchHighlight : undefined}>{alias}</Text>
                        </Text>
                      );
                    })}
                  </Text>
                </TouchableOpacity>
              ))
            : filteredAliasRows.map((row) => (
                <TouchableOpacity
                  key={`alias-${row.alias}`}
                  style={styles.row}
                  onPress={() =>
                    openDialog({
                      canonical: row.canonical,
                      canonicalEditable: false,
                      aliases:
                        canonicalRows.find((canonicalRow) => canonicalRow.canonical === row.canonical)?.aliases ?? [],
                      existingId: row.canonical,
                    })
                  }
                >
                  <Text style={styles.rowPrimary}>{row.alias}</Text>
                  <Text style={styles.rowSecondary}>{row.canonical}</Text>
                </TouchableOpacity>
              ))}

          {unmatchedTerms.map((term) => (
            <TouchableOpacity
              key={`placeholder-${viewMode}-${term}`}
              style={[styles.row, styles.placeholderRow]}
              onPress={() =>
                openDialog({
                  canonical: viewMode === 'canonical' ? term : '',
                  canonicalEditable: true,
                  aliases: viewMode === 'canonical' ? [] : [term],
                  existingId: null,
                })
              }
            >
              <Text style={styles.rowPrimary}>{viewMode === 'canonical' ? term : `${term} → ?`}</Text>
              <Text style={styles.placeholderHelp}>No existing match. Tap to create.</Text>
              {!itemWordSet.has(term) ? (
                <Text style={styles.warningAmber}>doesn't appear in any of your items</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Modal visible={dialogVisible} animationType="fade" transparent={true} onRequestClose={closeDialog}>
        <Pressable style={styles.dialogBackdrop} onPress={closeDialog}>
          <Pressable style={styles.dialogCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.dialogHeader}>
              {dialogExistingId ? (
                <TouchableOpacity
                  testID="abbrev-dialog-delete-trigger"
                  style={styles.deletePill}
                  onPress={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={16} color={colors.destructiveText} />
                </TouchableOpacity>
              ) : (
                <View style={styles.deletePillSpacer} />
              )}
              <Text style={styles.dialogTitle}>{canonicalNormalized || 'New Abbreviation'}</Text>
              <TouchableOpacity onPress={closeDialog} style={styles.dialogCloseButton}>
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Canonical Word</Text>
            {dialogCanonicalEditable ? (
              <TextInput
                testID="abbrev-dialog-canonical-input"
                style={styles.input}
                value={dialogCanonical}
                onChangeText={(value) => setDialogCanonical(value.toLowerCase())}
                autoCapitalize="none"
                placeholder="e.g. chicken"
              />
            ) : (
              <View style={[styles.input, styles.readOnlyInput]}>
                <Text style={styles.readOnlyText}>{canonicalNormalized}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Aliases</Text>
            <View style={styles.chipsWrap}>
              {dialogAliases.map((alias) => (
                <View key={alias} style={styles.chip}>
                  <Text style={styles.chipText}>{alias}</Text>
                  <TouchableOpacity onPress={() => setDialogAliases((prev) => prev.filter((value) => value !== alias))}>
                    <Text style={styles.chipRemove}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.newAliasRow}>
              <TextInput
                testID="abbrev-dialog-new-alias-input"
                style={[styles.input, styles.newAliasInput]}
                value={dialogNewAliasInput}
                onChangeText={(value) => setDialogNewAliasInput(value.toLowerCase())}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={() => addDialogAlias(dialogNewAliasInput)}
                placeholder="Add alias"
              />
              <TouchableOpacity style={styles.addAliasButton} onPress={() => addDialogAlias(dialogNewAliasInput)}>
                <Text style={styles.addAliasText}>Add</Text>
              </TouchableOpacity>
            </View>
            {aliasInputError ? <Text style={styles.warningRed}>{aliasInputError}</Text> : null}

            {canonicalSuggestions.length > 0 ? (
              <View style={styles.suggestionsSection}>
                <Text style={styles.suggestionsLabel}>Suggestions</Text>
                <View style={styles.chipsWrap}>
                  {canonicalSuggestions.map((suggestion) => (
                    <TouchableOpacity
                      key={`suggestion-${suggestion}`}
                      style={styles.suggestionChip}
                      onPress={() => addDialogAlias(suggestion)}
                    >
                      <Text style={styles.suggestionChipText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {duplicateAliasConflicts.length > 0 ? (
              <Text style={styles.warningRed}>
                Alias already used by another canonical word: {duplicateAliasConflicts.join(', ')}
              </Text>
            ) : null}

            {vocabConflicts.length > 0 ? (
              <Text style={styles.warningAmber}>Matches size/package/unit vocabulary: {vocabConflicts.join(', ')}</Text>
            ) : null}

            {itemNameConflicts.map(({ alias, count }) => (
              <Text key={`item-conflict-${alias}`} style={styles.warningAmber}>
                "{alias}" appears in {count} item{count === 1 ? '' : 's'}
              </Text>
            ))}

            {!dialogExistingId && canonicalUnknown ? (
              <Text style={styles.warningAmber}>doesn't appear in any of your items</Text>
            ) : null}

            {showDeleteConfirm ? (
              <View style={styles.confirmContainer}>
                <Text style={styles.confirmText}>
                  Delete all abbreviations for "{canonicalNormalized}"? This cannot be undone.
                </Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowDeleteConfirm(false)}>
                    <Text style={styles.confirmCancelText}>Cancel delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmDelete} onPress={handleDeleteCanonical}>
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeDialog}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saveDisabled && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saveDisabled}
                testID="abbrev-dialog-save"
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  segment: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentInactive: {
    backgroundColor: colors.surfaceRaised,
  },
  segmentTextActive: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 12,
  },
  segmentTextInactive: {
    color: colors.textDisabled,
    fontWeight: '700',
    fontSize: 12,
  },
  searchInput: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
    gap: 8,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceRaised,
  },
  placeholderRow: {
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  rowPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  aliasMatchHighlight: {
    fontWeight: '700',
    color: colors.primary,
  },
  rowSecondary: {
    fontSize: 13,
    color: colors.textDisabled,
  },
  placeholderHelp: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dialogCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    maxHeight: '88%',
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  deletePill: {
    width: 34,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.destructiveSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePillSpacer: {
    width: 34,
    height: 30,
  },
  dialogTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.textPrimary,
    fontSize: 16,
    marginHorizontal: 8,
  },
  dialogCloseButton: {
    padding: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  readOnlyInput: {
    backgroundColor: colors.surfaceRaised,
  },
  readOnlyText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 4,
    gap: 6,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipRemove: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 16,
  },
  newAliasRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  newAliasInput: {
    flex: 1,
    marginBottom: 0,
  },
  addAliasButton: {
    backgroundColor: colors.buttonSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addAliasText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  suggestionsSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  suggestionsLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 6,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.buttonSecondary,
  },
  suggestionChipText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  warningRed: {
    marginTop: 6,
    color: colors.destructiveText,
    fontSize: 13,
    fontWeight: '600',
  },
  warningAmber: {
    marginTop: 6,
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmContainer: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.destructiveSurface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  confirmText: {
    color: colors.destructiveText,
    fontSize: 13,
    fontWeight: '600',
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  confirmCancel: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  confirmCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  confirmDelete: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#dc2626',
  },
  confirmDeleteText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 13,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  cancelButton: {
    backgroundColor: colors.buttonSecondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
});
