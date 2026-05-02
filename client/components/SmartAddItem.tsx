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
import {
  type ListItem,
  useAddQuantityEntry,
  useAddToList,
  useDeleteListItem,
  useUpdateQuantityEntry,
} from '@/api/list';
import { useMetadata } from '@/api/metadata';
import { useUndo } from '@/api/undoContext';
import { DEFAULT_QUICK_ACCEPT_SETTINGS, DEFAULT_WARNING_PREFS, useMyProfile } from '@/api/profile';
import { useVocabulary } from '@/api/vocabulary';
import { DuplicateResolutionDialog } from '@/components/DuplicateResolutionDialog';
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
import {
  combineQuantities,
  formatQuantity,
  isPartialMatch,
  parseQuantityText,
  quantityEquals,
  type CombineOption,
  type QuantityParsed,
} from '@/lib/quantityFormat';
import { classifyDuplicateState, findDuplicate, type DuplicateState } from '@/lib/duplicateDetection';
import { useQuickAcceptState } from '@/lib/useQuickAcceptState';
import type { AppColors } from '@/constants/Colors';
import { useThemeColors } from '@/lib/theme';

interface SmartAddItemProps {
  disabled?: boolean;
  activeStoreId: string;
  listItems: ListItem[];
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

interface PendingAddDetails {
  itemId: string | null;
  name: string;
  quantity: string;
  quantityParsed: QuantityParsed | null;
  storeId: string | null;
  categoryId: string | null;
  warnings: Warning[];
  matchMetadata?: AliasMatchMetadata;
  prepare?: () => Promise<boolean>;
  forwardAction: () => Promise<{ parent: { id: string }; entry: { id: string } }>;
}

const MAX_VISIBLE_QTY_PILLS = 7;
const MAX_VISIBLE_STORE_PILLS = 3;


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

export function SmartAddItem({ disabled = false, activeStoreId, listItems = [], onWarningToast }: SmartAddItemProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const [duplicateMatch, setDuplicateMatch] = useState<ListItem | null>(null);
  const [pendingAdd, setPendingAdd] = useState<PendingAddDetails | null>(null);
  const [savedQuery, setSavedQuery] = useState('');
  const savedQueryRef = useRef('');
  const editQtyInputRef = useRef<TextInput>(null);

  const { data: masterItemNames = [] } = useMasterItemNames();
  const { data: loadedWordAliases } = useWordAliases();
  const { data: allItems = [] } = useAllItems();
  const { mutateAsync: addItem } = useAddToList();
  const { mutateAsync: addQuantityEntry = async () => {
    throw new Error('useAddQuantityEntry is unavailable');
  } } = useAddQuantityEntry() ?? {};
  const { mutateAsync: createMasterItem } = useCreateMasterItem();
  const { mutateAsync: deleteItem = async () => {
    throw new Error('useDeleteListItem is unavailable');
  } } = useDeleteListItem() ?? {};
  const { mutateAsync: updateQuantityEntry = async () => {
    throw new Error('useUpdateQuantityEntry is unavailable');
  } } = useUpdateQuantityEntry() ?? {};
  const { data: metadata } = useMetadata();
  const { data: vocabulary } = useVocabulary();
  const myProfileQuery = useMyProfile();
  const myProfile = myProfileQuery?.data;
  const quickAcceptSettings = myProfile?.quick_accept_settings ?? DEFAULT_QUICK_ACCEPT_SETTINGS;
  const { pushAction } = useUndo();

  const masterDetailsById = useMemo(() => {
    return new Map(allItems.map((item) => [item.id, item]));
  }, [allItems]);

  const masterNameById = useMemo(() => {
    return new Map(masterItemNames.map((item) => [item.id, item]));
  }, [masterItemNames]);
  const onListItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of listItems) {
      if (item.item_id) {
        ids.add(item.item_id);
      }
    }
    return ids;
  }, [listItems]);

  const vocab = vocabulary ?? DEFAULT_VOCABULARY;
  const wordAliases = loadedWordAliases ?? new Map<string, string>();
  const storeNamesList = useMemo(() => {
    return (metadata?.stores || []).map((s) => s.name);
  }, [metadata?.stores]);
  const storeNameById = useMemo(() => {
    return new Map((metadata?.stores || []).map((store) => [store.id, store.name]));
  }, [metadata?.stores]);
  const isOnList = (itemId: string | null | undefined): boolean => {
    return !!itemId && onListItemIds.has(itemId);
  };

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

  const emptyParsedQuantity: QuantityParsed = {
    count: null,
    packageType: null,
    packagePlural: null,
    sizeQty: null,
    sizeUnit: null,
    sizeDescriptive: null,
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
    setDuplicateMatch(null);
    setPendingAdd(null);
    setSavedQuery('');
    savedQueryRef.current = '';
    Keyboard.dismiss();
  };

  const dismissDuplicateDialog = () => {
    const restoredQuery = savedQueryRef.current || savedQuery;
    setDuplicateMatch(null);
    setPendingAdd(null);
    setQuery(restoredQuery);
  };

  const maybeOpenDuplicateDialog = (itemId: string | null, name: string, pending: PendingAddDetails): boolean => {
    const match = findDuplicate(itemId, name, listItems);
    if (!match) {
      return false;
    }
    savedQueryRef.current = query;
    setSavedQuery(query);
    setPendingAdd(pending);
    setDuplicateMatch(match);
    return true;
  };

  const getTargetEntry = (match: ListItem) => {
    return (
      match.quantities.find((entry) => !entry.archived_at && !entry.is_purchased) ??
      match.quantities.find((entry) => !entry.archived_at) ??
      null
    );
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

  const duplicateState = useMemo<DuplicateState | null>(() => {
    if (!duplicateMatch) {
      return null;
    }
    return classifyDuplicateState(duplicateMatch, pendingAdd?.storeId ?? null, myProfile?.id ?? null);
  }, [duplicateMatch, pendingAdd?.storeId, myProfile?.id]);

  const targetEntryForDialog = useMemo(() => {
    return duplicateMatch ? getTargetEntry(duplicateMatch) : null;
  }, [duplicateMatch]);

  const duplicateCombineOptions = useMemo(() => {
    if (!duplicateMatch || !pendingAdd || !duplicateState || duplicateState.startsWith('purchased-')) {
      return null;
    }

    const targetEntry = targetEntryForDialog;
    const existingParsed =
      targetEntry?.quantity_parsed ??
      parseQuantityText(targetEntry?.quantity ?? '', vocab) ??
      emptyParsedQuantity;
    const incomingParsed =
      pendingAdd.quantityParsed ??
      parseQuantityText(pendingAdd.quantity, vocab) ??
      emptyParsedQuantity;
    const combined = combineQuantities(existingParsed, incomingParsed);
    if (!combined) {
      return null;
    }

    if (duplicateState === 'active-different-store') {
      return combined.options.filter((option) => option.type === 'sum');
    }

    return combined.options;
  }, [duplicateMatch, pendingAdd, duplicateState, targetEntryForDialog, vocab]);

  const handleDuplicateCombine = async (option: CombineOption, targetStoreId?: string) => {
    if (!duplicateMatch || !pendingAdd) {
      return;
    }

    if (pendingAdd.prepare && !(await pendingAdd.prepare())) {
      return;
    }

    const targetEntry = getTargetEntry(duplicateMatch);
    if (!targetEntry) {
      return;
    }

    const previousQty = targetEntry.quantity;
    const previousQtyParsed = targetEntry.quantity_parsed;
    const previousStoreId = targetEntry.store_id;
    const nextQty = formatQuantity(option.result);
    const shouldMoveStore = !!targetStoreId && targetStoreId !== previousStoreId;

    if (shouldMoveStore) {
      await updateQuantityEntry({ id: targetEntry.id, store_id: targetStoreId });
    }
    await updateQuantityEntry({
      id: targetEntry.id,
      quantity: nextQty,
      quantity_parsed: option.result,
    });

    pushAction({
      label: `Combined ${duplicateMatch.name}`,
      undo: async () => {
        if (shouldMoveStore) {
          await updateQuantityEntry({ id: targetEntry.id, store_id: previousStoreId });
        }
        await updateQuantityEntry({
          id: targetEntry.id,
          quantity: previousQty,
          quantity_parsed: previousQtyParsed,
        });
      },
      redo: async () => {
        if (shouldMoveStore) {
          await updateQuantityEntry({ id: targetEntry.id, store_id: targetStoreId });
        }
        await updateQuantityEntry({
          id: targetEntry.id,
          quantity: nextQty,
          quantity_parsed: option.result,
        });
      },
    });

    clearAndClose();
  };

  const handleDuplicateAddNew = async () => {
    if (!duplicateMatch || !pendingAdd || !duplicateState) {
      return;
    }

    if (pendingAdd.prepare && !(await pendingAdd.prepare())) {
      return;
    }

    if (duplicateState === 'active-different-store') {
      const result = await pendingAdd.forwardAction();
      const tracker = { currentEntryId: result.entry.id };

      pushAction({
        label: `Added ${pendingAdd.name}`,
        undo: async () => {
          await deleteItem({ entryId: tracker.currentEntryId });
        },
        redo: async () => {
          const redone = await pendingAdd.forwardAction();
          tracker.currentEntryId = redone.entry.id;
        },
      });

      clearAndClose();
      return;
    }

    const normalizedQty = normalizeQuantityText(pendingAdd.quantity, pendingAdd.quantityParsed);
    const result = await addQuantityEntry({
      listItemId: duplicateMatch.id,
      quantity: normalizedQty,
      quantityParsed: pendingAdd.quantityParsed,
      storeId: pendingAdd.storeId,
    });
    const tracker = { currentEntryId: result.id as string };

    pushAction({
      label: `Added ${duplicateMatch.name} (${pendingAdd.quantity})`,
      undo: async () => {
        await deleteItem({ entryId: tracker.currentEntryId });
      },
      redo: async () => {
        const redone = await addQuantityEntry({
          listItemId: duplicateMatch.id,
          quantity: normalizedQty,
          quantityParsed: pendingAdd.quantityParsed,
          storeId: pendingAdd.storeId,
        });
        tracker.currentEntryId = redone.id as string;
      },
    });

    clearAndClose();
  };

  const handleDuplicateCustom = async (customQty: string) => {
    if (!duplicateMatch || !pendingAdd) {
      return;
    }

    if (pendingAdd.prepare && !(await pendingAdd.prepare())) {
      return;
    }

    const targetEntry = getTargetEntry(duplicateMatch);
    if (!targetEntry) {
      return;
    }

    const previousQty = targetEntry.quantity;
    const previousQtyParsed = targetEntry.quantity_parsed;
    const parsedCustom = parseQuantityText(customQty, vocab);
    const normalizedQty = normalizeQuantityText(customQty, parsedCustom);

    await updateQuantityEntry({
      id: targetEntry.id,
      quantity: normalizedQty,
      quantity_parsed: parsedCustom,
    });

    pushAction({
      label: `Updated ${duplicateMatch.name}`,
      undo: async () => {
        await updateQuantityEntry({
          id: targetEntry.id,
          quantity: previousQty,
          quantity_parsed: previousQtyParsed,
        });
      },
      redo: async () => {
        await updateQuantityEntry({
          id: targetEntry.id,
          quantity: normalizedQty,
          quantity_parsed: parsedCustom,
        });
      },
    });

    clearAndClose();
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
    const quantityParsed = extractQuantityParsed(interpretation);
    const normalizedQty = normalizeQuantityText(selection.qty, quantityParsed);
    const pendingDetails: PendingAddDetails = {
      itemId: item.id,
      name: item.name,
      quantity: selection.qty,
      quantityParsed,
      storeId: selection.storeId,
      categoryId: item.default_category_id,
      warnings,
      matchMetadata: aliasMatchMetadata(interpretation),
      forwardAction: async () => {
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
      },
    };

    if (maybeOpenDuplicateDialog(item.id, item.name, pendingDetails)) {
      return;
    }

    const result = await pendingDetails.forwardAction();
    const tracker = { currentEntryId: result.entry.id };

    pushAction({
      label: `Added ${name} (${selection.qty})`,
      undo: async () => {
        await deleteItem({ entryId: tracker.currentEntryId });
      },
      redo: async () => {
        const redone = await pendingDetails.forwardAction();
        tracker.currentEntryId = redone.entry.id;
      },
    });

    clearAndClose();
    setTimeout(() => maybeTriggerWarningToast(warnings), 400);
  };

  const onOneOffAdd = async () => {
    const name = parseResult.rawInput;
    const quantityParsed = parseQuantityText(oneOffQty, vocab);
    const normalizedQty = normalizeQuantityText(oneOffQty, quantityParsed);
    const pendingDetails: PendingAddDetails = {
      itemId: null,
      name,
      quantity: oneOffQty,
      quantityParsed,
      storeId: activeStoreId || null,
      categoryId: null,
      warnings: [],
      forwardAction: async () => {
        return await addItem({
          name: parseResult.rawInput,
          item_id: null,
          quantity: normalizedQty,
          quantity_parsed: quantityParsed,
          store_id: activeStoreId || null,
          category_id: null,
          warnings: [],
        });
      },
    };

    if (maybeOpenDuplicateDialog(null, parseResult.rawInput, pendingDetails)) {
      return;
    }

    const result = await pendingDetails.forwardAction();
    const tracker = { currentEntryId: result.entry.id };

    pushAction({
      label: `Added ${name}`,
      undo: async () => {
        await deleteItem({ entryId: tracker.currentEntryId });
      },
      redo: async () => {
        const redone = await pendingDetails.forwardAction();
        tracker.currentEntryId = redone.entry.id;
      },
    });

    clearAndClose();
  };

  const onAcceptTop = async () => {
    if (query.trim().length === 0) {
      return;
    }

    if (rankedInterpretations.length > 0) {
      const topInterpretation = rankedInterpretations[0];
      const topRowKey = getRowKey(topInterpretation, 0);
      const fullItem = topInterpretation.matchedItemId ? masterDetailsById.get(topInterpretation.matchedItemId) : undefined;
      if (fullItem) {
        await onCommitAdd(fullItem, topInterpretation, topRowKey);
        return;
      }
    }

    await onOneOffAdd();
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
    const quantityParsed = parseQuantityText(editQty, vocab);
    const normalizedQty = normalizeQuantityText(editQty, quantityParsed);
    const pendingDetails: PendingAddDetails = {
      itemId: null,
      name: itemName,
      quantity: editQty,
      quantityParsed,
      storeId: editStoreId || null,
      categoryId: editCategoryId || null,
      warnings: [],
      matchMetadata: aliasMatchMetadata(editInterpretation),
      forwardAction: async () => {
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
      },
    };

    if (maybeOpenDuplicateDialog(null, itemName, pendingDetails)) {
      return;
    }

    const result = await pendingDetails.forwardAction();
    const tracker = { currentEntryId: result.entry.id };

    pushAction({
      label: `Added ${itemName}`,
      undo: async () => {
        await deleteItem({ entryId: tracker.currentEntryId });
      },
      redo: async () => {
        const redone = await pendingDetails.forwardAction();
        tracker.currentEntryId = redone.entry.id;
      },
    });

    clearAndClose();
  };

  const onSaveEdited = async () => {
    editQtyInputRef.current?.blur();
    let itemId = selectedItem?.id;
    const itemName = selectedItem?.name || query;

    const warnings = selectedItem?.id
      ? computeWarnings(
          selectedItem.item_store_preferences,
          editStoreId,
          editQty,
          selectedItem.default_qty,
          selectedItem.alternate_qtys
        )
      : [];

    const quantityParsed = parseQuantityText(editQty, vocab);
    const normalizedQty = normalizeQuantityText(editQty, quantityParsed);
    const defaultQtyParsed = parseQuantityText(editQty, vocab);
    const normalizedDefaultQty = normalizeQuantityText(editQty, defaultQtyParsed);
    const ensureMasterItem = async (): Promise<string | null> => {
      if (itemId) {
        return itemId;
      }

      try {
        const newItem = await createMasterItem({
          name: itemName,
          default_qty: normalizedDefaultQty,
          default_qty_parsed: defaultQtyParsed,
          default_category_id: editCategoryId || null,
        });
        itemId = newItem.id;
        return itemId;
      } catch (err) {
        console.error('Failed to create master item:', err);
        return null;
      }
    };
    const pendingDetails: PendingAddDetails = {
      itemId: itemId || null,
      name: itemName,
      quantity: editQty,
      quantityParsed,
      storeId: editStoreId || null,
      categoryId: editCategoryId || null,
      warnings,
      matchMetadata: aliasMatchMetadata(editInterpretation),
      prepare: itemId
        ? undefined
        : async () => {
            const preparedItemId = await ensureMasterItem();
            return preparedItemId !== null;
          },
      forwardAction: async () => {
        const resolvedItemId = itemId ?? (await ensureMasterItem());
        if (!resolvedItemId) {
          throw new Error('Failed to create master item');
        }
        return await addItem({
          name: itemName,
          item_id: resolvedItemId,
          quantity: normalizedQty,
          quantity_parsed: quantityParsed,
          store_id: editStoreId || null,
          category_id: editCategoryId || null,
          warnings,
          match_metadata: aliasMatchMetadata(editInterpretation),
        });
      },
    };

    if (maybeOpenDuplicateDialog(itemId || null, itemName, pendingDetails)) {
      return;
    }

    let result: Awaited<ReturnType<typeof pendingDetails.forwardAction>>;
    try {
      result = await pendingDetails.forwardAction();
    } catch (error) {
      if ((error as Error).message === 'Failed to create master item') {
        return;
      }
      throw error;
    }
    const tracker = { currentEntryId: result.entry.id };

    pushAction({
      label: `Added ${itemName}`,
      undo: async () => {
        await deleteItem({ entryId: tracker.currentEntryId });
      },
      redo: async () => {
        const redone = await pendingDetails.forwardAction();
        tracker.currentEntryId = redone.entry.id;
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

  const { isArmed, handleTextChange, handleSubmitEditing } = useQuickAcceptState({
    triggerWord: quickAcceptSettings.trigger_word,
    armingDelayMs: quickAcceptSettings.arming_delay_ms,
    query,
    onAcceptTop,
  });

  return (
    <View style={[styles.container, disabled && { opacity: 0.6 }]}> 
      <View testID="smart-add-search-bar" style={[styles.searchBar, isArmed && styles.searchBarArmed]}>
        <Search size={20} color={colors.textDisabled} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder={disabled ? 'Loading household...' : 'Add item...'}
          value={query}
          onChangeText={(text) => setQuery(handleTextChange(text))}
          onSubmitEditing={handleSubmitEditing}
          returnKeyType="done"
          placeholderTextColor={colors.textDisabled}
          editable={!disabled}
        />
        {query.length > 0 && !disabled && (
          <TouchableOpacity
            testID="smart-add-clear-button"
            onPress={() => setQuery(handleTextChange(''))}
            style={styles.clearBtn}
          >
            <X size={18} color={colors.textMuted} />
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
              <View
                key={rowKey}
                testID={`smart-add-result-row-${index}`}
                style={[
                  styles.resultRowComplex,
                  index === 0 && styles.topResultHighlight,
                  index === 0 && isArmed && styles.topResultArmed,
                ]}
              >
                <TouchableOpacity
                  testID={`smart-add-result-main-${index}`}
                  style={styles.resultMainSection}
                  activeOpacity={1}
                  onPress={() => onCommitAdd(fullItem, interpretation, rowKey)}
                >
                  <View testID={`smart-add-result-header-${index}`} style={styles.resultHeader}>
                    <View style={styles.resultTitleRow}>
                      <Text style={styles.resultName}>{interpretation.name}</Text>
                      {interpretation.orphans.length > 0 ? (
                        <Text style={styles.orphanText}>{interpretation.orphans.join(' ')}</Text>
                      ) : null}
                      {isOnList(interpretation.matchedItemId) ? (
                        <Text style={styles.onListIndicator}>on list</Text>
                      ) : null}
                    </View>
                  </View>

                  {otherQtyRowKey === rowKey ? (
                    <View style={styles.inlineOtherEditor}>
                      <TextInput
                        style={styles.otherQtyInputInline}
                        value={otherQtyInput}
                        onChangeText={setOtherQtyInput}
                        autoFocus
                        placeholder="e.g. 3 lbs"
                        placeholderTextColor={colors.textDisabled}
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
                    <View testID={`smart-add-result-qty-row-${index}`} style={styles.inlinePillRow}>
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
                </TouchableOpacity>

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
                  <ChevronRight size={20} color={colors.textDisabled} />
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
                    placeholderTextColor={colors.textDisabled}
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
              <ChevronRight size={20} color={colors.primary} />
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
                <X size={24} color={colors.textMuted} />
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
                            { backgroundColor: metadata?.stores?.find((s) => s.id === editStoreId)?.color_code ?? colors.textDisabled },
                          ]}
                        />
                        <Text style={styles.storeNameText}>{metadata?.stores?.find((s) => s.id === editStoreId)?.name ?? ''}</Text>
                      </>
                    ) : (
                      <Text style={styles.dropdownPlaceholder}>No store</Text>
                    )}
                  </View>
                  <ChevronDown size={16} color={colors.textMuted} />
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
                      <Text style={[styles.storeNameText, { color: colors.textDisabled }]}>No store</Text>
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
      <DuplicateResolutionDialog
        match={duplicateMatch}
        incomingName={pendingAdd?.name ?? ''}
        incomingQuantity={pendingAdd?.quantity ?? ''}
        incomingStoreId={pendingAdd?.storeId ?? null}
        combineOptions={duplicateCombineOptions}
        duplicateState={duplicateState ?? 'active-same-store'}
        storeName={targetEntryForDialog?.store?.name}
        incomingStoreName={pendingAdd?.storeId ? storeNameById.get(pendingAdd.storeId) : undefined}
        onCombine={handleDuplicateCombine}
        onAddNew={handleDuplicateAddNew}
        onCustom={handleDuplicateCustom}
        onDismiss={dismissDuplicateDialog}
      />
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    zIndex: 50,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchBarArmed: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primaryBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
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
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDisabled,
  },
  resultRowComplex: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  topResultHighlight: {
    backgroundColor: colors.primarySurface,
  },
  topResultArmed: {
    backgroundColor: colors.primarySurfaceActive,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  resultMainSection: {
    flex: 1,
    padding: 12,
  },
  resultHeader: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: 4,
    paddingRight: 8,
    paddingVertical: 6,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  orphanText: {
    fontSize: 13,
    color: colors.textDisabled,
    textDecorationLine: 'line-through',
  },
  onListIndicator: {
    fontSize: 12,
    color: colors.textDisabled,
    marginLeft: 8,
  },
  pillActiveBlue: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillTextActive: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
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
    color: colors.textDisabled,
    textTransform: 'uppercase',
    width: 40,
  },
  inlinePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inlinePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDisabled,
  },
  unresolvedStoreHint: {
    fontSize: 11,
    color: colors.textDisabled,
    fontWeight: '600',
  },
  inlineOtherEditor: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  otherQtyInputInline: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    height: 32,
  },
  otherCloseButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonSecondary,
  },
  otherCloseText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.buttonSecondaryText,
  },
  otherQtyPopover: {
    marginTop: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  otherQtyInput: {
    fontSize: 13,
    color: colors.textPrimary,
    height: 32,
  },
  resultEditBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 1,
    borderLeftColor: colors.surfaceRaised,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceRaised,
  },
  createMain: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.buttonSecondary,
  },
  createMainButton: {
    paddingVertical: 4,
  },
  createText: {
    color: colors.primary,
    fontWeight: '500',
  },
  createEditBtn: {
    paddingHorizontal: 16,
    height: 48,
    justifyContent: 'center',
    backgroundColor: colors.buttonSecondary,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.modalOverlay,
  },
  modalContent: {
    backgroundColor: colors.surface,
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
    color: colors.textPrimary,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textDisabled,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: colors.surfaceRaised,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
    color: colors.textPrimary,
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
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.inputBorder,
  },
  tagTextActive: {
    color: colors.primaryForeground,
  },
  tagTextInactive: {
    color: colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surfaceRaised,
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
    color: colors.textDisabled,
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
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
    color: colors.textPrimary,
  },
  storeMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.buttonSecondary,
  },
  saveBtn: {
    backgroundColor: colors.primary,
  },
  cancelText: {
    fontWeight: '700',
    color: colors.buttonSecondaryText,
  },
  saveText: {
    fontWeight: '700',
    color: colors.primaryForeground,
  },
});
