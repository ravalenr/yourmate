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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in');
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
            <Text style={styles.title}>yourmate</Text>
            <Text style={styles.subtitle}>Share the chores, not the arguments.</Text>
          </View>

          <ErrorBanner message={error} />

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
            textContentType="password"
            placeholder="Your password"
          />

          <Button label="Sign in" onPress={handleSignIn} loading={busy} />

          <Pressable onPress={() => navigation.navigate('SignUp')} style={styles.switch}>
            <Text style={styles.switchText}>
              New here? <Text style={styles.switchLink}>Create an account</Text>
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
  content: { padding: spacing.xl, paddingTop: spacing.xxl, flexGrow: 1, justifyContent: 'center' },
  header: { marginBottom: spacing.xxl },
  title: { ...typography.title, fontSize: 34, color: colors.primary },
  subtitle: { ...typography.caption, marginTop: spacing.sm, fontSize: 15 },
  switch: { marginTop: spacing.xl, alignItems: 'center' },
  switchText: { ...typography.caption, fontSize: 15 },
  switchLink: { color: colors.primary, fontWeight: '600' },
});
