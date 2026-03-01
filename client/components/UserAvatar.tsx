import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Modal } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useHousehold } from '@/lib/household';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings } from '@/components/Settings';

export const UserAvatar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { displayName, displayNameShort, avatarColor } = useHousehold();
  const [menuVisible, setMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleSignOut = async () => {
    setMenuVisible(false);
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace('/auth');
  };

  const avatarLetter = (displayNameShort?.[0] || displayName?.[0] || '?').toUpperCase();
  const backgroundColor = avatarColor || '#2563eb';

  return (
    <View>
      <TouchableOpacity
        testID="avatar-button"
        style={[styles.avatar, { backgroundColor }]}
        onPress={() => setMenuVisible(true)}
      >
        <Text style={styles.avatarText}>{avatarLetter}</Text>
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          testID="avatar-menu-backdrop"
          style={styles.backdrop}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menu, { top: (insets.top || 20) + 40 }]}>
            <Text style={styles.userName}>{displayName || 'User'}</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setSettingsVisible(true);
              }}
            >
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      {settingsVisible ? (
        <Settings visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menu: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userName: {
    padding: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuItem: {
    padding: 8,
  },
  menuText: {
    fontSize: 14,
    color: '#374151',
  },
  signOutText: {
    fontSize: 14,
    color: '#ef4444',
  },
});
