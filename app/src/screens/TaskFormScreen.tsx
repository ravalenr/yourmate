import { useEffect, useLayoutEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextField } from '../components/TextField';
import { useAuth } from '../auth/AuthContext';
import { useEnvironment } from '../hooks/useEnvironments';
import { formatDate, fromIsoDate, toIsoDate, todayIso } from '../lib/format';
import { colors, radius, spacing, typography } from '../theme';
import type { AssignmentType, Frequency, Task } from '../types';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'TaskForm'>;

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'one_off', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const ASSIGNMENT_OPTIONS: { value: AssignmentType; label: string }[] = [
  { value: 'rotational', label: 'Take turns' },
  { value: 'manual', label: 'One person' },
  { value: 'unassigned', label: 'Anyone' },
];

const ASSIGNMENT_HINTS: Record<AssignmentType, string> = {
  rotational: 'Moves to the next housemate each time it’s done.',
  manual: 'Always the same person, until someone changes it.',
  unassigned: 'Nobody owns it yet — whoever wants it can take it.',
};

export function TaskFormScreen({ route, navigation }: Props) {
  const { environmentId, taskId } = route.params;
  const isEditing = Boolean(taskId);
  const { user } = useAuth();
  const { members } = useEnvironment(environmentId);

  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [deadline, setDeadline] = useState<Date>(fromIsoDate(todayIso()));
  const [frequency, setFrequency] = useState<Frequency>('one_off');
  const [weeklyInterval, setWeeklyInterval] = useState(1);
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('rotational');
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);

  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit task' : 'New task' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!taskId) return;
    (async () => {
      try {
        const { task } = await api.get<{ task: Task }>(`/tasks/${taskId}`);
        setShortDescription(task.shortDescription);
        setLongDescription(task.longDescription ?? '');
        setDeadline(fromIsoDate(task.deadline));
        setFrequency(task.frequency);
        setWeeklyInterval(task.frequencyInterval);
        setAssignmentType(task.assignmentType);
        setAssignedUserId(task.assignedUserId);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load the task');
      } finally {
        setLoading(false);
      }
    })();
  }, [taskId]);

  async function handleSave() {
    setError(null);
    setBusy(true);

    const body: Record<string, unknown> = {
      shortDescription: shortDescription.trim(),
      longDescription: longDescription.trim() || null,
      deadline: toIsoDate(deadline),
      frequency,
      frequencyInterval: frequency === 'weekly' ? weeklyInterval : 1,
      assignmentType,
      assignedUserId: assignmentType === 'unassigned' ? null : assignedUserId ?? user?.id ?? null,
    };

    try {
      if (taskId) {
        await api.patch(`/tasks/${taskId}`, body);
      } else {
        await api.post(`/environments/${environmentId}/tasks`, body);
      }
      navigation.goBack();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the task');
      setBusy(false);
    }
  }

  if (loading) {
    return <View style={styles.screen} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />

        <TextField
          label="What needs doing?"
          value={shortDescription}
          onChangeText={setShortDescription}
          placeholder="e.g. Take the bins out"
          maxLength={120}
          autoFocus={!isEditing}
        />

        <TextField
          label="Any details? (optional)"
          value={longDescription}
          onChangeText={setLongDescription}
          placeholder="Anything the person doing it should know"
          multiline
          numberOfLines={3}
          style={styles.multiline}
          maxLength={2000}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Due</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={deadline}
              mode="date"
              display="compact"
              onChange={(_event, picked) => picked && setDeadline(picked)}
            />
          ) : (
            <>
              <Pressable onPress={() => setShowAndroidPicker(true)} style={styles.dateButton}>
                <Text style={styles.dateButtonText}>{formatDate(toIsoDate(deadline))}</Text>
              </Pressable>
              {showAndroidPicker ? (
                <DateTimePicker
                  value={deadline}
                  mode="date"
                  onChange={(_event, picked) => {
                    setShowAndroidPicker(false);
                    if (picked) setDeadline(picked);
                  }}
                />
              ) : null}
            </>
          )}
        </View>

        <SegmentedControl
          label="Repeats"
          options={FREQUENCY_OPTIONS}
          value={frequency}
          onChange={setFrequency}
        />

        {frequency === 'weekly' ? (
          <View style={styles.field}>
            <Text style={styles.label}>How often</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setWeeklyInterval((n) => Math.max(1, n - 1))}
                style={styles.stepperButton}
              >
                <Text style={styles.stepperSymbol}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>
                {weeklyInterval === 1 ? 'Every week' : `Every ${weeklyInterval} weeks`}
              </Text>
              <Pressable
                onPress={() => setWeeklyInterval((n) => Math.min(12, n + 1))}
                style={styles.stepperButton}
              >
                <Text style={styles.stepperSymbol}>+</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <SegmentedControl
          label="Who does it?"
          options={ASSIGNMENT_OPTIONS}
          value={assignmentType}
          onChange={(next) => {
            setAssignmentType(next);
            if (next === 'unassigned') setAssignedUserId(null);
            if (next !== 'unassigned' && !assignedUserId) setAssignedUserId(user?.id ?? null);
          }}
          hint={ASSIGNMENT_HINTS[assignmentType]}
        />

        {assignmentType !== 'unassigned' ? (
          <View style={styles.field}>
            <Text style={styles.label}>
              {assignmentType === 'rotational' ? 'Starting with' : 'Assigned to'}
            </Text>
            <View style={styles.chips}>
              {members?.map((member) => {
                const selected = member.id === (assignedUserId ?? user?.id);
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => setAssignedUserId(member.id)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {member.id === user?.id ? 'You' : member.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Button
          label={isEditing ? 'Save changes' : 'Add task'}
          onPress={handleSave}
          loading={busy}
          disabled={shortDescription.trim().length === 0}
          style={styles.save}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  field: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.sm },
  multiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.md },
  dateButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  dateButtonText: typography.body,
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  stepperButton: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  stepperSymbol: { fontSize: 22, color: colors.primary, fontWeight: '600' },
  stepperValue: { ...typography.body, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.primaryText, fontWeight: '600' },
  save: { marginTop: spacing.md },
});
