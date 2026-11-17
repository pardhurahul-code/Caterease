import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function useMapsApiKey() {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';
  const [apiKey, setApiKey] = useState<string>(envKey);
  const [loading, setLoading] = useState<boolean>(!envKey);

  useEffect(() => {
    if (envKey) {
      setApiKey(envKey);
      setLoading(false);
      return;
    }
    let active = true;
    api
      .get('/maps/client-config')
      .then((res) => {
        if (!active) return;
        const serverKey = res.data?.data?.apiKey || '';
        setApiKey(serverKey);
      })
      .catch(() => {
        // Handled cleanly by caller
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [envKey]);

  return { apiKey, loading };
}
