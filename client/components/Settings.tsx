import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { useHousehold } from '@/lib/household';
import {
  DEFAULT_QUICK_ACCEPT_SETTINGS,
  DEFAULT_WARNING_PREFS,
  type QuickAcceptSettings,
  useHouseholdMemberColors,
  useHouseholdName,
  useMyProfile,
  useUpdateProfile,
  WarningPreferences,
} from '@/api/profile';
import type { AppColors } from '@/constants/Colors';
import type { ThemePreference } from '@/lib/theme';
import { useAppTheme, useThemeColors } from '@/lib/theme';

interface SettingsProps {
  visible: boolean;
  onClose: () => void;
}

export const PROFILE_COLORS = [
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Purple', hex: '#9333ea' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Pink', hex: '#db2777' },
];

const APPEARANCE_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

const WARNING_OPTIONS: Record<string, Array<{ label: string; value: string }>> = {
  avoided: [
    { label: 'Toast + Badge', value: 'toast_and_badge' },
    { label: 'Badge', value: 'badge_only' },
    { label: 'Off', value: 'off' },
  ],
  unavailable: [
    { label: 'Toast + Badge', value: 'toast_and_badge' },
    { label: 'Badge', value: 'badge_only' },
    { label: 'Off', value: 'off' },
  ],
  non_preferred: [
    { label: 'Badge', value: 'badge_only' },
    { label: 'Off', value: 'off' },
  ],
  non_standard_qty: [
    { label: 'Toast + Badge', value: 'toast_and_badge' },
    { label: 'Badge', value: 'badge_only' },
    { label: 'Off', value: 'off' },
  ],
};

export const Settings: React.FC<SettingsProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { displayName, displayNameShort, avatarColor, householdId } = useHousehold();
  const { data: myProfile } = useMyProfile();
  const { data: memberColors = [] } = useHouseholdMemberColors(householdId);
  const { data: householdName, isLoading: isHouseholdNameLoading } = useHouseholdName(householdId);
  const { mutate } = useUpdateProfile();
  const { themePreference, setThemePreference } = useAppTheme();
  const { colors } = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [nameInput, setNameInput] = useState(displayName ?? '');
  const [shortNameInput, setShortNameInput] = useState(displayNameShort ?? '');
  const [selectedColor, setSelectedColor] = useState(avatarColor ?? PROFILE_COLORS[0].hex);
  const [warningPrefs, setWarningPrefs] = useState<WarningPreferences>(DEFAULT_WARNING_PREFS);
  const [triggerWord, setTriggerWord] = useState(DEFAULT_QUICK_ACCEPT_SETTINGS.trigger_word);
  const [armingDelay, setArmingDelay] = useState(String(DEFAULT_QUICK_ACCEPT_SETTINGS.arming_delay_ms));

  useEffect(() => {
    if (visible) {
      const quickAcceptSettings: QuickAcceptSettings = myProfile?.quick_accept_settings ?? DEFAULT_QUICK_ACCEPT_SETTINGS;
      setNameInput(displayName ?? '');
      setShortNameInput(displayNameShort ?? '');
      setSelectedColor(avatarColor ?? PROFILE_COLORS[0].hex);
      setWarningPrefs(myProfile?.warning_preferences ?? DEFAULT_WARNING_PREFS);
      setTriggerWord(quickAcceptSettings.trigger_word);
      setArmingDelay(String(quickAcceptSettings.arming_delay_ms));
    }
  }, [visible, displayName, displayNameShort, avatarColor, myProfile?.warning_preferences, myProfile?.quick_accept_settings]);

  const triggerWordValid = /^[a-zA-Z]+$/.test(triggerWord);

  const colorInUse = useMemo(
    () => memberColors.includes(selectedColor),
    [memberColors, selectedColor]
  );

  const handleSave = () => {
    mutate({
      display_name: nameInput,
      display_name_short: shortNameInput,
      color: selectedColor,
      warning_preferences: warningPrefs,
      quick_accept_settings: {
        trigger_word: triggerWord.toLowerCase().trim(),
        arming_delay_ms: Math.max(500, Math.min(5000, parseInt(armingDelay, 10) || 1500)),
      },
    });
  };

  if (!visible) {
    return null;
  }

  const content = (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.container, { paddingTop: insets.top || 20 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>General</Text>
        <TouchableOpacity testID="settings-close-button" onPress={onClose} style={styles.closeButton}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          testID="settings-display-name-input"
          value={nameInput}
          onChangeText={setNameInput}
          style={styles.input}
        />

        <Text style={styles.label}>Short Name</Text>
        <TextInput
          testID="settings-short-name-input"
          value={shortNameInput}
          onChangeText={setShortNameInput}
          style={styles.input}
        />

        <Text style={styles.label}>Avatar Color</Text>
        <View style={styles.colorRow}>
          {PROFILE_COLORS.map((color) => {
            const isSelected = selectedColor === color.hex;
            return (
              <TouchableOpacity
                key={color.hex}
                testID={`settings-color-${color.hex}`}
                onPress={() => setSelectedColor(color.hex)}
                style={[
                  styles.colorCircle,
                  {
                    backgroundColor: color.hex,
                    borderWidth: 2,
                    borderColor: isSelected ? 'white' : 'transparent',
                  },
                ]}
              />
            );
          })}
        </View>
        {colorInUse ? (
          <Text style={styles.colorWarning}>Another member uses this color</Text>
        ) : null}

        <TouchableOpacity testID="settings-save-button" onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <Text style={styles.sectionSubtitle}>APPEARANCE</Text>
        {APPEARANCE_OPTIONS.map((pref) => (
          <TouchableOpacity
            key={pref}
            testID={`settings-appearance-${pref}`}
            style={styles.appearanceRow}
            onPress={() => setThemePreference(pref)}
          >
            <View>
              <Text style={styles.rowLabel}>
                {pref === 'system' ? 'System' : pref === 'light' ? 'Light' : 'Dark'}
              </Text>
              {pref === 'system' ? (
                <Text style={styles.rowSubtitle}>Follows device setting</Text>
              ) : null}
            </View>
            {themePreference === pref ? (
              <Check
                size={18}
                color={colors.primary}
                testID={`settings-appearance-check-${pref}`}
              />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Accept</Text>
        <Text style={styles.label}>Trigger Word</Text>
        <TextInput
          testID="settings-trigger-word-input"
          value={triggerWord}
          onChangeText={setTriggerWord}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="e.g. enter"
          placeholderTextColor={colors.textDisabled}
        />
        {!triggerWordValid && triggerWord.length > 0 ? (
          <Text style={styles.colorWarning}>Must be a single word (letters only)</Text>
        ) : null}
        <Text style={styles.helperText}>
          Avoid "enter", "tab", "delete" - Android voice may interpret these as key actions.
        </Text>

        <Text style={styles.label}>Arming Delay (ms)</Text>
        <TextInput
          testID="settings-arming-delay-input"
          value={armingDelay}
          onChangeText={setArmingDelay}
          style={styles.input}
          keyboardType="numeric"
          placeholder="1500"
          placeholderTextColor={colors.textDisabled}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Warnings</Text>

        <View style={styles.warningRow}>
          <Text style={styles.warningLabel}>Store Avoidance</Text>
          <View style={styles.segmentedContainer}>
            {WARNING_OPTIONS.avoided.map((option) => {
              const selected = warningPrefs.avoided === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  testID={`warning-pref-avoided-${option.value}`}
                  onPress={() => setWarningPrefs((prev) => ({ ...prev, avoided: option.value as WarningPreferences['avoided'] }))}
                  style={[styles.segment, selected ? styles.segmentSelected : styles.segmentUnselected]}
                >
                  <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : styles.segmentTextUnselected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.warningRow}>
          <Text style={styles.warningLabel}>Store Unavailable</Text>
          <View style={styles.segmentedContainer}>
            {WARNING_OPTIONS.unavailable.map((option) => {
              const selected = warningPrefs.unavailable === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  testID={`warning-pref-unavailable-${option.value}`}
                  onPress={() => setWarningPrefs((prev) => ({ ...prev, unavailable: option.value as WarningPreferences['unavailable'] }))}
                  style={[styles.segment, selected ? styles.segmentSelected : styles.segmentUnselected]}
                >
                  <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : styles.segmentTextUnselected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.warningRow}>
          <Text style={styles.warningLabel}>Non-Preferred Store</Text>
          <View style={styles.segmentedContainer}>
            {WARNING_OPTIONS.non_preferred.map((option) => {
              const selected = warningPrefs.non_preferred === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  testID={`warning-pref-non_preferred-${option.value}`}
                  onPress={() => setWarningPrefs((prev) => ({ ...prev, non_preferred: option.value as WarningPreferences['non_preferred'] }))}
                  style={[styles.segment, selected ? styles.segmentSelected : styles.segmentUnselected]}
                >
                  <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : styles.segmentTextUnselected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.warningRow}>
          <Text style={styles.warningLabel}>Non-Standard Qty</Text>
          <View style={styles.segmentedContainer}>
            {WARNING_OPTIONS.non_standard_qty.map((option) => {
              const selected = warningPrefs.non_standard_qty === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  testID={`warning-pref-non_standard_qty-${option.value}`}
                  onPress={() => setWarningPrefs((prev) => ({ ...prev, non_standard_qty: option.value as WarningPreferences['non_standard_qty'] }))}
                  style={[styles.segment, selected ? styles.segmentSelected : styles.segmentUnselected]}
                >
                  <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : styles.segmentTextUnselected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Household</Text>
        {isHouseholdNameLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.householdName}>{householdName ?? ''}</Text>
        )}
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {content}
    </Modal>
  );
};

const makeStyles = (colors: AppColors) => StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDisabled,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  colorWarning: {
    marginTop: 8,
    color: colors.destructiveText,
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  saveButton: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 14,
  },
  appearanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLabel: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  householdName: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  warningRow: {
    marginBottom: 14,
  },
  warningLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
  },
  segmentedContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segment: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentSelected: {
    backgroundColor: colors.primary,
  },
  segmentUnselected: {
    backgroundColor: colors.surfaceRaised,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextSelected: {
    color: colors.primaryForeground,
  },
  segmentTextUnselected: {
    color: colors.textSecondary,
  },
});
