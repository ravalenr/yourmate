import { api } from '../api/client';
import type { Environment, Member } from '../types';
import { useResource } from './useResource';

export function useEnvironments() {
  const { data, loading, error, refetch } = useResource(() =>
    api.get<{ environments: Environment[] }>('/environments'),
  );
  return { environments: data?.environments ?? null, loading, error, refetch };
}

export function useEnvironment(environmentId: string) {
  const { data, loading, error, refetch } = useResource(
    () =>
      api.get<{ environment: Environment; members: Member[] }>(`/environments/${environmentId}`),
    [environmentId],
  );
  return {
    environment: data?.environment ?? null,
    members: data?.members ?? null,
    loading,
    error,
    refetch,
  };
}
