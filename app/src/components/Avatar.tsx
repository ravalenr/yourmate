import { Image, StyleSheet, Text, View } from 'react-native';
import { getAuthToken } from '../api/client';
import { API_BASE_URL } from '../api/config';
import { colors } from '../theme';

type Props = {
  userId: string;
  displayName: string;
  hasAvatar: boolean;
  size?: number;
  /** Change this to force a reload after uploading a new picture. */
  version?: number;
};

export function Avatar({ userId, displayName, hasAvatar, size = 40, version = 0 }: Props) {
  const dimensions = { width: size, height: size, borderRadius: size / 2 };
  const token = getAuthToken();

  if (hasAvatar && token) {
    return (
      <Image
        source={{
          // The URL never changes, so without a cache-buster a newly uploaded
          // picture would keep showing the old one.
          uri: `${API_BASE_URL}/users/${userId}/avatar?v=${version}`,
          headers: { Authorization: `Bearer ${token}` },
        }}
        style={[styles.image, dimensions]}
      />
    );
  }

  return (
    <View style={[styles.fallback, dimensions]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
        {displayName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.border },
  fallback: {
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontWeight: '700', color: colors.primary },
});
