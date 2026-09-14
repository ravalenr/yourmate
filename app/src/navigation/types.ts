export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  CreateEnvironment: undefined;
  JoinEnvironment: undefined;
  /** A household's hub: the four blocks you can go to from here. */
  Environment: { environmentId: string; name: string };
  Tasks: { environmentId: string };
  Social: { environmentId: string };
  Holidays: { environmentId: string };
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
