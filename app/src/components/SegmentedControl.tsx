import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  hint?: string;
};

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
}: Props<T>) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.track}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.sm },
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  segmentTextSelected: { color: colors.primaryText, fontWeight: '600' },
  hint: { ...typography.caption, marginTop: spacing.xs },
});
