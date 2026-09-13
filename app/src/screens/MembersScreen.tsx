import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../auth/AuthContext';
import { useEnvironment } from '../hooks/useEnvironments';
import { colors, radius, spacing, typography } from '../theme';
import type { Member } from '../types';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Members'>;

export function MembersScreen({ route, navigation }: Props) {
  const { environmentId } = route.params;
  const { user } = useAuth();
  const { environment, members, loading, error, refetch } = useEnvironment(environmentId);
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

  function confirmRemove(member: Member) {
    Alert.alert(
      `Remove ${member.displayName}?`,
      'They will lose access to this household, and any task assigned to them becomes unassigned.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/environments/${environmentId}/members/${member.id}`);
              await refetch();
            } catch (caught) {
              setActionError(caught instanceof Error ? caught.message : 'Could not remove them');
            }
          },
        },
      ],
    );
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

      <Text style={styles.sectionTitle}>
        Housemates {members ? `(${members.length})` : ''}
      </Text>
      {members?.map((member) => (
        <Card key={member.id}>
          <View style={styles.memberRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {member.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.memberDetail}>
              <View style={styles.memberNameRow}>
                <Text style={styles.memberName}>
                  {member.id === user?.id ? 'You' : member.displayName}
                </Text>
                {member.role === 'owner' ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Owner</Text>
                  </View>
                ) : null}
              </View>

              {member.holidayMode ? (
                <Text style={styles.away}>Away — skipping their turn</Text>
              ) : member.bio ? (
                <Text style={styles.bio} numberOfLines={1}>
                  {member.bio}
                </Text>
              ) : null}
            </View>

            {isOwner && member.id !== user?.id ? (
              <Pressable onPress={() => confirmRemove(member)} hitSlop={8}>
                <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        </Card>
      ))}

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
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontSize: 17, fontWeight: '700', color: colors.primary },
  memberDetail: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center' },
  memberName: { ...typography.body, fontWeight: '600' },
  badge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  away: { ...typography.caption, color: colors.warningText, marginTop: 2 },
  bio: { ...typography.caption, marginTop: 2 },
  danger: { marginTop: spacing.xxl },
  deleteButton: { marginTop: spacing.md },
});
