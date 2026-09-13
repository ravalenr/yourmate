import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { CreateEnvironmentScreen } from '../screens/CreateEnvironmentScreen';
import { JoinEnvironmentScreen } from '../screens/JoinEnvironmentScreen';
import { EnvironmentScreen } from '../screens/EnvironmentScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { TaskFormScreen } from '../screens/TaskFormScreen';
import { MembersScreen } from '../screens/MembersScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors } from '../theme';
import type {
  AuthStackParamList,
  HomeStackParamList,
  MainTabParamList,
  ProfileStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const headerStyle = {
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTintColor: colors.text,
};

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function HomeFlow() {
  return (
    <HomeStack.Navigator screenOptions={headerStyle}>
      <HomeStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Your households' }}
      />
      <HomeStack.Screen
        name="CreateEnvironment"
        component={CreateEnvironmentScreen}
        options={{ title: 'New household' }}
      />
      <HomeStack.Screen
        name="JoinEnvironment"
        component={JoinEnvironmentScreen}
        options={{ title: 'Join a household' }}
      />
      <HomeStack.Screen name="Environment" component={EnvironmentScreen} />
      <HomeStack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <HomeStack.Screen name="TaskForm" component={TaskFormScreen} />
      <HomeStack.Screen name="Members" component={MembersScreen} options={{ title: 'Household' }} />
      <HomeStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Activity' }}
      />
    </HomeStack.Navigator>
  );
}

function ProfileFlow() {
  return (
    <ProfileStack.Navigator screenOptions={headerStyle}>
      <ProfileStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Your profile' }}
      />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="HomeTab"
        component={HomeFlow}
        options={{
          title: 'Households',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileFlow}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { user, isRestoring } = useAuth();

  // Avoids flashing the sign-in screen before a saved session is restored.
  if (isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <NavigationContainer>{user ? <MainTabs /> : <AuthFlow />}</NavigationContainer>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
