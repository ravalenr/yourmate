import { useCallback, useState, type DependencyList } from 'react';
import { useFocusEffect } from '@react-navigation/native';

type Resource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Loads data from the API and reloads it whenever the screen comes back into view.
 *
 * We're not using a caching library, so something has to decide when data is stale.
 * Tying it to screen focus means returning from "create a task" shows the new task
 * without every screen having to remember to refetch by hand — the classic bug with
 * hand-rolled fetching.
 *
 * `load` is wrapped with `deps`, so pass anything it closes over (an id, say).
 */
export function useResource<T>(load: () => Promise<T>, deps: DependencyList = []): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = useCallback(load, deps);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      setData(await fetcher());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return { data, loading, error, refetch };
}
