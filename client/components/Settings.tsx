import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useHousehold } from '@/lib/household';
import {
  useHouseholdMemberColors,
  useHouseholdName,
  useMyProfile,
  useUpdateProfile,
  WarningPreferences,
} from '@/api/profile';
import { useAppTheme } from '@/lib/theme';

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

const DEFAULT_WARNING_PREFS: WarningPreferences = {
  avoided: 'toast_and_badge',
  unavailable: 'toast_and_badge',
  non_preferred: 'badge_only',
  non_standard_qty: 'badge_only',
};

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
  const { isDark, toggleTheme } = useAppTheme();

  const [nameInput, setNameInput] = useState(displayName ?? '');
  const [shortNameInput, setShortNameInput] = useState(displayNameShort ?? '');
  const [selectedColor, setSelectedColor] = useState(avatarColor ?? PROFILE_COLORS[0].hex);
  const [warningPrefs, setWarningPrefs] = useState<WarningPreferences>(DEFAULT_WARNING_PREFS);

  useEffect(() => {
    if (visible) {
      setNameInput(displayName ?? '');
      setShortNameInput(displayNameShort ?? '');
      setSelectedColor(avatarColor ?? PROFILE_COLORS[0].hex);
      setWarningPrefs(myProfile?.warning_preferences ?? DEFAULT_WARNING_PREFS);
    }
  }, [visible, displayName, displayNameShort, avatarColor, myProfile?.warning_preferences]);

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
          <X size={22} color="#111827" />
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
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch testID="settings-dark-mode-switch" value={isDark} onValueChange={toggleTheme} />
        </View>
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
          <ActivityIndicator size="small" color="#2563eb" />
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

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
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
    color: '#111827',
  },
  closeButton: {
    padding: 8,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
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
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 14,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  householdName: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  warningRow: {
    marginBottom: 14,
  },
  warningLabel: {
    fontSize: 14,
    color: '#111827',
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
    backgroundColor: '#2563eb',
  },
  segmentUnselected: {
    backgroundColor: '#f3f4f6',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextSelected: {
    color: '#ffffff',
  },
  segmentTextUnselected: {
    color: '#374151',
  },
});
