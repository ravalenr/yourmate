import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Card({ children, onPress, style }: Props) {
  if (!onPress) {
    return <View style={[styles.card, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.7 },
});
