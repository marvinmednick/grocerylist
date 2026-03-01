import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useHousehold } from '@/lib/household';
import { useHouseholdMemberColors, useHouseholdName, useUpdateProfile } from '@/api/profile';
import { useAppTheme } from '@/lib/theme';

interface SettingsProps {
  visible: boolean;
  onClose: () => void;
  renderInline?: boolean;
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

export const Settings: React.FC<SettingsProps> = ({ visible, onClose, renderInline = false }) => {
  const { displayName, displayNameShort, avatarColor, householdId } = useHousehold();
  const { data: memberColors = [] } = useHouseholdMemberColors(householdId);
  const { data: householdName, isLoading: isHouseholdNameLoading } = useHouseholdName(householdId);
  const { mutate } = useUpdateProfile();
  const { isDark, toggleTheme } = useAppTheme();

  const [nameInput, setNameInput] = useState(displayName ?? '');
  const [shortNameInput, setShortNameInput] = useState(displayNameShort ?? '');
  const [selectedColor, setSelectedColor] = useState(avatarColor ?? PROFILE_COLORS[0].hex);

  useEffect(() => {
    if (visible) {
      setNameInput(displayName ?? '');
      setShortNameInput(displayNameShort ?? '');
      setSelectedColor(avatarColor ?? PROFILE_COLORS[0].hex);
    }
  }, [visible, displayName, displayNameShort, avatarColor]);

  const colorInUse = useMemo(
    () => memberColors.includes(selectedColor),
    [memberColors, selectedColor]
  );

  const handleSave = () => {
    mutate({
      display_name: nameInput,
      display_name_short: shortNameInput,
      color: selectedColor,
    });
  };

  if (!visible && !renderInline) {
    return null;
  }

  const content = (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
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
        <Text style={styles.sectionTitle}>Household</Text>
        {isHouseholdNameLoading ? (
          <ActivityIndicator size="small" color="#2563eb" />
        ) : (
          <Text style={styles.householdName}>{householdName ?? ''}</Text>
        )}
      </View>
    </View>
  );

  if (renderInline) {
    return content;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 20,
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
});
