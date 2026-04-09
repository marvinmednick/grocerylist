import React, { useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Search, X, ChevronRight, ChevronDown } from 'lucide-react-native';
import {
  computeWarnings,
  getWarningText,
  useAllItems,
  useCreateMasterItem,
  useMasterItemNames,
  type MasterItem,
  type Warning,
} from '@/api/items';
import { useWordAliases } from '@/api/aliases';
import { useAddToList, useDeleteListItem } from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';
import { useMyProfile } from '@/api/profile';
import { useVocabulary } from '@/api/vocabulary';
import { WarningCallout } from '@/components/WarningCallout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  matchQualityScore,
  normalizeVoiceInput,
  parseInput,
  tokenize,
  classifyTokens,
  groupTokens,
  assembleCandidate,
  type ParsedInput,
} from '@/lib/parser';
import { DEFAULT_VOCABULARY } from '@/lib/vocabulary';
import { editDistanceThreshold, levenshteinDistance, normalizePlural } from '@/lib/fuzzyMatch';
import { formatQuantity, isPartialMatch, parseQuantityText, quantityEquals, type QuantityParsed } from '@/lib/quantityFormat';

interface SmartAddItemProps {
  disabled?: boolean;
  activeStoreId: string;
  onWarningToast?: (message: string) => void;
}

type EditTarget = MasterItem | { name: string; id: null; default_qty?: string | null; default_category_id?: string | null; alternate_qtys?: string[] | null };

type RowSelection = {
  qty: string;
  storeId: string | null;
};

type AliasMatchMetadata = {
  matchedName: string;
  canonicalName: string;
  matchedVia: 'alias';
};

const MAX_VISIBLE_QTY_PILLS = 7;
const MAX_VISIBLE_STORE_PILLS = 3;

const DEFAULT_WARNING_PREFS = {
  avoided: 'toast_and_badge',
  unavailable: 'toast_and_badge',
  non_preferred: 'badge_only',
  non_standard_qty: 'badge_only',
} as const;

function getRowKey(interpretation: ParsedInput, index: number): string {
  return `${interpretation.matchedItemId ?? interpretation.name}-${index}`;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function extractQuantityParsed(interpretation: ParsedInput): QuantityParsed | null {
  const { count, packageType, packagePlural, sizeQty, sizeUnit, sizeDescriptive } = interpretation;
  if (count === null && packageType === null && sizeQty === null && sizeUnit === null && sizeDescriptive === null) {
    return null;
  }

  return {
    count,
    packageType,
    packagePlural: packagePlural ?? null,
    sizeQty,
    sizeUnit,
    sizeDescriptive,
  };
}

function normalizeQuantityText(rawQuantity: string, parsed: QuantityParsed | null): string {
  if (!parsed) {
    return rawQuantity;
  }
  return formatQuantity(parsed);
}

export function SmartAddItem({ disabled = false, activeStoreId, onWarningToast }: SmartAddItemProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EditTarget | null>(null);
  const [rowSelections, setRowSelections] = useState<Record<string, RowSelection>>({});
  const [otherQtyRowKey, setOtherQtyRowKey] = useState<string | null>(null);
  const [otherQtyInput, setOtherQtyInput] = useState('');
  const [oneOffQty, setOneOffQty] = useState('1');
  const [oneOffQtyPopoverOpen, setOneOffQtyPopoverOpen] = useState(false);
  const [oneOffQtyInput, setOneOffQtyInput] = useState('');

  const [editQty, setEditQty] = useState('');
  const [editStoreId, setEditStoreId] = useState('');
  const [editStoreDropdownOpen, setEditStoreDropdownOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editStoreHint, setEditStoreHint] = useState<string | null>(null);
  const [editInterpretation, setEditInterpretation] = useState<ParsedInput | null>(null);
  const [editShowMoreStores, setEditShowMoreStores] = useState(false);
  const editQtyInputRef = useRef<TextInput>(null);

  const { data: masterItemNames = [] } = useMasterItemNames();
  const { data: loadedWordAliases } = useWordAliases();
  const { data: allItems = [] } = useAllItems();
  const { mutateAsync: addItem } = useAddToList();
  const { mutateAsync: createMasterItem } = useCreateMasterItem();
  const { mutateAsync: deleteItem } = useDeleteListItem();
  const { data: metadata } = useMetadata();
  const { data: vocabulary } = useVocabulary();
  const myProfileQuery = useMyProfile();
  const myProfile = myProfileQuery?.data;
  const { pushAction } = useUndo();

  const masterDetailsById = useMemo(() => {
    return new Map(allItems.map((item) => [item.id, item]));
  }, [allItems]);

  const masterNameById = useMemo(() => {
    return new Map(masterItemNames.map((item) => [item.id, item]));
  }, [masterItemNames]);

  const vocab = vocabulary ?? DEFAULT_VOCABULARY;
  const wordAliases = loadedWordAliases ?? new Map<string, string>();
  const storeNamesList = useMemo(() => {
    return (metadata?.stores || []).map((s) => s.name);
  }, [metadata?.stores]);

  const parseResult = useMemo(() => {
    const normalizedQuery = normalizeVoiceInput(query, storeNamesList);
    const result = parseInput(normalizedQuery, vocab, masterItemNames, wordAliases);
    return { ...result, rawInput: query };
  }, [query, storeNamesList, vocab, masterItemNames, wordAliases]);

  const parseCandidate = useMemo(() => {
    const normalizedQuery = normalizeVoiceInput(query, storeNamesList);
    return assembleCandidate(groupTokens(classifyTokens(tokenize(normalizedQuery), vocab)));
  }, [query, storeNamesList, vocab]);

  const prefixFallbackInterpretations: ParsedInput[] = useMemo(() => {
    if (query.length < 2) {
      return [];
    }
    // Use parser-extracted name tokens so that count/unit/@hint don't pollute the search.
    // Match word-by-word: every name token must be a prefix of at least one word in the item name.
    // This lets "bone" match "Chicken Bone Broth" and "1 chick @safeway" match "Chicken Breast".
    const nameTokens = parseCandidate.nameWords
      .flatMap((w) => w.split(/\s+/))
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 0);

    const expandedNameTokens = nameTokens.map((token) => {
      const expanded = wordAliases.get(token);
      if (!expanded) {
        return [token];
      }
      return dedupe([token, expanded.toLowerCase()]);
    });

    const evaluateTokenWordMatch = (
      token: string,
      word: string
    ): { matched: boolean; tier: 0 | 1 | 2; distance: number; usedFuzzy: boolean } => {
      if (word.startsWith(token)) {
        return { matched: true, tier: 0, distance: 0, usedFuzzy: false };
      }

      if (normalizePlural(word).startsWith(normalizePlural(token))) {
        return { matched: true, tier: 1, distance: 0, usedFuzzy: false };
      }

      if (token.length < 3 || word.length < 3) {
        return { matched: false, tier: 2, distance: Number.POSITIVE_INFINITY, usedFuzzy: false };
      }

      const distance = levenshteinDistance(token, word);
      const threshold = editDistanceThreshold(Math.min(token.length, word.length));
      if (distance <= threshold) {
        return { matched: true, tier: 2, distance, usedFuzzy: true };
      }

      return { matched: false, tier: 2, distance: Number.POSITIVE_INFINITY, usedFuzzy: false };
    };

    const findBestMatchForTokenOptions = (
      tokenOptions: string[],
      words: string[]
    ): { matched: boolean; fuzzyCount: number } => {
      let best: { tier: 0 | 1 | 2; distance: number; usedFuzzy: boolean } | null = null;

      tokenOptions.forEach((token) => {
        words.forEach((word) => {
          const result = evaluateTokenWordMatch(token, word);
          if (!result.matched) {
            return;
          }

          if (!best || result.tier < best.tier || (result.tier === best.tier && result.distance < best.distance)) {
            best = {
              tier: result.tier,
              distance: result.distance,
              usedFuzzy: result.usedFuzzy,
            };
          }
        });
      });

      if (!best) {
        return { matched: false, fuzzyCount: 0 };
      }

      return { matched: true, fuzzyCount: best.usedFuzzy ? 1 : 0 };
    };

    const allLookupWords = masterItemNames.flatMap((item) =>
      [item.name, ...(item.aliases ?? [])]
        .flatMap((lookupName) => lookupName.toLowerCase().split(/\s+/))
        .filter((word) => word.length > 0)
    );
    const productiveTokenOptionIndices = expandedNameTokens
      .map((tokenOptions, index) => (findBestMatchForTokenOptions(tokenOptions, allLookupWords).matched ? index : -1))
      .filter((index) => index !== -1);
    const productiveTokenOptions = productiveTokenOptionIndices.map((index) => expandedNameTokens[index]);
    const fallbackOrphans = expandedNameTokens
      .filter((_, index) => !productiveTokenOptionIndices.includes(index))
      .map((tokenOptions) => tokenOptions[0]);

    if (productiveTokenOptions.length === 0) return [];
    return masterItemNames
      .flatMap((item) => {
        const lookupNames = [item.name, ...(item.aliases ?? [])];
        const matches = lookupNames.filter((lookupName) => {
          const itemWords = lookupName
            .toLowerCase()
            .split(/\s+/)
            .filter((word) => word.length > 0);
          return productiveTokenOptions.every((tokenOptions) => findBestMatchForTokenOptions(tokenOptions, itemWords).matched);
        });

        return matches.map((lookupName) => {
          const itemWords = lookupName
            .toLowerCase()
            .split(/\s+/)
            .filter((word) => word.length > 0);
          const fuzzyCount = productiveTokenOptions.reduce((count, tokenOptions) => {
            const match = findBestMatchForTokenOptions(tokenOptions, itemWords);
            return count + match.fuzzyCount;
          }, 0);

          return {
            name: lookupName,
            canonicalName: item.name,
            matchedItemId: item.id,
            matchedVia: lookupName === item.name ? 'name' : ('alias' as const),
            count: parseCandidate.count,
            packageType: parseCandidate.packageType,
            packagePlural: parseCandidate.packagePlural,
            sizeDescriptive: parseCandidate.sizeDescriptive,
            sizeQty: parseCandidate.sizeQty,
            sizeUnit: parseCandidate.sizeUnit,
            storeHint: parseCandidate.storeHint,
            orphans: fallbackOrphans,
            fuzzyCount,
          } satisfies ParsedInput;
        });
      });
  }, [query, masterItemNames, parseCandidate, wordAliases]);

  const hasStructuredRows = query.length >= 2 && (parseResult.interpretations.length > 0 || prefixFallbackInterpretations.length > 0);

  const getDefaultSelection = (rowKey: string, interpretation: ParsedInput): RowSelection => {
    const masterRef = interpretation.matchedItemId ? masterNameById.get(interpretation.matchedItemId) : null;
    const baseQtyOptions = dedupe([masterRef?.default_qty || '1', ...(masterRef?.alternate_qtys || [])]);

    const parsedQty = formatQuantity({
      count: interpretation.count,
      packageType: interpretation.packageType,
      packagePlural: interpretation.packagePlural,
      sizeQty: interpretation.sizeQty,
      sizeUnit: interpretation.sizeUnit,
      sizeDescriptive: interpretation.sizeDescriptive,
    }).trim();

    let qty = baseQtyOptions[0] || '1';
    if (parsedQty.length > 0) {
      const exact = baseQtyOptions.find((option) => quantityEquals(parsedQty, option, vocab));
      qty = exact || parsedQty;
    }

    const hintMatches = interpretation.storeHint
      ? (metadata?.stores || []).filter((store) =>
          store.name.toLowerCase().startsWith(interpretation.storeHint!.toLowerCase())
        )
      : [];

    return {
      qty,
      storeId: hintMatches.length > 0 ? hintMatches[0].id : activeStoreId || null,
    };
  };

  const getSelection = (rowKey: string, interpretation: ParsedInput): RowSelection => {
    return rowSelections[rowKey] || getDefaultSelection(rowKey, interpretation);
  };

  const setSelection = (rowKey: string, interpretation: ParsedInput, updates: Partial<RowSelection>) => {
    const current = getSelection(rowKey, interpretation);
    setRowSelections((prev) => ({
      ...prev,
      [rowKey]: {
        ...current,
        ...updates,
      },
    }));
  };

  const clearAndClose = () => {
    setQuery('');
    setIsEditing(false);
    setSelectedItem(null);
    setRowSelections({});
    setOtherQtyRowKey(null);
    setOtherQtyInput('');
    setOneOffQty('1');
    setOneOffQtyPopoverOpen(false);
    setOneOffQtyInput('');
    setEditStoreHint(null);
    setEditInterpretation(null);
    setEditShowMoreStores(false);
    Keyboard.dismiss();
  };

  const aliasMatchMetadata = (interpretation?: ParsedInput | null): AliasMatchMetadata | undefined => {
    if (!interpretation || interpretation.matchedVia !== 'alias') {
      return undefined;
    }
    return {
      matchedName: interpretation.name,
      canonicalName: interpretation.canonicalName,
      matchedVia: 'alias',
    };
  };

  const maybeTriggerWarningToast = (warnings: Warning[]) => {
    if (!onWarningToast || warnings.length === 0) {
      return;
    }

    const prefs = myProfile?.warning_preferences ?? DEFAULT_WARNING_PREFS;
    const shouldToast = warnings.some((warning) => {
      if (warning.type === 'non_preferred') {
        return false;
      }
      return prefs[warning.type] === 'toast_and_badge';
    });

    if (!shouldToast) {
      return;
    }

    const message = warnings.map((warning) => getWarningText(warning)).join(' • ').trim();
    if (message.length > 0) {
      onWarningToast(message);
    }
  };

  const onCommitAdd = async (item: MasterItem, interpretation: ParsedInput, rowKey: string) => {
    Keyboard.dismiss();
    const selection = getSelection(rowKey, interpretation);
    const name = item.name;
    const warnings = computeWarnings(
      item.item_store_preferences,
      selection.storeId,
      selection.qty,
      item.default_qty,
      item.alternate_qtys
    );

    const forwardAction = async () => {
      const quantityParsed = extractQuantityParsed(interpretation);
      const normalizedQty = normalizeQuantityText(selection.qty, quantityParsed);
      return await addItem({
        name: item.name,
        item_id: item.id,
        quantity: normalizedQty,
        quantity_parsed: quantityParsed,
        store_id: selection.storeId,
        category_id: item.default_category_id,
        warnings,
        match_metadata: aliasMatchMetadata(interpretation),
      });
    };

    const result = await forwardAction();
    const tracker = { currentId: result.id };

    pushAction({
      label: `Added ${name} (${selection.qty})`,
      undo: async () => {
        await deleteItem(tracker.currentId);
      },
      redo: async () => {
        const redone = await forwardAction();
        tracker.currentId = redone.id;
      },
    });

    clearAndClose();
    setTimeout(() => maybeTriggerWarningToast(warnings), 400);
  };

  const onOneOffAdd = async () => {
    const name = parseResult.rawInput;
    const forwardAction = async () => {
      const quantityParsed = parseQuantityText(oneOffQty, vocab);
      const normalizedQty = normalizeQuantityText(oneOffQty, quantityParsed);
      return await addItem({
        name: parseResult.rawInput,
        item_id: null,
        quantity: normalizedQty,
        quantity_parsed: quantityParsed,
        store_id: activeStoreId || null,
        category_id: null,
        warnings: [],
      });
    };

    const result = await forwardAction();
    const tracker = { currentId: result.id };

    pushAction({
      label: `Added ${name}`,
      undo: async () => {
        await deleteItem(tracker.currentId);
      },
      redo: async () => {
        const redone = await forwardAction();
        tracker.currentId = redone.id;
      },
    });

    clearAndClose();
  };

  const selectedMasterItem = selectedItem?.id ? selectedItem : null;
  const editWarnings = selectedMasterItem
    ? computeWarnings(
        selectedMasterItem.item_store_preferences,
        editStoreId,
        editQty,
        selectedMasterItem.default_qty,
        selectedMasterItem.alternate_qtys
      )
    : [];

  const onEditAdd = (
    item: EditTarget,
    options?: {
      initialQty?: string;
      initialStoreId?: string | null;
      storeHint?: string | null;
      interpretation?: ParsedInput | null;
    }
  ) => {
    Keyboard.dismiss();
    setSelectedItem(item);
    setEditQty(options?.initialQty || item.default_qty || '1');
    setEditStoreId(options?.initialStoreId || activeStoreId || metadata?.stores?.[0]?.id || '');
    setEditStoreDropdownOpen(false);
    setEditCategoryId(item.default_category_id || '');
    setEditStoreHint(options?.storeHint || null);
    setEditInterpretation(options?.interpretation || null);
    setEditShowMoreStores(false);
    setIsEditing(true);
  };

  const closeEditModal = () => {
    setIsEditing(false);
    setSelectedItem(null);
    setEditQty('');
    setEditStoreId('');
    setEditStoreDropdownOpen(false);
    setEditCategoryId('');
    setEditStoreHint(null);
    setEditInterpretation(null);
    setEditShowMoreStores(false);
  };

  const onOneOffEditAdd = async () => {
    const itemName = selectedItem?.name || query;
    const forwardAction = async () => {
      const quantityParsed = parseQuantityText(editQty, vocab);
      const normalizedQty = normalizeQuantityText(editQty, quantityParsed);
      return await addItem({
        name: itemName,
        item_id: null,
        quantity: normalizedQty,
        quantity_parsed: quantityParsed,
        store_id: editStoreId || null,
        category_id: editCategoryId || null,
        warnings: [],
        match_metadata: aliasMatchMetadata(editInterpretation),
      });
    };

    const result = await forwardAction();
    const tracker = { currentId: result.id };

    pushAction({
      label: `Added ${itemName}`,
      undo: async () => {
        await deleteItem(tracker.currentId);
      },
      redo: async () => {
        const redone = await forwardAction();
        tracker.currentId = redone.id;
      },
    });

    clearAndClose();
  };

  const onSaveEdited = async () => {
    editQtyInputRef.current?.blur();
    let itemId = selectedItem?.id;
    const itemName = selectedItem?.name || query;

    if (!itemId) {
      try {
        const defaultQtyParsed = parseQuantityText(editQty, vocab);
        const newItem = await createMasterItem({
          name: itemName,
          default_qty: normalizeQuantityText(editQty, defaultQtyParsed),
          default_qty_parsed: defaultQtyParsed,
          default_category_id: editCategoryId || null,
        });
        itemId = newItem.id;
      } catch (err) {
        console.error('Failed to create master item:', err);
        return;
      }
    }

    const warnings = selectedItem?.id
      ? computeWarnings(
          selectedItem.item_store_preferences,
          editStoreId,
          editQty,
          selectedItem.default_qty,
          selectedItem.alternate_qtys
        )
      : [];

    const forwardAction = async () => {
      const quantityParsed = parseQuantityText(editQty, vocab);
      const normalizedQty = normalizeQuantityText(editQty, quantityParsed);
      return await addItem({
        name: itemName,
        item_id: itemId || null,
        quantity: normalizedQty,
        quantity_parsed: quantityParsed,
        store_id: editStoreId || null,
        category_id: editCategoryId || null,
        warnings,
        match_metadata: aliasMatchMetadata(editInterpretation),
      });
    };

    const result = await forwardAction();
    const tracker = { currentId: result.id };

    pushAction({
      label: `Added ${itemName}`,
      undo: async () => {
        await deleteItem(tracker.currentId);
      },
      redo: async () => {
        const redone = await forwardAction();
        tracker.currentId = redone.id;
      },
    });

    clearAndClose();
    setTimeout(() => maybeTriggerWarningToast(warnings), 400);
  };

  const rankedInterpretations = useMemo(() => {
    const merged = [...parseResult.interpretations, ...prefixFallbackInterpretations];
    const bestByItemId = new Map<string, ParsedInput>();

    merged.forEach((interpretation, index) => {
      const key = interpretation.matchedItemId ?? `${interpretation.name.toLowerCase()}::${index}`;
      const current = bestByItemId.get(key);
      if (!current) {
        bestByItemId.set(key, interpretation);
        return;
      }

      const scoreDelta = matchQualityScore(interpretation) - matchQualityScore(current);
      if (scoreDelta > 0) {
        bestByItemId.set(key, interpretation);
        return;
      }
      if (scoreDelta < 0) {
        return;
      }

      const interpretationTokenCount = interpretation.name.split(/\s+/).filter((token) => token.length > 0).length;
      const currentTokenCount = current.name.split(/\s+/).filter((token) => token.length > 0).length;
      if (interpretationTokenCount > currentTokenCount) {
        bestByItemId.set(key, interpretation);
      }
    });

    return [...bestByItemId.values()].sort((a, b) => {
      const scoreDelta = matchQualityScore(b) - matchQualityScore(a);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const tokensA = a.name.split(/\s+/).filter((token) => token.length > 0).length;
      const tokensB = b.name.split(/\s+/).filter((token) => token.length > 0).length;
      return tokensB - tokensA;
    });
  }, [parseResult.interpretations, prefixFallbackInterpretations]);

  return (
    <View style={[styles.container, disabled && { opacity: 0.6 }]}> 
      <View style={styles.searchBar}>
        <Search size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder={disabled ? 'Loading household...' : 'Add item...'}
          value={query}
          onChangeText={setQuery}
          placeholderTextColor="#9ca3af"
          editable={!disabled}
        />
        {query.length > 0 && !disabled && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
            <X size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {query.length > 0 && (
        <View style={styles.dropdown}>
          {rankedInterpretations.length > 0 && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>BEST MATCHES</Text>
            </View>
          )}

          {rankedInterpretations.map((interpretation, index) => {
            const rowKey = getRowKey(interpretation, index);
            const masterRef = interpretation.matchedItemId ? masterNameById.get(interpretation.matchedItemId) : null;
            const fullItem = interpretation.matchedItemId ? masterDetailsById.get(interpretation.matchedItemId) : null;
            if (!masterRef || !fullItem) {
              return null;
            }

            const parsedQty = formatQuantity({
              count: interpretation.count,
              packageType: interpretation.packageType,
              packagePlural: interpretation.packagePlural,
              sizeQty: interpretation.sizeQty,
              sizeUnit: interpretation.sizeUnit,
              sizeDescriptive: interpretation.sizeDescriptive,
            }).trim();

            const baseQtyOptions = dedupe([masterRef.default_qty || '1', ...(masterRef.alternate_qtys || [])]);
            const selected = getSelection(rowKey, interpretation);
            const exactMatch = parsedQty
              ? baseQtyOptions.find((option) => quantityEquals(parsedQty, option, vocab))
              : null;

            let qtyOptions = [...baseQtyOptions];
            if (!exactMatch && parsedQty.length > 0 && !qtyOptions.includes(parsedQty)) {
              qtyOptions = [parsedQty, ...qtyOptions];
            }

            const activeQty = selected.qty;
            const remainingQty = qtyOptions
              .filter((option) => option !== activeQty)
              .sort((a, b) => {
                const aPartial = parsedQty.length > 0 && isPartialMatch(parsedQty, a);
                const bPartial = parsedQty.length > 0 && isPartialMatch(parsedQty, b);
                if (aPartial === bPartial) {
                  return a.localeCompare(b);
                }
                return aPartial ? -1 : 1;
              });
            const orderedQty = dedupe([activeQty, ...remainingQty]);

            const storeMatches = interpretation.storeHint
              ? (metadata?.stores || []).filter((store) =>
                  store.name.toLowerCase().startsWith(interpretation.storeHint!.toLowerCase())
                )
              : [];

            const selectedStoreId = selected.storeId;

            return (
              <View key={rowKey} style={styles.resultRowComplex}>
                <View style={styles.resultMainSection}>
                  <TouchableOpacity style={styles.resultHeader} onPress={() => onCommitAdd(fullItem, interpretation, rowKey)}>
                    <View style={styles.resultTitleRow}>
                      <Text style={styles.resultName}>{interpretation.name}</Text>
                      {interpretation.orphans.length > 0 ? (
                        <Text style={styles.orphanText}>{interpretation.orphans.join(' ')}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {otherQtyRowKey === rowKey ? (
                    <View style={styles.inlineOtherEditor}>
                      <TextInput
                        style={styles.otherQtyInputInline}
                        value={otherQtyInput}
                        onChangeText={setOtherQtyInput}
                        autoFocus
                        placeholder="e.g. 3 lbs"
                        placeholderTextColor="#9ca3af"
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          const trimmed = otherQtyInput.trim();
                          if (trimmed.length > 0) {
                            setSelection(rowKey, interpretation, { qty: trimmed });
                          }
                          setOtherQtyRowKey(null);
                        }}
                      />
                      <TouchableOpacity
                        testID={`qty-other-close-${fullItem.id}`}
                        style={styles.otherCloseButton}
                        onPress={() => setOtherQtyRowKey(null)}
                      >
                        <Text style={styles.otherCloseText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.inlinePillRow}>
                      <Text style={styles.inlineLabel}>Qty: </Text>
                      {orderedQty.slice(0, MAX_VISIBLE_QTY_PILLS).map((qtyOption) => {
                        const isActive = activeQty === qtyOption;
                        return (
                          <TouchableOpacity
                            key={qtyOption}
                            style={[styles.inlinePill, isActive && styles.pillActiveBlue]}
                            onPress={() => setSelection(rowKey, interpretation, { qty: qtyOption })}
                          >
                            <Text style={[styles.inlinePillText, isActive && styles.pillTextActive]}>{qtyOption}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      {orderedQty.length > MAX_VISIBLE_QTY_PILLS ? (
                        <TouchableOpacity
                          style={styles.inlinePill}
                          onPress={() =>
                            onEditAdd(fullItem, {
                              initialQty: activeQty,
                              initialStoreId: selectedStoreId,
                              storeHint: interpretation.storeHint,
                              interpretation,
                            })
                          }
                        >
                          <Text style={styles.inlinePillText}>...</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        testID={`result-qty-chip-other-${fullItem.id}`}
                        style={styles.inlinePill}
                        onPress={() => {
                          setOtherQtyRowKey(rowKey);
                          setOtherQtyInput(parsedQty);
                        }}
                      >
                        <Text style={styles.inlinePillText}>Other</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {interpretation.storeHint ? (
                    <View style={styles.inlinePillRow}>
                      <Text style={styles.inlineLabel}>Store: </Text>
                      {storeMatches.length === 0 ? (
                        <Text style={styles.unresolvedStoreHint}>@{interpretation.storeHint}</Text>
                      ) : (
                        <>
                          {storeMatches.slice(0, MAX_VISIBLE_STORE_PILLS).map((store) => {
                            const isActive = selectedStoreId === store.id;
                            return (
                              <TouchableOpacity
                                key={store.id}
                                style={[styles.inlinePill, isActive && styles.pillActiveBlue]}
                                onPress={() => setSelection(rowKey, interpretation, { storeId: store.id })}
                              >
                                <Text style={[styles.inlinePillText, isActive && styles.pillTextActive]}>{store.name}</Text>
                              </TouchableOpacity>
                            );
                          })}
                          {storeMatches.length > MAX_VISIBLE_STORE_PILLS ? (
                            <TouchableOpacity
                              style={styles.inlinePill}
                              onPress={() =>
                                onEditAdd(fullItem, {
                                  initialQty: activeQty,
                                  initialStoreId: selectedStoreId,
                                  storeHint: interpretation.storeHint,
                                  interpretation,
                                })
                              }
                            >
                              <Text style={styles.inlinePillText}>...</Text>
                            </TouchableOpacity>
                          ) : null}
                        </>
                      )}
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  testID={`edit-add-${fullItem.id}`}
                  style={styles.resultEditBtn}
                  onPress={() =>
                    onEditAdd(fullItem, {
                      initialQty: activeQty,
                      initialStoreId: selectedStoreId,
                      storeHint: interpretation.storeHint,
                      interpretation,
                    })
                  }
                >
                  <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={styles.createRow}>
            <View style={styles.createMain}>
              <TouchableOpacity style={styles.createMainButton} onPress={onOneOffAdd}>
                <Text style={styles.createText}>Add "{parseResult.rawInput}" (One-time)</Text>
              </TouchableOpacity>
              <View style={styles.inlinePillRow}>
                <Text style={styles.inlineLabel}>Qty: </Text>
                <TouchableOpacity
                  testID="one-off-qty-chip-1"
                  style={[styles.inlinePill, oneOffQty === '1' && styles.pillActiveBlue]}
                  onPress={() => setOneOffQty('1')}
                >
                  <Text style={[styles.inlinePillText, oneOffQty === '1' && styles.pillTextActive]}>1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="one-off-qty-chip-other"
                  style={[styles.inlinePill, oneOffQty !== '1' && styles.pillActiveBlue]}
                  onPress={() => {
                    setOneOffQtyInput('');
                    setOneOffQtyPopoverOpen(true);
                  }}
                >
                  <Text style={[styles.inlinePillText, oneOffQty !== '1' && styles.pillTextActive]}>
                    {oneOffQty !== '1' ? oneOffQty : 'Other'}
                  </Text>
                </TouchableOpacity>
              </View>
              {oneOffQtyPopoverOpen && (
                <View style={styles.otherQtyPopover}>
                  <TextInput
                    style={styles.otherQtyInput}
                    value={oneOffQtyInput}
                    onChangeText={setOneOffQtyInput}
                    placeholder="e.g. 3 lbs"
                    placeholderTextColor="#9ca3af"
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      const trimmed = oneOffQtyInput.trim();
                      if (trimmed.length > 0) {
                        setOneOffQty(trimmed);
                      }
                      setOneOffQtyPopoverOpen(false);
                    }}
                  />
                </View>
              )}
            </View>
            <TouchableOpacity
              testID="edit-add-one-off"
              style={styles.createEditBtn}
              onPress={() =>
                onEditAdd(
                  { name: parseResult.rawInput, id: null },
                  { initialQty: oneOffQty, initialStoreId: activeStoreId || null, storeHint: null }
                )
              }
            >
              <ChevronRight size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={isEditing} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: insets.top }]}> 
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedItem?.name || query}</Text>
              <TouchableOpacity onPress={closeEditModal} style={styles.modalCloseBtn}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedMasterItem ? <WarningCallout warnings={editWarnings} /> : null}

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                ref={editQtyInputRef}
                style={styles.modalInput}
                value={editQty}
                onChangeText={setEditQty}
                placeholder="e.g. 1 gal"
              />

              {selectedItem?.alternate_qtys?.length ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.label}>Usual Quantities</Text>
                  <View style={styles.tagsContainer}>
                    {[...(selectedItem.alternate_qtys || [])]
                      .sort((a, b) => {
                        const aPartial = editQty.length > 0 && isPartialMatch(editQty, a);
                        const bPartial = editQty.length > 0 && isPartialMatch(editQty, b);
                        if (aPartial === bPartial) {
                          return a.localeCompare(b);
                        }
                        return aPartial ? -1 : 1;
                      })
                      .map((qtyOption: string) => (
                        <TouchableOpacity
                          key={qtyOption}
                          onPress={() => setEditQty(qtyOption)}
                          style={[styles.tag, editQty === qtyOption ? styles.tagActive : styles.tagInactive]}
                        >
                          <Text style={editQty === qtyOption ? styles.tagTextActive : styles.tagTextInactive}>
                            {qtyOption}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
              ) : null}

              <Text style={styles.label}>Store</Text>
              <View style={{ marginBottom: 24 }}>
                <TouchableOpacity
                  testID="edit-store-dropdown-trigger"
                  style={styles.dropdownTrigger}
                  onPress={() => setEditStoreDropdownOpen((prev) => !prev)}
                >
                  <View style={styles.dropdownValue}>
                    {editStoreId ? (
                      <>
                        <View
                          style={[
                            styles.storeColorDot,
                            { backgroundColor: metadata?.stores?.find((s) => s.id === editStoreId)?.color_code ?? '#9ca3af' },
                          ]}
                        />
                        <Text style={styles.storeNameText}>{metadata?.stores?.find((s) => s.id === editStoreId)?.name ?? ''}</Text>
                      </>
                    ) : (
                      <Text style={styles.dropdownPlaceholder}>No store</Text>
                    )}
                  </View>
                  <ChevronDown size={16} color="#6b7280" />
                </TouchableOpacity>

                {editStoreDropdownOpen ? (
                  <View style={styles.dropdownMenu}>
                    <TouchableOpacity
                      testID="edit-store-option-none"
                      style={styles.dropdownOption}
                      onPress={() => {
                        setEditStoreId('');
                        setEditStoreDropdownOpen(false);
                      }}
                    >
                      <Text style={[styles.storeNameText, { color: '#9ca3af' }]}>No store</Text>
                    </TouchableOpacity>
                    {(() => {
                      const allStores = metadata?.stores || [];
                      const matches = editStoreHint
                        ? allStores.filter((store) =>
                            store.name.toLowerCase().startsWith(editStoreHint.toLowerCase())
                          )
                        : allStores;
                      const nonMatches = editStoreHint
                        ? allStores.filter((store) =>
                            !store.name.toLowerCase().startsWith(editStoreHint.toLowerCase())
                          )
                        : [];
                      const visibleStores = editStoreHint && !editShowMoreStores ? matches : [...matches, ...nonMatches];

                      return (
                        <>
                          {visibleStores.map((store) => (
                            <TouchableOpacity
                              key={store.id}
                              testID={`edit-store-${store.id}`}
                              style={styles.dropdownOption}
                              onPress={() => {
                                setEditStoreId(store.id);
                                setEditStoreDropdownOpen(false);
                              }}
                            >
                              <View style={[styles.storeColorDot, { backgroundColor: store.color_code }]} />
                              <Text style={styles.storeNameText}>{store.name}</Text>
                            </TouchableOpacity>
                          ))}
                          {editStoreHint && !editShowMoreStores && nonMatches.length > 0 ? (
                            <TouchableOpacity
                              style={styles.dropdownOption}
                              onPress={() => setEditShowMoreStores(true)}
                            >
                              <Text style={styles.storeMoreText}>▸ More</Text>
                            </TouchableOpacity>
                          ) : null}
                        </>
                      );
                    })()}
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <View style={[styles.modalActions, { paddingBottom: insets.bottom }]}> 
              {selectedItem?.id ? (
                <>
                  <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn, { flex: 1 }]} onPress={closeEditModal}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.saveBtn, { flex: 1 }]} onPress={onSaveEdited}>
                    <Text style={styles.saveText}>Add to List</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={[styles.actionBtn, styles.saveBtn, { flex: 1 }]} onPress={onOneOffEditAdd}>
                    <Text style={styles.saveText}>Add to List</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn, { flex: 1 }]} onPress={onSaveEdited}>
                    <Text style={styles.cancelText}>Save & Add</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    zIndex: 50,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  dropdown: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
  },
  resultRowComplex: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  resultMainSection: {
    flex: 1,
    padding: 12,
  },
  resultHeader: {
    marginBottom: 4,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  orphanText: {
    fontSize: 13,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  pillActiveBlue: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  inlinePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  inlineLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    width: 40,
  },
  inlinePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  inlinePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4b5563',
  },
  unresolvedStoreHint: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },
  inlineOtherEditor: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  otherQtyInputInline: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    height: 32,
  },
  otherCloseButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  otherCloseText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  otherQtyPopover: {
    marginTop: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  otherQtyInput: {
    fontSize: 13,
    color: '#111827',
    height: 32,
  },
  resultEditBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderLeftWidth: 1,
    borderLeftColor: '#f3f4f6',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  createMain: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#eff6ff',
  },
  createMainButton: {
    paddingVertical: 4,
  },
  createText: {
    color: '#2563eb',
    fontWeight: '500',
  },
  createEditBtn: {
    paddingHorizontal: 16,
    height: 48,
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    borderLeftWidth: 1,
    borderLeftColor: '#bfdbfe',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tagInactive: {
    backgroundColor: 'white',
    borderColor: '#d1d5db',
  },
  tagTextActive: {
    color: 'white',
  },
  tagTextInactive: {
    color: '#374151',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownPlaceholder: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    marginTop: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  storeColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  storeNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  storeMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#e5e7eb',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
  },
  cancelText: {
    fontWeight: '700',
    color: '#374151',
  },
  saveText: {
    fontWeight: '700',
    color: 'white',
  },
});
