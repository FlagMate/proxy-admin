import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './client';

/**
 * Shared GET lifecycle hook.
 * Returns the FULL envelope in `envelope` and the unwrapped `data` for convenience.
 * Guarantees a terminal state: loading -> (data | error).
 */
export function useApi(path, deps = []) {
  const [envelope, setEnvelope] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    activeRef.current = true;
    setLoading(true);
    setError(null);

    api.get(path)
      .then(result => {
        if (!activeRef.current) return;
        setEnvelope(result);
      })
      .catch(err => {
        if (!activeRef.current) return;
        setError(err.message || 'Something went wrong');
      })
      .finally(() => {
        if (!activeRef.current) return;
        setLoading(false);
      });

    return () => { activeRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, reloadKey, ...deps]);

  return {
    envelope,
    data: envelope ? envelope.data : null,
    loading,
    error,
    reload,
  };
}