export const FREQUENCIES = ['one_off', 'daily', 'weekly', 'monthly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const ASSIGNMENT_TYPES = ['rotational', 'manual', 'unassigned'] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export const TASK_STATUSES = ['pending', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
