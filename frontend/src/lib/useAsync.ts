import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// Minimal data hook: runs fn on mount (and when deps change), exposes loading/error + manual reload.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // fn is intentionally not a dep; callers pass a fresh closure each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => active && setData(d))
      .catch((e: unknown) =>
        active && setError(e instanceof ApiError ? e.message : "Something went wrong")
      )
      .finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);
  return { data, loading, error, reload: run };
}
