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

type Props = NativeStackScreenProps<HomeStackParamList, 'JoinEnvironment'>;

const CODE_LENGTH = 6;

export function JoinEnvironmentScreen({ navigation }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleJoin() {
    setError(null);
    setBusy(true);
    try {
      const { environment } = await api.post<{ environment: Environment }>(
        '/environments/join',
        { inviteCode: code },
      );
      navigation.replace('Environment', {
        environmentId: environment.id,
        name: environment.name,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not join that household');
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
          <Text style={styles.title}>Enter the invite code</Text>
          <Text style={styles.subtitle}>
            Ask a housemate for the six-character code from their household.
          </Text>
        </View>

        <ErrorBanner message={error} />

        <TextField
          label="Invite code"
          value={code}
          // The server accepts any case, but showing it upper-case matches the code
          // people are reading off someone else's screen.
          onChangeText={(text) => setCode(text.toUpperCase().trim())}
          placeholder="ABC123"
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={CODE_LENGTH}
          returnKeyType="done"
          onSubmitEditing={handleJoin}
          style={styles.codeInput}
        />

        <Button
          label="Join household"
          onPress={handleJoin}
          loading={busy}
          disabled={code.length < CODE_LENGTH}
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
  codeInput: {
    fontSize: 24,
    letterSpacing: 6,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
