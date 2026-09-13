import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { useEnvironments } from '../hooks/useEnvironments';
import { colors, radius, spacing, typography } from '../theme';
import type { Environment } from '../types';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { environments, loading, error, refetch } = useEnvironments();

  if (loading && !environments) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isEmpty = environments !== null && environments.length === 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
    >
      <ErrorBanner message={error} />

      {isEmpty ? (
        <EmptyState
          onCreate={() => navigation.navigate('CreateEnvironment')}
          onJoin={() => navigation.navigate('JoinEnvironment')}
        />
      ) : (
        <>
          {environments?.map((environment) => (
            <EnvironmentCard
              key={environment.id}
              environment={environment}
              onPress={() =>
                navigation.navigate('Environment', {
                  environmentId: environment.id,
                  name: environment.name,
                })
              }
            />
          ))}

          <View style={styles.actions}>
            <Button
              label="Create a household"
              variant="secondary"
              onPress={() => navigation.navigate('CreateEnvironment')}
              style={styles.action}
            />
            <Button
              label="Join with a code"
              variant="secondary"
              onPress={() => navigation.navigate('JoinEnvironment')}
              style={styles.action}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function EnvironmentCard({
  environment,
  onPress,
}: {
  environment: Environment;
  onPress: () => void;
}) {
  const { pendingTaskCount, myPendingTaskCount, memberCount } = environment;

  return (
    <Card onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{environment.name}</Text>
        {environment.role === 'owner' ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Owner</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.cardMeta}>
        {memberCount} {memberCount === 1 ? 'person' : 'people'}
      </Text>

      <View style={styles.stats}>
        <Text style={styles.statPrimary}>
          {pendingTaskCount === 0
            ? 'Nothing to do '
            : `${pendingTaskCount} ${pendingTaskCount === 1 ? 'task' : 'tasks'} to do`}
        </Text>
        {myPendingTaskCount > 0 ? (
          <Text style={styles.statMine}>{myPendingTaskCount} yours</Text>
        ) : null}
      </View>
    </Card>
  );
}

function EmptyState({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No households yet</Text>
      <Text style={styles.emptyBody}>
        Create one for your home, or join your housemates with the invite code they
        share with you.
      </Text>

      <Button label="Create a household" onPress={onCreate} style={styles.emptyButton} />
      <Button
        label="Join with a code"
        variant="secondary"
        onPress={onJoin}
        style={styles.emptyButton}
      />
    </View>
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...typography.heading, flexShrink: 1 },
  badge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  cardMeta: { ...typography.caption, marginTop: 2 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  statPrimary: { ...typography.body, fontWeight: '600' },
  statMine: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  actions: { marginTop: spacing.md },
  action: { marginBottom: spacing.md },
  empty: { paddingTop: spacing.xxl, alignItems: 'stretch' },
  emptyTitle: { ...typography.title, textAlign: 'center' },
  emptyBody: {
    ...typography.caption,
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  emptyButton: { marginBottom: spacing.md },
});
