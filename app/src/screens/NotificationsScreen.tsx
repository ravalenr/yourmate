import { useEffect } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { useResource } from '../hooks/useResource';
import { colors, radius, spacing, typography } from '../theme';
import type { NotificationItem } from '../types';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Notifications'>;

type Feed = {
  notifications: NotificationItem[];
  unreadCount: number;
  holidayMode: boolean;
};

export function NotificationsScreen({ route }: Props) {
  const { environmentId } = route.params;
  const { data, loading, error, refetch } = useResource(
    () => api.get<Feed>(`/environments/${environmentId}/notifications`),
    [environmentId],
  );

  // Opening the feed is what "reading" it means, so clear the unread count once
  // there is something to clear. The list itself stays put.
  useEffect(() => {
    if (data && data.unreadCount > 0) {
      api.post(`/environments/${environmentId}/notifications/read`).catch(() => {});
    }
  }, [data, environmentId]);

  if (loading && !data) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const notifications = data?.notifications ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
    >
      <ErrorBanner message={error} />

      {data?.holidayMode ? (
        <View style={styles.holidayNotice}>
          <Text style={styles.holidayText}>
            Holiday mode is on, so nothing here is nudging you. Here's what you've
            missed.
          </Text>
        </View>
      ) : null}

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing yet</Text>
          <Text style={styles.emptyBody}>
            When housemates add or finish tasks, it'll show up here.
          </Text>
        </View>
      ) : (
        notifications.map((notification) => (
          <Card key={notification.id}>
            <Text style={styles.message}>{notification.message}</Text>
            <Text style={styles.time}>{formatWhen(notification.createdAt)}</Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function formatWhen(isoTimestamp: string): string {
  const then = new Date(isoTimestamp);
  const minutes = Math.round((Date.now() - then.getTime()) / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
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
  holidayNotice: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  holidayText: { fontSize: 14, color: colors.warningText, lineHeight: 20 },
  message: { ...typography.body, lineHeight: 21 },
  time: { ...typography.caption, marginTop: spacing.xs },
  empty: { paddingTop: spacing.xxl, alignItems: 'center' },
  emptyTitle: { ...typography.heading, marginBottom: spacing.sm },
  emptyBody: { ...typography.caption, fontSize: 15, textAlign: 'center' },
});
