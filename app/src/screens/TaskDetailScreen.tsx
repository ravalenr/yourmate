import { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../auth/AuthContext';
import { useEnvironment } from '../hooks/useEnvironments';
import { useTask } from '../hooks/useTasks';
import {
  assigneeLabel,
  describeAssignment,
  describeFrequency,
  formatDate,
  formatDeadline,
  isOverdue,
} from '../lib/format';
import { colors, radius, spacing, typography } from '../theme';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'TaskDetail'>;

export function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId, environmentId } = route.params;
  const { user } = useAuth();
  const { task, loading, error, refetch } = useTask(taskId);
  const { members } = useEnvironment(environmentId);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Task',
      headerRight: () =>
        task ? (
          <Pressable
            onPress={() => navigation.navigate('TaskForm', { environmentId, taskId })}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={22} color={colors.text} />
          </Pressable>
        ) : null,
    });
  }, [navigation, task, environmentId, taskId]);

  async function run(action: () => Promise<unknown>, failureMessage: string) {
    setActionError(null);
    setBusy(true);
    try {
      await action();
      await refetch();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : failureMessage);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete this task?', 'It will disappear for everyone in the household.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/tasks/${taskId}`);
            navigation.goBack();
          } catch (caught) {
            setActionError(caught instanceof Error ? caught.message : 'Could not delete the task');
          }
        },
      },
    ]);
  }

  if (loading && !task) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.centred}>
        <ErrorBanner message={error ?? 'That task no longer exists.'} />
      </View>
    );
  }

  const done = task.status === 'done';
  const mine = task.assignedUserId === user?.id;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ErrorBanner message={actionError} />

      <Text style={styles.title}>{task.shortDescription}</Text>

      <View style={styles.statusRow}>
        <Text style={[styles.deadline, isOverdue(task) && styles.overdue]}>
          {done ? 'Completed' : formatDeadline(task.deadline)}
        </Text>
        <Text style={styles.deadlineDate}>{formatDate(task.deadline)}</Text>
      </View>

      {task.assignedWhileCovering && mine && !done ? (
        <View style={styles.covering}>
          <Text style={styles.coveringText}>
            This came back to you because your housemates are away. It'll move on when
            they're back.
          </Text>
        </View>
      ) : null}

      {task.longDescription ? (
        <Card style={styles.card}>
          <Text style={styles.notes}>{task.longDescription}</Text>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <DetailRow label="Assigned to" value={assigneeLabel(task, members, user?.id)} />
        <DetailRow label="How it's shared" value={describeAssignment(task.assignmentType)} />
        <DetailRow
          label="Repeats"
          value={describeFrequency(task.frequency, task.frequencyInterval)}
        />
        <DetailRow label="Added" value={formatDate(task.createdAt.slice(0, 10))} last />
      </Card>

      <View style={styles.actions}>
        {task.assignmentType === 'unassigned' ? (
          <Button
            label="I'll do this one"
            onPress={() => run(() => api.post(`/tasks/${taskId}/claim`), 'Could not claim the task')}
            loading={busy}
            style={styles.action}
          />
        ) : null}

        {!done ? (
          <Button
            label="Mark as done"
            onPress={() =>
              run(() => api.post(`/tasks/${taskId}/complete`), 'Could not complete the task')
            }
            loading={busy}
            style={styles.action}
          />
        ) : null}

        <Button label="Delete task" variant="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    padding: spacing.lg,
  },
  title: { ...typography.title, fontSize: 24 },
  statusRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm },
  deadline: { ...typography.body, fontWeight: '600', color: colors.primary },
  overdue: { color: colors.danger },
  deadlineDate: { ...typography.caption, marginLeft: spacing.sm },
  covering: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  coveringText: { fontSize: 14, color: colors.warningText, lineHeight: 20 },
  card: { marginTop: spacing.lg },
  notes: { ...typography.body, lineHeight: 22 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailLabel: typography.caption,
  detailValue: { ...typography.body, fontWeight: '500' },
  actions: { marginTop: spacing.xl },
  action: { marginBottom: spacing.md },
});
