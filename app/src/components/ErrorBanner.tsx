import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  text: { color: colors.danger, fontSize: 14 },
});
