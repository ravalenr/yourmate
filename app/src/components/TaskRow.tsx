import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assigneeLabel, formatDeadline, isOverdue } from '../lib/format';
import { colors, radius, spacing, typography } from '../theme';
import type { Member, Task } from '../types';

type Props = {
  task: Task;
  members: Member[] | null;
  currentUserId: string | undefined;
  onPress: () => void;
  onToggleComplete: () => void;
  busy?: boolean;
};

export function TaskRow({
  task,
  members,
  currentUserId,
  onPress,
  onToggleComplete,
  busy = false,
}: Props) {
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const mine = task.assignedUserId === currentUserId;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, done && styles.rowDone, pressed && styles.pressed]}
    >
      <Pressable
        onPress={onToggleComplete}
        disabled={done || busy}
        hitSlop={10}
        style={[styles.checkbox, done && styles.checkboxDone]}
      >
        {done ? <Ionicons name="checkmark" size={16} color={colors.primaryText} /> : null}
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
          {task.shortDescription}
        </Text>

        <View style={styles.metaRow}>
          {!done ? (
            <Text style={[styles.deadline, overdue && styles.overdue]}>
              {formatDeadline(task.deadline)}
            </Text>
          ) : (
            <Text style={styles.deadline}>Done</Text>
          )}

          <Text style={styles.dot}>·</Text>

          <Text style={[styles.assignee, mine && styles.assigneeMine]}>
            {assigneeLabel(task, members, currentUserId)}
          </Text>
        </View>

        {task.assignedWhileCovering && mine && !done ? (
          <View style={styles.coveringPill}>
            <Text style={styles.coveringText}>
              You're covering while your housemates are away
            </Text>
          </View>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  // Completed one-off tasks stay visible but greyed out until the week ends.
  rowDone: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  body: { flex: 1 },
  title: { ...typography.body, fontWeight: '600' },
  titleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  deadline: typography.caption,
  overdue: { color: colors.danger, fontWeight: '600' },
  dot: { ...typography.caption, marginHorizontal: spacing.sm },
  assignee: typography.caption,
  assigneeMine: { color: colors.primary, fontWeight: '600' },
  coveringPill: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  coveringText: { fontSize: 12, color: colors.warningText, fontWeight: '500' },
});
