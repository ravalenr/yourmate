import type { NotificationType } from './notificationTypes';
import type { AssignmentType, Frequency, TaskStatus } from './taskTypes';

/**
 * Database rows use snake_case; the API speaks camelCase. These functions are the
 * single place that translation happens — and the safety net that stops internal
 * columns (password_hash, avatar_data) from ever reaching a client.
 */

export type UserRow = {
  id: string;
  email: string;
  display_name: string;
  bio: string | null;
  avatar_mime: string | null;
  holiday_mode: boolean;
  created_at: Date;
};

/** The full profile — only ever returned to that user about themselves. */
export function toPrivateUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    bio: row.bio,
    hasAvatar: row.avatar_mime !== null,
    holidayMode: row.holiday_mode,
    createdAt: row.created_at,
  };
}

/** What housemates are allowed to see about each other: no email address. */
export function toPublicUser(row: Omit<UserRow, 'email'>) {
  return {
    id: row.id,
    displayName: row.display_name,
    bio: row.bio,
    hasAvatar: row.avatar_mime !== null,
    holidayMode: row.holiday_mode,
  };
}

export const USER_COLUMNS =
  'id, email, display_name, bio, avatar_mime, holiday_mode, created_at';

export type MemberRow = {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_mime: string | null;
  holiday_mode: boolean;
  role: 'owner' | 'member';
  joined_at: Date;
};

export function toMember(row: MemberRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    bio: row.bio,
    hasAvatar: row.avatar_mime !== null,
    holidayMode: row.holiday_mode,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

export type TaskRow = {
  id: string;
  environment_id: string;
  short_description: string;
  long_description: string | null;
  deadline: string;
  frequency: Frequency;
  frequency_interval: number;
  assignment_type: AssignmentType;
  assigned_user_id: string | null;
  status: TaskStatus;
  completed_at: Date | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: Date;
  assigned_while_covering: boolean;
};

export function toTask(row: TaskRow) {
  return {
    id: row.id,
    environmentId: row.environment_id,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    deadline: row.deadline,
    frequency: row.frequency,
    frequencyInterval: row.frequency_interval,
    assignmentType: row.assignment_type,
    assignedUserId: row.assigned_user_id,
    status: row.status,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    assignedWhileCovering: row.assigned_while_covering,
  };
}

export const TASK_COLUMNS = `
  id, environment_id, short_description, long_description, deadline,
  frequency, frequency_interval, assignment_type, assigned_user_id,
  status, completed_at, completed_by, created_by, created_at,
  assigned_while_covering
`;

export type NotificationRow = {
  id: string;
  environment_id: string;
  actor_id: string | null;
  task_id: string | null;
  type: NotificationType;
  message: string;
  read_at: Date | null;
  created_at: Date;
};

export function toNotification(row: NotificationRow) {
  return {
    id: row.id,
    environmentId: row.environment_id,
    actorId: row.actor_id,
    taskId: row.task_id,
    type: row.type,
    message: row.message,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export const NOTIFICATION_COLUMNS =
  'id, environment_id, actor_id, task_id, type, message, read_at, created_at';

export type EnvironmentRow = {
  id: string;
  name: string;
  invite_code: string;
  created_at: Date;
  role: 'owner' | 'member';
  joined_at: Date;
  member_count: string;
  pending_task_count: string;
  my_pending_task_count: string;
};

export function toEnvironment(row: EnvironmentRow) {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    role: row.role,
    // Postgres returns COUNT() as a string because bigint doesn't fit in a JS number.
    // These counts are small, so converting is safe.
    memberCount: Number(row.member_count),
    pendingTaskCount: Number(row.pending_task_count),
    myPendingTaskCount: Number(row.my_pending_task_count),
    joinedAt: row.joined_at,
    createdAt: row.created_at,
  };
}

