import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { TaskRow } from '../components/TaskRow';
import { useAuth } from '../auth/AuthContext';
import { useEnvironment } from '../hooks/useEnvironments';
import { useTasks } from '../hooks/useTasks';
import { colors, spacing, typography } from '../theme';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Environment'>;

export function EnvironmentScreen({ route, navigation }: Props) {
  const { environmentId, name } = route.params;
  const { user } = useAuth();
  const { environment, members, refetch: refetchEnvironment } = useEnvironment(environmentId);
  const { tasks, loading, error, refetch } = useTasks(environmentId);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: environment?.name ?? name,
      headerRight: () => (
        <View style={styles.headerButtons}>
          <Pressable
            onPress={() => navigation.navigate('Notifications', { environmentId })}
            hitSlop={8}
            style={styles.headerButton}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Members', { environmentId })}
            hitSlop={8}
            style={styles.headerButton}
          >
            <Ionicons name="people-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, environment?.name, name, environmentId]);

  const handleComplete = useCallback(
    async (taskId: string) => {
      setActionError(null);
      setCompletingId(taskId);
      try {
        await api.post(`/tasks/${taskId}/complete`);
        await Promise.all([refetch(), refetchEnvironment()]);
      } catch (caught) {
        setActionError(caught instanceof Error ? caught.message : 'Could not complete that task');
      } finally {
        setCompletingId(null);
      }
    },
    [refetch, refetchEnvironment],
  );

  if (loading && !tasks) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
      >
        <ErrorBanner message={actionError ?? error} />

        {tasks && tasks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing to do yet</Text>
            <Text style={styles.emptyBody}>
              Add the first task and it'll show up for everyone in {environment?.name ?? 'the household'}.
            </Text>
          </View>
        ) : (
          tasks?.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              members={members}
              currentUserId={user?.id}
              busy={completingId === task.id}
              onPress={() => navigation.navigate('TaskDetail', { taskId: task.id, environmentId })}
              onToggleComplete={() => handleComplete(task.id)}
            />
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Add a task"
          onPress={() => navigation.navigate('TaskForm', { environmentId })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  headerButtons: { flexDirection: 'row' },
  headerButton: { marginLeft: spacing.lg },
  empty: { paddingTop: spacing.xxl, alignItems: 'center' },
  emptyTitle: { ...typography.heading, marginBottom: spacing.sm },
  emptyBody: {
    ...typography.caption,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
