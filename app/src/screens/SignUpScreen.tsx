import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { TextField } from '../components/TextField';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, typography } from '../theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const MIN_PASSWORD_LENGTH = 8;

export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignUp() {
    setError(null);

    // Checked here as well as on the server so the answer is instant.
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    try {
      await signUp(email.trim(), password, displayName.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create your account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Then create a household or join one with an invite code.
            </Text>
          </View>

          <ErrorBanner message={error} />

          <TextField
            label="Your name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            placeholder="How housemates will see you"
          />

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />

          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            placeholder="At least 8 characters"
            hint="There's no password reset yet, so pick something you'll remember."
          />

          <Button label="Create account" onPress={handleSignUp} loading={busy} />

          <Pressable onPress={() => navigation.goBack()} style={styles.switch}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchLink}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  header: { marginBottom: spacing.xl },
  title: typography.title,
  subtitle: { ...typography.caption, marginTop: spacing.sm, fontSize: 15 },
  switch: { marginTop: spacing.xl, alignItems: 'center' },
  switchText: { ...typography.caption, fontSize: 15 },
  switchLink: { color: colors.primary, fontWeight: '600' },
});
