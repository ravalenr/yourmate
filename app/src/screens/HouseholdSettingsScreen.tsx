import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../auth/AuthContext';
import { useEnvironment } from '../hooks/useEnvironments';
import { colors, spacing, typography } from '../theme';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Settings'>;

export function HouseholdSettingsScreen({ route, navigation }: Props) {
  const { environmentId } = route.params;
  const { user } = useAuth();
  const { environment, loading, error, refetch } = useEnvironment(environmentId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner = environment?.role === 'owner';

  async function regenerateCode() {
    setActionError(null);
    setBusy(true);
    try {
      await api.post(`/environments/${environmentId}/invite-code`);
      await refetch();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Could not make a new code');
    } finally {
      setBusy(false);
    }
  }

  function confirmLeave() {
    Alert.alert(
      `Leave ${environment?.name}?`,
      isOwner
        ? 'The longest-standing housemate becomes the owner.'
        : 'You can rejoin later with the invite code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/environments/${environmentId}/members/${user?.id}`);
              navigation.popToTop();
            } catch (caught) {
              setActionError(caught instanceof Error ? caught.message : 'Could not leave');
            }
          },
        },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert(
      `Delete ${environment?.name}?`,
      'Every task and notification in this household goes with it. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/environments/${environmentId}`);
              navigation.popToTop();
            } catch (caught) {
              setActionError(caught instanceof Error ? caught.message : 'Could not delete it');
            }
          },
        },
      ],
    );
  }

  if (loading && !environment) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ErrorBanner message={actionError ?? error} />

      <Text style={styles.sectionTitle}>Invite code</Text>
      <Card>
        <Text style={styles.code}>{environment?.inviteCode}</Text>
        <Text style={styles.codeHint}>
          Share this so a housemate can join. It's not case-sensitive.
        </Text>
        {isOwner ? (
          <Button
            label="Generate a new code"
            variant="secondary"
            onPress={regenerateCode}
            loading={busy}
            style={styles.codeButton}
          />
        ) : null}
      </Card>

      <View style={styles.danger}>
        <Button label="Leave this household" variant="danger" onPress={confirmLeave} />
        {isOwner ? (
          <Button
            label="Delete this household"
            variant="danger"
            onPress={confirmDelete}
            style={styles.deleteButton}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  code: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 8,
    color: colors.primary,
    textAlign: 'center',
  },
  codeHint: { ...typography.caption, textAlign: 'center', marginTop: spacing.sm },
  codeButton: { marginTop: spacing.lg },
  danger: { marginTop: spacing.xxl },
  deleteButton: { marginTop: spacing.md },
});
