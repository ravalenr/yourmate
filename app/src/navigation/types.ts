export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  CreateEnvironment: undefined;
  JoinEnvironment: undefined;
  Environment: { environmentId: string; name: string };
  TaskDetail: { taskId: string; environmentId: string };
  TaskForm: { environmentId: string; taskId?: string };
  Members: { environmentId: string };
  Notifications: { environmentId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  ProfileTab: undefined;
};
