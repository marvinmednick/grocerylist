import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, Platform, Pressable, KeyboardAvoidingView, ScrollView } from 'react-native';
import { CheckCircle2, Circle, Archive, RotateCcw, RotateCw, Trash2, GripVertical, ShoppingCart, Pencil, Check, X, ChevronDown } from 'lucide-react-native';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { SmartAddItem } from '@/components/SmartAddItem';
import { useShoppingList, useTogglePurchased, useUpdateListItemFields, useUpdateQuantityEntry, useAddToList, useEndTrip, useDeleteListItem, useRevertArchival, ListItem, QuantityEntry } from '@/api/list';
import { computeWarnings, useItemById } from '@/api/items';
import { useUndo } from '@/api/undoContext';
import { useMetadata } from '@/api/metadata';
import { useHouseholdMembers } from '@/api/profile';
import { Toast } from '@/components/Toast';
import { WarningBadge } from '@/components/WarningBadge';
import { WarningCallout } from '@/components/WarningCallout';
import { StoreSelector } from '@/components/StoreSelector';
import { useHousehold } from '@/lib/household';
import { loadActiveStoreId, saveActiveStoreId } from '@/lib/activeStore';
import { UserAvatar } from '@/components/UserAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MultiTripModal, TripUser } from '@/components/MultiTripModal';
import type { AppColors } from '@/constants/Colors';
import { useThemeColors } from '@/lib/theme';

type FlatListItem =
  | { type: 'header'; id: string; title: string; storeId: string; entries: Array<{ parent: ListItem; entry: QuantityEntry }> }
  | { type: 'item'; id: string; data: { parent: ListItem; entry: QuantityEntry } };

interface MultiTripContextState {
  storeId?: string;
  storeName: string;
  users: TripUser[];
}

export default function ShoppingListScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { householdId, userId, avatarColor, isLoading: isHouseholdLoading } = useHousehold();
  const { data: members = [] } = useHouseholdMembers(householdId);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: 'default' | 'warning' }>({
    visible: false,
    message: '',
    variant: 'default',
  });
  const [interactionMode, setInteractionMode] = useState<'shopping' | 'planning'>('shopping');
  const [isMultiTripModalVisible, setIsMultiTripModalVisible] = useState(false);
  const [multiTripContext, setMultiTripContext] = useState<MultiTripContextState | null>(null);
  const [activeStoreId, setActiveStoreId] = useState('');

  const handleRemoteChange = useCallback((event: string, itemName?: string) => {
    let message = 'List updated';
    if (event === 'INSERT' && itemName) {
      message = `${itemName} was added to the list`;
    } else if (event === 'DELETE' && itemName) {
      message = `${itemName} was removed from the list`;
    } else if (event === 'UPDATE' && itemName) {
      message = `${itemName} was updated`;
    }
    setToast({ visible: true, message, variant: 'default' });
  }, []);

  const { data: listItems, isLoading } = useShoppingList(handleRemoteChange);
  const { mutateAsync: togglePurchased } = useTogglePurchased();
  const { mutateAsync: updateListItemFields } = useUpdateListItemFields();
  const { mutateAsync: updateQuantityEntry } = useUpdateQuantityEntry();
  const { mutateAsync: addItem } = useAddToList();
  const { mutateAsync: endTrip } = useEndTrip();
  const { mutateAsync: deleteItem } = useDeleteListItem();
  const { mutateAsync: revertArchival } = useRevertArchival();
  
  const { undoLastAction, redoLastAction, pushAction, canUndo, canRedo, undoStack, redoStack } = useUndo();
  const { data: metadata } = useMetadata();

  const [lastTripId, setLastTripId] = useState<string | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingParent, setEditingParent] = useState<ListItem | null>(null);
  const [editingEntry, setEditingEntry] = useState<QuantityEntry | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editQtyChips, setEditQtyChips] = useState<string[]>([]);
  const [editStoreId, setEditStoreId] = useState('');
  const [editStoreDropdownOpen, setEditStoreDropdownOpen] = useState(false);
  const editMasterItemId = isEditModalVisible && editingParent?.item_id ? editingParent.item_id : null;
  const { data: editMasterItem } = useItemById(editMasterItemId);
  const editWarnings = editMasterItem
    ? computeWarnings(
        editMasterItem.item_store_preferences,
        editStoreId,
        editQty,
        editMasterItem.default_qty,
        editMasterItem.alternate_qtys
      )
    : [];
  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  useEffect(() => {
    if (!metadata?.stores?.length) return;

    let isMounted = true;
    const initializeActiveStore = async () => {
      const savedStoreId = await loadActiveStoreId();
      if (!isMounted) return;

      const resolvedStoreId =
        savedStoreId && metadata.stores.some((store) => store.id === savedStoreId)
          ? savedStoreId
          : metadata.stores[0].id;

      setActiveStoreId((currentId) => {
        if (currentId && metadata.stores.some((store) => store.id === currentId)) {
          return currentId;
        }
        return resolvedStoreId;
      });

      if (savedStoreId !== resolvedStoreId) {
        await saveActiveStoreId(resolvedStoreId);
      }
    };

    initializeActiveStore();

    return () => {
      isMounted = false;
    };
  }, [metadata?.stores]);

  const handleStoreChange = useCallback((storeId: string) => {
    setActiveStoreId(storeId);
    saveActiveStoreId(storeId);
  }, []);

  useEffect(() => {
    if (lastTripId) {
      const timer = setTimeout(() => setLastTripId(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [lastTripId]);

  const flatData = useMemo(() => {
    if (!listItems) return [];
    const groups: Record<string, { id: string; title: string; entries: Array<{ parent: ListItem; entry: QuantityEntry }> }> = {};
    listItems.forEach((parent) => {
      parent.quantities.forEach((entry) => {
        const storeId = entry.store_id || 'other';
        const storeName = entry.store?.name || 'Other';
        const groupKey = `${storeId}:${storeName}`;
        if (!groups[groupKey]) {
          groups[groupKey] = { id: storeId, title: storeName, entries: [] };
        }
        groups[groupKey].entries.push({ parent, entry });
      });
    });
    const result: FlatListItem[] = [];
    Object.values(groups).forEach(({ id, title, entries }) => {
      result.push({ type: 'header', id: `header-${id}`, title, storeId: id, entries });
      entries.forEach(({ parent, entry }) => {
        result.push({
          type: 'item',
          id: entry.id,
          data: { parent, entry },
        });
      });
    });
    return result;
  }, [listItems]);

  // localFlatData drives DraggableFlatList. It is updated synchronously in onDragEnd
  // so the list re-renders correctly immediately after a cross-store drag (before the
  // React Query refetch arrives). When the server data comes back, we sync back via
  // the derived-state-during-render pattern (no useEffect, no extra async render).
  const [localFlatData, setLocalFlatData] = useState<FlatListItem[]>(() => flatData);
  const prevFlatDataRef = useRef(flatData);
  if (prevFlatDataRef.current !== flatData) {
    prevFlatDataRef.current = flatData;
    setLocalFlatData(flatData);
  }

  const handleToggle = async (parent: ListItem, entry: QuantityEntry) => {
    const newStatus = !entry.is_purchased;
    const originalPurchasedBy = entry.purchased_by;
    await togglePurchased({ id: entry.id, is_purchased: newStatus });
    pushAction({
      label: `${newStatus ? 'Checked' : 'Unchecked'} ${parent.name}`,
      undo: async () => {
        await togglePurchased({
          id: entry.id,
          is_purchased: !newStatus,
          purchased_by_override: originalPurchasedBy,
        });
      },
      redo: async () => { await togglePurchased({ id: entry.id, is_purchased: newStatus }); }
    });
  };

  const openEditModal = (parent: ListItem, entry: QuantityEntry) => {
    const masterDefaultQty = parent.master_item?.default_qty ?? null;
    const masterAltQtys = parent.master_item?.alternate_qtys ?? [];
    const chips = masterDefaultQty
      ? [masterDefaultQty, ...masterAltQtys]
      : masterAltQtys;
    setEditingParent(parent);
    setEditingEntry(entry);
    setEditName(parent.name);
    setEditQty(entry.quantity || '');
    setEditQtyChips(chips);
    setEditStoreId(entry.store_id || '');
    setEditStoreDropdownOpen(false);
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingParent || !editingEntry) return;
    const parentSnapshot = {
      name: editingParent.name,
      category_id: editingParent.category_id,
    };
    const parentUpdates = {
      name: editName,
      category_id: editingParent.category_id,
    };
    const entrySnapshot = {
      quantity: editingEntry.quantity,
      store_id: editingEntry.store_id,
    };
    const entryUpdates = {
      quantity: editQty || null,
      store_id: editStoreId || null,
    };
    const quantityChanged = entrySnapshot.quantity !== entryUpdates.quantity;
    const storeChanged = entrySnapshot.store_id !== entryUpdates.store_id;
    const entryForwardUpdate = {
      ...(quantityChanged ? { quantity: entryUpdates.quantity } : {}),
      ...(storeChanged ? { store_id: entryUpdates.store_id } : {}),
    };
    const entryUndoUpdate = {
      ...(quantityChanged ? { quantity: entrySnapshot.quantity } : {}),
      ...(storeChanged ? { store_id: entrySnapshot.store_id } : {}),
    };
    const parentChanged =
      parentSnapshot.name !== parentUpdates.name ||
      parentSnapshot.category_id !== parentUpdates.category_id;
    const entryChanged = quantityChanged || storeChanged;

    if (!parentChanged && !entryChanged) {
      setIsEditModalVisible(false);
      setEditingParent(null);
      setEditingEntry(null);
      return;
    }

    if (parentChanged) {
      await updateListItemFields({ id: editingParent.id, ...parentUpdates });
    }
    if (entryChanged) {
      await updateQuantityEntry({ id: editingEntry.id, ...entryForwardUpdate });
    }

    pushAction({
      label: `Edited ${editingParent.name}`,
      undo: async () => {
        if (parentChanged) {
          await updateListItemFields({ id: editingParent.id, ...parentSnapshot });
        }
        if (entryChanged) {
          await updateQuantityEntry({ id: editingEntry.id, ...entryUndoUpdate });
        }
      },
      redo: async () => {
        if (parentChanged) {
          await updateListItemFields({ id: editingParent.id, ...parentUpdates });
        }
        if (entryChanged) {
          await updateQuantityEntry({ id: editingEntry.id, ...entryForwardUpdate });
        }
      }
    });
    setIsEditModalVisible(false);
    setEditingParent(null);
    setEditingEntry(null);
  };

  const handleDelete = async () => {
    if (!editingParent || !editingEntry) return;
    const parentToDelete = { ...editingParent };
    const entryToDelete = { ...editingEntry };
    const deleteResult = await deleteItem({ entryId: entryToDelete.id });
    const tracker = {
      currentEntryId: deleteResult.entryId,
      currentListItemId: deleteResult.listItemId,
      parentDeleted: deleteResult.parentDeleted,
    };
    pushAction({
      label: `Deleted ${parentToDelete.name}`,
      undo: async () => {
        const result = await addItem({
          name: parentToDelete.name,
          quantity: entryToDelete.quantity ?? undefined,
          store_id: entryToDelete.store_id,
          category_id: parentToDelete.category_id,
          item_id: parentToDelete.item_id,
          warnings: parentToDelete.warnings,
          match_metadata: parentToDelete.match_metadata,
        });
        tracker.currentEntryId = result.entry.id;
        tracker.currentListItemId = result.parent.id;
      },
      redo: async () => {
        const deleted = await deleteItem({ entryId: tracker.currentEntryId });
        tracker.currentEntryId = deleted.entryId;
        tracker.currentListItemId = deleted.listItemId;
        tracker.parentDeleted = deleted.parentDeleted;
      }
    });
    setIsEditModalVisible(false);
    setEditingParent(null);
    setEditingEntry(null);
  };

  const renderCheckbox = (entry: QuantityEntry) => {
    if (!entry.is_purchased) {
      return <Circle size={24} color={colors.inputBorder} />;
    }

    if (entry.purchased_by && entry.purchased_by !== userId) {
      const purchaser = memberMap.get(entry.purchased_by);
      return (
        <View
          testID={`other-user-checkbox-${entry.id}`}
          style={[styles.otherUserPurchasedBadge, { backgroundColor: purchaser?.color ?? colors.textMuted }]}
        >
          <Check size={14} color={colors.primaryForeground} />
        </View>
      );
    }

    return <CheckCircle2 size={24} color={avatarColor ?? colors.primary} />;
  };

  const handleEndTrip = (storeId?: string, storeName?: string) => {
    const title = storeName ? `End Trip at ${storeName}?` : 'End All Shopping Trips?';
    const scopedPurchasedItems = (listItems ?? []).flatMap((parent) =>
      parent.quantities
        .filter((entry) => {
          if (!entry.is_purchased || entry.archived_at) return false;
          if (!storeId) return true;
          if (storeId === 'other') return !entry.store_id;
          return entry.store_id === storeId;
        })
        .map((entry) => ({ parent, entry }))
    );

    const purchaserCounts = new Map<string, number>();
    let hasNullPurchaser = false;
    scopedPurchasedItems.forEach(({ entry }) => {
      if (!entry.purchased_by) {
        hasNullPurchaser = true;
        return;
      }
      purchaserCounts.set(entry.purchased_by, (purchaserCounts.get(entry.purchased_by) ?? 0) + 1);
    });

    if (purchaserCounts.size === 0 && !hasNullPurchaser) {
      return;
    }

    const doEndTrip = async () => {
      try {
        const result = await endTrip({ store_id: storeId === 'other' ? undefined : storeId });
        if (result?.trip?.id) {
          const tripTracker = { currentId: result.trip.id };
          pushAction({
            label: `Ended trip ${storeName || 'All'}`,
            undo: async () => { await revertArchival({ trip_id: tripTracker.currentId }); },
            redo: async () => {
              const r = await endTrip({ store_id: storeId === 'other' ? undefined : storeId });
              if (r?.trip?.id) {
                tripTracker.currentId = r.trip.id;
              }
            }
          });
        }
      } catch (err) {
        console.error('Failed to end trip:', err);
      }
    };

    if (purchaserCounts.size >= 2) {
      const users: TripUser[] = Array.from(purchaserCounts.entries()).map(([purchaserId, itemCount]) => {
        const member = memberMap.get(purchaserId);
        const fallbackName = purchaserId;
        return {
          userId: purchaserId,
          displayName: member?.display_name || fallbackName,
          displayNameShort: member?.display_name_short || null,
          color: member?.color || colors.textMuted,
          itemCount,
        };
      });

      setMultiTripContext({
        storeId,
        storeName: storeName ?? 'All Stores',
        users,
      });
      setIsMultiTripModalVisible(true);
      return;
    }

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\nThis will archive all purchased items.`)) {
        doEndTrip();
      }
    } else {
      Alert.alert(title, 'This will archive all purchased items.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Trip', style: 'destructive', onPress: doEndTrip },
      ]);
    }
  };

  const handleEndSelectedTrips = async (selectedUserIds: string[]) => {
    if (!multiTripContext || selectedUserIds.length === 0) {
      return;
    }

    const resolvedStoreId = multiTripContext.storeId === 'other' ? undefined : multiTripContext.storeId;
    const endedStoreName = multiTripContext.storeName;

    try {
      const tripResults = await Promise.all(
        selectedUserIds.map((selectedUserId) =>
          endTrip({
            store_id: resolvedStoreId,
            user_id: selectedUserId,
          })
        )
      );
      let tripIds = tripResults.map((result) => result?.trip?.id).filter(Boolean) as string[];

      if (tripIds.length > 0) {
        pushAction({
          label: `Ended ${selectedUserIds.length} trips at ${endedStoreName}`,
          undo: async () => {
            await Promise.all(tripIds.map((tripId) => revertArchival({ trip_id: tripId })));
          },
          redo: async () => {
            const redoResults = await Promise.all(
              selectedUserIds.map((selectedUserId) =>
                endTrip({
                  store_id: resolvedStoreId,
                  user_id: selectedUserId,
                })
              )
            );
            tripIds = redoResults.map((result) => result?.trip?.id).filter(Boolean) as string[];
          },
        });
      }
    } catch (err) {
      console.error('Failed to end selected trips:', err);
    } finally {
      setIsMultiTripModalVisible(false);
      setMultiTripContext(null);
    }
  };

  const onDragEnd = async ({ data, from, to }: { data: FlatListItem[], from: number, to: number }) => {
    setLocalFlatData(data);
    const draggedItem = data[to];
    if (draggedItem.type !== 'item') return;
    let newStoreId = '';
    let newStoreName = '';
    for (let i = to; i >= 0; i--) {
      if (data[i].type === 'header') {
        const h = data[i] as FlatListItem & { type: 'header' };
        newStoreId = h.storeId;
        newStoreName = h.title;
        break;
      }
    }
    const draggedParent = draggedItem.data.parent;
    const draggedEntry = draggedItem.data.entry;
    if (newStoreId && newStoreId !== (draggedEntry.store_id ?? 'other')) {
      const originalStoreId = draggedEntry.store_id;
      const entryId = draggedEntry.id;
      const itemName = draggedParent.name;
      await updateQuantityEntry({ id: entryId, store_id: newStoreId === 'other' ? null : newStoreId });
      pushAction({
        label: `Moved ${itemName} to ${newStoreName}`,
        undo: async () => { await updateQuantityEntry({ id: entryId, store_id: originalStoreId }); },
        redo: async () => { await updateQuantityEntry({ id: entryId, store_id: newStoreId === 'other' ? null : newStoreId }); }
      });
    }
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<FlatListItem>) => {
    if (item.type === 'header') {
      const hasPurchased = item.entries.some(({ entry }) => entry.is_purchased);
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
          {hasPurchased && (
            <TouchableOpacity 
              onPress={() => handleEndTrip(item.storeId, item.title)} 
              style={[styles.inlineEndTripBtn, isHouseholdLoading && { opacity: 0.5 }]}
              disabled={isHouseholdLoading}
            >
              <Archive size={14} color={colors.primary} />
              <Text style={styles.inlineEndTripText}>End Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    const parent = item.data.parent;
    const entry = item.data.entry;
    const secondaryParts = [
      entry.quantity,
      parent.category?.name,
      entry.store?.name,
    ].filter(Boolean);
    const secondaryText = secondaryParts.join(' · ');
    const displayName = parent.master_item?.short_name || parent.name;

    if (interactionMode === 'shopping') {
      return (
        <ScaleDecorator>
          <View style={[styles.itemRow, isActive && styles.itemRowActive]}>
            <TouchableOpacity
              style={styles.colCheckbox}
              onPress={() => handleToggle(parent, entry)}
              testID={`checkbox-${entry.id}`}
            >
              {renderCheckbox(entry)}
            </TouchableOpacity>
            <Pressable
              style={styles.shoppingPressable}
              onPress={() => handleToggle(parent, entry)}
              onLongPress={() => openEditModal(parent, entry)}
              testID={`item-pressable-${entry.id}`}
            >
              <View style={styles.textContent}>
                <Text style={[styles.nameText, entry.is_purchased && styles.strikethrough]} numberOfLines={1}>
                  {displayName}
                </Text>
                {secondaryText ? (
                  <Text style={styles.secondaryText} numberOfLines={1}>
                    {secondaryText}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            {parent.warnings?.length ? (
              <WarningBadge warnings={parent.warnings} />
            ) : null}
            <TouchableOpacity onLongPress={drag} delayLongPress={50} style={styles.dragHandle}>
              <GripVertical size={20} color={colors.inputBorder} />
            </TouchableOpacity>
          </View>
        </ScaleDecorator>
      );
    }

    return (
      <ScaleDecorator>
        <View style={[styles.itemRow, isActive && styles.itemRowActive]}>
          <TouchableOpacity
            style={styles.colCheckbox}
            onPress={() => handleToggle(parent, entry)}
            testID={`checkbox-${entry.id}`}
          >
            {renderCheckbox(entry)}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.planningTextPressable}
            onPress={() => openEditModal(parent, entry)}
            testID={`name-${entry.id}`}
          >
            <View style={styles.textContent}>
              <Text style={[styles.nameText, entry.is_purchased && styles.strikethrough]} numberOfLines={1}>
                {displayName}
              </Text>
              {secondaryText ? (
                <Text style={styles.secondaryText} numberOfLines={1}>
                  {secondaryText}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
          {parent.warnings?.length ? (
            <WarningBadge warnings={parent.warnings} />
          ) : null}
          <TouchableOpacity onLongPress={drag} delayLongPress={50} style={styles.dragHandle}>
            <GripVertical size={20} color={colors.inputBorder} />
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.globalHeader, { paddingTop: insets.top || 20 }]}>
        <StoreSelector activeStoreId={activeStoreId} onStoreChange={handleStoreChange} />
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => setInteractionMode(interactionMode === 'shopping' ? 'planning' : 'shopping')}
            style={styles.headerActionBtn}
            testID="mode-toggle"
          >
            {interactionMode === 'shopping' ? (
              <View testID="cart-icon-container">
                <ShoppingCart size={20} color={colors.primary} />
              </View>
            ) : (
              <View testID="pencil-icon-toggle-container">
                <Pencil size={20} color={colors.primary} />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={undoLastAction} disabled={!canUndo} style={[styles.headerActionBtn, !canUndo && { opacity: 0.3 }, { marginLeft: 12 }]}>
            <RotateCcw size={20} color={canUndo ? colors.primary : colors.textDisabled} />
            {undoStack.length > 0 && <View style={[styles.badge, styles.undoBadge]}><Text style={styles.badgeText}>{undoStack.length}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity onPress={redoLastAction} disabled={!canRedo} style={[styles.headerActionBtn, !canRedo && { opacity: 0.3 }, { marginLeft: 12 }]}>
            <RotateCw size={20} color={canRedo ? colors.primary : colors.textDisabled} />
            {redoStack.length > 0 && <View style={[styles.badge, styles.redoBadge]}><Text style={styles.badgeText}>{redoStack.length}</Text></View>}
          </TouchableOpacity>
          <View style={{ marginLeft: 12 }}>
            <UserAvatar />
          </View>
        </View>
      </View>
      <View style={styles.headerContainer}>
        <SmartAddItem
          disabled={isHouseholdLoading}
          activeStoreId={activeStoreId}
          listItems={listItems ?? []}
          onWarningToast={(message) => {
            setToast({ visible: true, message, variant: 'warning' });
          }}
        />
      </View>
      {isLoading || isHouseholdLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <View style={{ flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
          <DraggableFlatList
            data={localFlatData}
            onDragEnd={onDragEnd}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            activationDistance={5}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>Your list is empty.</Text></View>}
            ListFooterComponent={() => {
              const hasAnyPurchased = listItems?.some((parent) => parent.quantities.some((entry) => entry.is_purchased));
              if (!hasAnyPurchased) return null;
              return (
                <TouchableOpacity 
                  style={[styles.globalEndTripBtn, isHouseholdLoading && { opacity: 0.5 }]} 
                  onPress={() => handleEndTrip()}
                  disabled={isHouseholdLoading}
                >
                  <Archive size={20} color={colors.primaryForeground} />
                  <Text style={styles.globalEndTripText}>End All Shopping Trips</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
      <Modal visible={isEditModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity testID="modal-delete-button" onPress={handleDelete} style={styles.deleteBtn}><Trash2 size={20} color={colors.destructiveText} /></TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Item</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)} style={styles.modalCloseBtn}><X size={20} color={colors.textMuted} /></TouchableOpacity>
            </View>
            {editingParent?.item_id ? (
              <WarningCallout warnings={editWarnings} />
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.modalInput} value={editName} onChangeText={setEditName} />
              <Text style={styles.label}>Quantity</Text>
              <TextInput style={styles.modalInput} value={editQty} onChangeText={setEditQty} />
              {editQtyChips.length > 0 ? (
                <View style={styles.usualQtySection}>
                  <Text style={styles.label}>Usual Quantities</Text>
                  <View style={styles.tagsContainer}>
                    {editQtyChips.map((chip) => (
                      <TouchableOpacity
                        key={chip}
                        onPress={() => setEditQty(chip)}
                        style={[styles.tag, editQty === chip ? styles.tagActive : styles.tagInactive]}
                      >
                        <Text style={editQty === chip ? styles.tagTextActive : styles.tagTextInactive}>
                          {chip}
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
                        <Text style={styles.storeNameText}>
                          {metadata?.stores?.find((s) => s.id === editStoreId)?.name ?? ''}
                        </Text>
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
                      <Text style={[styles.storeNameText, { color: colors.textDisabled }]}>— No store —</Text>
                    </TouchableOpacity>
                    {metadata?.stores?.map((store) => (
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
                  </View>
                ) : null}
              </View>
            </ScrollView>
            <View style={[styles.modalActions, { paddingBottom: insets.bottom }]}>
              <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setIsEditModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={handleSaveEdit}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Toast
        message={toast.message}
        visible={toast.visible}
        variant={toast.variant}
        onDismiss={() => setToast({ visible: false, message: '', variant: 'default' })}
      />
      <MultiTripModal
        visible={isMultiTripModalVisible}
        storeName={multiTripContext?.storeName ?? 'All Stores'}
        users={multiTripContext?.users ?? []}
        onConfirm={handleEndSelectedTrips}
        onCancel={() => {
          setIsMultiTripModalVisible(false);
          setMultiTripContext(null);
        }}
      />
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  globalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionBtn: { padding: 8, backgroundColor: colors.buttonSecondary, borderRadius: 12, position: 'relative' },
  badge: { position: 'absolute', top: -4, right: -4, borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.primaryForeground },
  undoBadge: { backgroundColor: colors.undoBadge },
  redoBadge: { backgroundColor: colors.redoBadge },
  badgeText: { color: colors.primaryForeground, fontSize: 9, fontWeight: '800' },
  headerContainer: { paddingTop: 8, paddingBottom: 8, backgroundColor: colors.background, zIndex: 10, width: '100%', maxWidth: 600, alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 100 },
  sectionHeader: { height: 32, backgroundColor: colors.surfaceRaised, paddingHorizontal: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderText: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemRow: { minHeight: 48, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, width: '100%' },
  itemRowActive: { backgroundColor: colors.buttonSecondary, elevation: 5, zIndex: 100 },
  shoppingPressable: { flex: 1, justifyContent: 'center' },
  planningTextPressable: { flex: 1, justifyContent: 'center' },
  colCheckbox: { marginRight: 12, width: 32, alignItems: 'center' },
  textContent: { flex: 1, marginRight: 8 },
  nameText: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  secondaryText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  strikethrough: { textDecorationLine: 'line-through', color: colors.textDisabled },
  dragHandle: { paddingHorizontal: 8, justifyContent: 'center' },
  inlineEndTripBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.buttonSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  inlineEndTripText: { fontSize: 11, fontWeight: '700', color: colors.primary, marginLeft: 4 },
  globalEndTripBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, margin: 20, padding: 16, borderRadius: 16, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  globalEndTripText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 16, marginLeft: 8 },
  emptyContainer: { padding: 32, alignItems: 'center', marginTop: 40 },
  emptyText: { color: colors.textDisabled, fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: colors.modalOverlay },
  modalContent: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalCloseBtn: { padding: 8 },
  deleteBtn: { padding: 8, backgroundColor: colors.destructiveSurface, borderRadius: 8 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textDisabled, marginBottom: 8, textTransform: 'uppercase' },
  modalInput: { backgroundColor: colors.surfaceRaised, padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16, color: colors.textPrimary },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  usualQtySection: { marginBottom: 16 },
  tag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  tagActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagInactive: { backgroundColor: colors.surface, borderColor: colors.inputBorder },
  tagTextActive: { color: colors.primaryForeground, fontWeight: '600' },
  tagTextInactive: { color: colors.textSecondary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
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
  actionBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.buttonSecondary },
  saveBtn: { backgroundColor: colors.primary },
  cancelText: { fontWeight: '700', color: colors.buttonSecondaryText },
  saveText: { fontWeight: '700', color: colors.primaryForeground },
  otherUserPurchasedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
