import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RotateCcw, RotateCw } from 'lucide-react-native';
import { useUndo } from '@/api/undoContext';
import { UserAvatar } from '@/components/UserAvatar';
import type { AppColors } from '@/constants/Colors';
import { useThemeColors } from '@/lib/theme';

export const HeaderActions: React.FC = () => {
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { undoLastAction, redoLastAction, canUndo, canRedo, undoStack, redoStack } = useUndo();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        testID="header-undo-button"
        onPress={undoLastAction}
        disabled={!canUndo}
        style={[styles.button, !canUndo && styles.disabledButton]}
      >
        <RotateCcw size={20} color={canUndo ? colors.primary : colors.textDisabled} />
        {undoStack.length > 0 && (
          <View style={[styles.badge, styles.undoBadge]}>
            <Text style={styles.badgeText}>{undoStack.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        testID="header-redo-button"
        onPress={redoLastAction}
        disabled={!canRedo}
        style={[styles.button, styles.withMargin, !canRedo && styles.disabledButton]}
      >
        <RotateCw size={20} color={canRedo ? colors.primary : colors.textDisabled} />
        {redoStack.length > 0 && (
          <View style={[styles.badge, styles.redoBadge]}>
            <Text style={styles.badgeText}>{redoStack.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.withMargin}>
        <UserAvatar />
      </View>
    </View>
  );
};

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    padding: 8,
    backgroundColor: colors.buttonSecondary,
    borderRadius: 12,
    position: 'relative',
  },
  disabledButton: {
    opacity: 0.3,
  },
  withMargin: {
    marginLeft: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.primaryForeground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoBadge: {
    backgroundColor: colors.undoBadge,
  },
  redoBadge: {
    backgroundColor: colors.redoBadge,
  },
  badgeText: {
    color: colors.primaryForeground,
    fontSize: 9,
    fontWeight: '800',
  },
});
