export const NOTIFICATION_TYPES = [
  'task_created',
  'task_completed',
  'task_claimed',
  'task_reassigned',
  'member_joined',
  'member_left',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
