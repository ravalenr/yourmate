import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../auth/AuthContext';
import { useEnvironment } from '../hooks/useEnvironments';
import { colors, radius, spacing, typography } from '../theme';
import type { Member } from '../types';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Members'>;

/**
 * Light-hearted ways of saying someone is on holiday. Picked from the member's id
 * rather than at random, so a housemate keeps the same line every time you look
 * instead of it reshuffling on each refresh.
 */
const AWAY_PHRASES = [
  'is too busy enjoying life',
  'is off somewhere sunnier',
  'has gone to touch some grass',
  'is out of office, emotionally',
  'is away making memories',
];

function awayPhraseFor(memberId: string): string {
  let total = 0;
  for (let i = 0; i < memberId.length; i++) total += memberId.charCodeAt(i);
  return AWAY_PHRASES[total % AWAY_PHRASES.length];
}

export function MembersScreen({ route }: Props) {
  const { environmentId } = route.params;
  const { user } = useAuth();
  const { environment, members, loading, error, refetch } = useEnvironment(environmentId);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwner = environment?.role === 'owner';

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
            setActionError(null);
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

  if (loading && !members) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const away = members?.filter((member) => member.holidayMode).length ?? 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ErrorBanner message={actionError ?? error} />

      {away > 0 ? (
        <Text style={styles.summary}>
          {away} of {members?.length} {away === 1 ? 'is' : 'are'} away right now.
        </Text>
      ) : null}

      {members?.map((member) => {
        const isYou = member.id === user?.id;

        return (
          <Card key={member.id}>
            <View style={styles.memberRow}>
              {/* Dimmed rather than removed, so you can still tell who it is. */}
              <View style={member.holidayMode ? styles.avatarAway : undefined}>
                <Avatar
                  userId={member.id}
                  displayName={member.displayName}
                  hasAvatar={member.hasAvatar}
                  size={44}
                />
              </View>

              <View style={styles.memberDetail}>
                <View style={styles.memberNameRow}>
                  <Text style={[styles.memberName, member.holidayMode && styles.nameAway]}>
                    {isYou ? 'You' : member.displayName}
                  </Text>
                  {member.role === 'owner' ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Owner</Text>
                    </View>
                  ) : null}
                </View>

                {member.holidayMode ? (
                  <View style={styles.awayTag}>
                    <Ionicons name="airplane" size={12} color={colors.warningText} />
                    <Text style={styles.awayText}>
                      {isYou ? "You're too busy enjoying life" : `${member.displayName} ${awayPhraseFor(member.id)}`}
                    </Text>
                  </View>
                ) : member.bio ? (
                  <Text style={styles.bio} numberOfLines={2}>
                    {member.bio}
                  </Text>
                ) : null}
              </View>

              {isOwner && !isYou ? (
                <Pressable onPress={() => confirmRemove(member)} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          </Card>
        );
      })}
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
  summary: { ...typography.caption, marginBottom: spacing.md },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  avatarAway: { opacity: 0.35, marginRight: spacing.md },
  memberDetail: { flex: 1, marginLeft: spacing.md },
  memberNameRow: { flexDirection: 'row', alignItems: 'center' },
  memberName: { ...typography.body, fontWeight: '600' },
  nameAway: { color: colors.textMuted },
  badge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  awayTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  awayText: { fontSize: 12, fontWeight: '600', color: colors.warningText },
  bio: { ...typography.caption, marginTop: 2 },
});
