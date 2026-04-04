import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { DEFAULT_VOCABULARY } from '../lib/vocabulary';
import { Stack, useRouter } from 'expo-router';

const PROFILE_COLOR_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#ea580c',
  '#9333ea',
  '#dc2626',
  '#0d9488',
  '#db2777',
] as const;

export async function pickProfileColor(householdId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('color')
    .eq('household_id', householdId);

  if (error) {
    throw error;
  }

  const usedColors = new Set((data ?? []).map((profile) => profile.color).filter(Boolean));
  const availableColor = PROFILE_COLOR_PALETTE.find((color) => !usedColors.has(color));
  return availableColor ?? '#2563eb';
}

async function seedVocabularyForHousehold(householdId: string): Promise<void> {
  const [unitsResult, packagesResult, sizeDescriptorsResult] = await Promise.all([
    supabase.from('units').insert(
      DEFAULT_VOCABULARY.units.map((entry) => ({
        household_id: householdId,
        canonical: entry.canonical,
        aliases: entry.aliases,
      }))
    ),
    supabase.from('packages').insert(
      DEFAULT_VOCABULARY.packages.map((entry) => ({
        household_id: householdId,
        canonical: entry.canonical,
        aliases: entry.aliases,
      }))
    ),
    supabase.from('size_descriptors').insert(
      DEFAULT_VOCABULARY.sizeDescriptors.map((entry) => ({
        household_id: householdId,
        canonical: entry.canonical,
        aliases: entry.aliases,
      }))
    ),
  ]);

  if (unitsResult.error) throw unitsResult.error;
  if (packagesResult.error) throw packagesResult.error;
  if (sizeDescriptorsResult.error) throw sizeDescriptorsResult.error;
}

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' }); // 'error' or 'success'
  const router = useRouter();

  async function ensureProfile(userId: string) {
    // Check if profile already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (existing) return; // Profile already exists

    const householdMode = process.env.EXPO_PUBLIC_HOUSEHOLD_MODE || 'single';

    if (householdMode === 'single') {
      const { data: hh } = await supabase
        .from('households')
        .select('id')
        .limit(1)
        .single();

      if (hh) {
        const color = await pickProfileColor(hh.id);
        await supabase.from('profiles').insert({
          id: userId,
          household_id: hh.id,
          display_name: email,
          color,
        });
      }
    } else {
      const { data: hh } = await supabase
        .from('households')
        .insert({ name: 'My Household' })
        .select()
        .single();

      if (hh) {
        const color = await pickProfileColor(hh.id);
        await supabase.from('profiles').insert({
          id: userId,
          household_id: hh.id,
          display_name: email,
          color,
        });
        await seedVocabularyForHousehold(hh.id);
      }
    }
  }

  async function signInWithEmail() {
    setLoading(true);
    setMessage({ text: '', type: '' });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else if (data.session) {
      // Ensure profile exists (for pre-migration users)
      await ensureProfile(data.session.user.id);
    }
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    setMessage({ text: '', type: '' });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          // Add metadata if needed
        }
      }
    });

    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else if (data.session) {
      // Auto-logged in — create profile + household assignment
      await ensureProfile(data.session.user.id);
    } else {
      // User created but not logged in (Email confirmation enabled)
      setMessage({ text: 'Account created! Please check your email to verify.', type: 'success' });
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Sign In', headerShown: false }} />
      
      <View style={styles.card}>
        <Text style={styles.title}>Grocery List</Text>
        <Text style={styles.subtitle}>Sign in to sync your list</Text>

        {message.text ? (
          <View style={[styles.messageBox, message.type === 'error' ? styles.errorBox : styles.successBox]}>
            <Text style={message.type === 'error' ? styles.errorText : styles.successText}>
              {message.text}
            </Text>
          </View>
        ) : null}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            onChangeText={setEmail}
            value={email}
            placeholder="email@address.com"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            onChangeText={setPassword}
            value={password}
            secureTextEntry={true}
            placeholder="Password"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={signInWithEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={signUpWithEmail}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f3f4f6', // Light gray bg
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  messageBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  successBox: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  errorText: {
    color: '#991b1b',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  successText: {
    color: '#166534',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563eb', // Blue
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
});
