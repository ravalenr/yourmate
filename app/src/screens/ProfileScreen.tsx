import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/ErrorBanner';
import { TextField } from '../components/TextField';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, typography } from '../theme';
import type { User } from '../types';

const MAX_NAME_LENGTH = 60;
const MAX_BIO_LENGTH = 280;

/** What the avatar endpoint accepts — see server/src/routes/profile.ts. */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** An empty bio box means "no bio", which the API expects as null rather than ''. */
function toBioValue(text: string): string | null {
  return text.trim() === '' ? null : text.trim();
}

function messageFrom(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);

  // The avatar URL is the same after an upload, so bump this to defeat the cache.
  const [avatarVersion, setAvatarVersion] = useState(0);

  // The tab only renders once signed in, so this is a type guard rather than a state.
  if (!user) return null;

  const trimmedName = displayName.trim();
  const hasChanges =
    trimmedName !== user.displayName || toBioValue(bio) !== (user.bio ?? null);

  async function updateProfile(body: Record<string, unknown>) {
    setError(null);
    await api.patch<{ user: User }>('/me', body);
    await refreshUser();
  }

  async function handleSaveDetails() {
    if (trimmedName === '') {
      setError('Your name can’t be empty');
      return;
    }

    setSavingDetails(true);
    try {
      await updateProfile({ displayName: trimmedName, bio: toBioValue(bio) });
    } catch (caught) {
      setError(messageFrom(caught, 'Could not save your profile'));
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleHolidayToggle(next: boolean) {
    setSavingHoliday(true);
    try {
      await updateProfile({ holidayMode: next });
    } catch (caught) {
      setError(messageFrom(caught, 'Could not change holiday mode'));
    } finally {
      setSavingHoliday(false);
    }
  }

  async function handlePickPhoto() {
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('yourmate needs access to your photos to set a picture');
      return;
    }

    // Square + compressed keeps it under the server's 1MB cap without a resize step.
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    if (!asset?.base64) {
      setError('That picture could not be read');
      return;
    }

    const mimeType =
      asset.mimeType && ALLOWED_IMAGE_TYPES.includes(asset.mimeType)
        ? asset.mimeType
        : 'image/jpeg';

    setSavingPhoto(true);
    try {
      await api.put<{ user: User }>('/me/avatar', { data: asset.base64, mimeType });
      await refreshUser();
      setAvatarVersion((version) => version + 1);
    } catch (caught) {
      setError(messageFrom(caught, 'Could not save that picture'));
    } finally {
      setSavingPhoto(false);
    }
  }

  function handleRemovePhoto() {
    Alert.alert('Remove your picture?', 'Your housemates will see your initial instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setError(null);
          setSavingPhoto(true);
          try {
            await api.delete('/me/avatar');
            await refreshUser();
            setAvatarVersion((version) => version + 1);
          } catch (caught) {
            setError(messageFrom(caught, 'Could not remove that picture'));
          } finally {
            setSavingPhoto(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ErrorBanner message={error} />

      <View style={styles.identity}>
        <Pressable onPress={handlePickPhoto} disabled={savingPhoto}>
          <Avatar
            userId={user.id}
            displayName={user.displayName}
            hasAvatar={user.hasAvatar}
            size={96}
            version={avatarVersion}
          />
        </Pressable>

        <View style={styles.photoActions}>
          <Text style={styles.photoAction} onPress={savingPhoto ? undefined : handlePickPhoto}>
            {user.hasAvatar ? 'Change photo' : 'Add a photo'}
          </Text>
          {user.hasAvatar ? (
            <Text
              style={[styles.photoAction, styles.photoRemove]}
              onPress={savingPhoto ? undefined : handleRemovePhoto}
            >
              Remove
            </Text>
          ) : null}
        </View>

        <Text style={styles.email}>{user.email}</Text>
      </View>

      <TextField
        label="Your name"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="How housemates will see you"
        maxLength={MAX_NAME_LENGTH}
        autoCapitalize="words"
      />

      <TextField
        label="Bio"
        value={bio}
        onChangeText={setBio}
        placeholder="Anything your housemates should know"
        hint={`${bio.trim().length}/${MAX_BIO_LENGTH}`}
        maxLength={MAX_BIO_LENGTH}
        multiline
        numberOfLines={3}
        style={styles.bioInput}
      />

      <Button
        label="Save changes"
        onPress={handleSaveDetails}
        loading={savingDetails}
        disabled={!hasChanges}
      />

      <Card style={styles.holidayCard}>
        {/* The whole row toggles: a bare Switch is a small target to hit. The Switch
            itself ignores touches so the row is the single place a tap is handled. */}
        <Pressable
          onPress={() => handleHolidayToggle(!user.holidayMode)}
          disabled={savingHoliday}
          accessibilityRole="switch"
          accessibilityState={{ checked: user.holidayMode, disabled: savingHoliday }}
          accessibilityLabel="Holiday mode"
          style={styles.holidayRow}
        >
          <Text style={styles.holidayTitle}>Holiday mode</Text>
          <Switch
            value={user.holidayMode}
            disabled={savingHoliday}
            pointerEvents="none"
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </Pressable>
        <Text style={styles.holidayHint}>
          While this is on, notifications are muted and your turn in any shared rotation is
          passed to the next housemate.
        </Text>
      </Card>

      <Button label="Sign out" variant="danger" onPress={signOut} style={styles.signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  identity: { alignItems: 'center', paddingVertical: spacing.lg },
  photoActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  photoAction: { ...typography.label, color: colors.primary },
  photoRemove: { color: colors.danger },
  email: { ...typography.caption, marginTop: spacing.sm },
  bioInput: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
  holidayCard: { marginTop: spacing.xl },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  holidayTitle: { ...typography.heading, fontSize: 17 },
  holidayHint: { ...typography.caption, marginTop: spacing.sm },
  signOut: { marginTop: spacing.xl },
});
