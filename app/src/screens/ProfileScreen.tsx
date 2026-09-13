import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, typography } from '../theme';

// Profile picture, bio and the holiday mode toggle arrive in build step 11.
export function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <Card>
        <Text style={styles.placeholder}>
          Your photo, bio and holiday mode are coming in the next step.
        </Text>
      </Card>

      <Button label="Sign out" variant="danger" onPress={signOut} style={styles.signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  identity: { alignItems: 'center', paddingVertical: spacing.xl },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 30, fontWeight: '700', color: colors.primary },
  name: typography.heading,
  email: { ...typography.caption, marginTop: 2 },
  placeholder: { ...typography.caption, fontSize: 15 },
  signOut: { marginTop: spacing.xl },
});
