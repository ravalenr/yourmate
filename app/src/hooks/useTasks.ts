import { api } from '../api/client';
import type { Task } from '../types';
import { useResource } from './useResource';

export function useTasks(environmentId: string) {
  const { data, loading, error, refetch } = useResource(
    () => api.get<{ tasks: Task[] }>(`/environments/${environmentId}/tasks`),
    [environmentId],
  );
  return { tasks: data?.tasks ?? null, loading, error, refetch };
}

export function useTask(taskId: string) {
  const { data, loading, error, refetch } = useResource(
    () => api.get<{ task: Task }>(`/tasks/${taskId}`),
    [taskId],
  );
  return { task: data?.task ?? null, loading, error, refetch };
}
