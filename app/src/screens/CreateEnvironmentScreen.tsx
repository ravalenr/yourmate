import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../theme';
import type { Environment } from '../types';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'CreateEnvironment'>;

export function CreateEnvironmentScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setError(null);
    setBusy(true);
    try {
      const { environment } = await api.post<{ environment: Environment }>('/environments', {
        name: name.trim(),
      });
      // Replace rather than push, so going back lands on the dashboard instead of
      // this form.
      navigation.replace('Environment', {
        environmentId: environment.id,
        name: environment.name,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the household');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Name your household</Text>
          <Text style={styles.subtitle}>
            You'll get an invite code to share with your housemates.
          </Text>
        </View>

        <ErrorBanner message={error} />

        <TextField
          label="Household name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Flat 2B"
          autoFocus
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />

        <Button
          label="Create household"
          onPress={handleCreate}
          loading={busy}
          disabled={name.trim().length === 0}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl },
  header: { marginBottom: spacing.xl },
  title: typography.heading,
  subtitle: { ...typography.caption, marginTop: spacing.sm, fontSize: 15 },
});
