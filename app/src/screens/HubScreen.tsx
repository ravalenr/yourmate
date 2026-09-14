import { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ErrorBanner } from '../components/ErrorBanner';
import { useEnvironment } from '../hooks/useEnvironments';
import { colors, radius, spacing, typography } from '../theme';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Environment'>;

/** Plural that reads correctly for 1: "1 person", "3 people". */
function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function HubScreen({ route, navigation }: Props) {
  const { environmentId, name } = route.params;
  const { environment, error } = useEnvironment(environmentId);

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
            onPress={() => navigation.navigate('Settings', { environmentId })}
            hitSlop={8}
            style={styles.headerButton}
            accessibilityLabel="Household settings"
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, environment?.name, name, environmentId]);

  // Subtitles stay blank until the counts arrive, so the blocks don't flash "0".
  const blocks = [
    {
      key: 'members',
      label: 'Members',
      icon: 'people-outline',
      subtitle: environment ? count(environment.memberCount, 'person', 'people') : ' ',
      onPress: () => navigation.navigate('Members', { environmentId }),
    },
    {
      key: 'tasks',
      label: 'Tasks',
      icon: 'checkbox-outline',
      subtitle: environment ? count(environment.pendingTaskCount, 'to do', 'to do') : ' ',
      onPress: () => navigation.navigate('Tasks', { environmentId }),
    },
    {
      key: 'social',
      label: 'Social',
      icon: 'chatbubbles-outline',
      subtitle: 'Coming next',
      onPress: () => navigation.navigate('Social', { environmentId }),
    },
    {
      key: 'holidays',
      label: 'Holidays',
      icon: 'airplane-outline',
      subtitle: 'Coming next',
      onPress: () => navigation.navigate('Holidays', { environmentId }),
    },
  ] as const;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ErrorBanner message={error} />

      <View style={styles.grid}>
        {blocks.map((block) => (
          <Pressable
            key={block.key}
            onPress={block.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.block, pressed && styles.blockPressed]}
          >
            <Ionicons name={block.icon} size={28} color={colors.primary} />
            <Text style={styles.blockLabel}>{block.label}</Text>
            <Text style={styles.blockSubtitle} numberOfLines={1}>
              {block.subtitle}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  headerButtons: { flexDirection: 'row' },
  headerButton: { marginLeft: spacing.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  block: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    justifyContent: 'center',
  },
  blockPressed: { opacity: 0.7 },
  blockLabel: { ...typography.heading, marginTop: spacing.md },
  blockSubtitle: { ...typography.caption, marginTop: 2 },
});
