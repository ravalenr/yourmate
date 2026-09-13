/** Mirrors what the API returns. See docs/ARCHITECTURE.md section 5. */

export type User = {
  id: string;
  email: string;
  displayName: string;
  bio: string | null;
  hasAvatar: boolean;
  holidayMode: boolean;
  createdAt: string;
};

export type Member = {
  id: string;
  displayName: string;
  bio: string | null;
  hasAvatar: boolean;
  holidayMode: boolean;
  role: 'owner' | 'member';
  joinedAt: string;
};

export type Environment = {
  id: string;
  name: string;
  inviteCode: string;
  role: 'owner' | 'member';
  memberCount: number;
  pendingTaskCount: number;
  myPendingTaskCount: number;
  joinedAt: string;
  createdAt: string;
};

export type Frequency = 'one_off' | 'daily' | 'weekly' | 'monthly';
export type AssignmentType = 'rotational' | 'manual' | 'unassigned';

export type Task = {
  id: string;
  environmentId: string;
  shortDescription: string;
  longDescription: string | null;
  deadline: string;
  frequency: Frequency;
  frequencyInterval: number;
  assignmentType: AssignmentType;
  assignedUserId: string | null;
  status: 'pending' | 'done';
  completedAt: string | null;
  completedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  assignedWhileCovering: boolean;
};

export type NotificationItem = {
  id: string;
  environmentId: string;
  actorId: string | null;
  taskId: string | null;
  type:
    | 'task_created'
    | 'task_completed'
    | 'task_claimed'
    | 'task_reassigned'
    | 'member_joined'
    | 'member_left';
  message: string;
  readAt: string | null;
  createdAt: string;
};
