import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '../theme';
import type { HomeStackParamList } from '../navigation/types';

/**
 * Stands in for the hub blocks that aren't built yet, so the hub is fully
 * clickable while Social and Holidays are still on the way.
 */
type Props = NativeStackScreenProps<HomeStackParamList, 'Social' | 'Holidays'>;

const COPY = {
  Social: {
    icon: 'chatbubbles-outline',
    title: 'Social is coming next',
    body: 'A feed where you and your housemates can post updates, share a photo, tag each other and run a quick poll.',
  },
  Holidays: {
    icon: 'airplane-outline',
    title: 'Holidays are coming next',
    body: 'Book time off in advance and the app will put you on holiday automatically — plus see who else is away and when.',
  },
} as const;

export function ComingSoonScreen({ route }: Props) {
  const copy = COPY[route.name];

  return (
    <View style={styles.screen}>
      <Ionicons name={copy.icon} size={48} color={colors.textFaint} />
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  title: { ...typography.heading, marginTop: spacing.lg, textAlign: 'center' },
  body: {
    ...typography.caption,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
