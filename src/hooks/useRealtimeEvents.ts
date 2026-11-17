import { useEffect, useRef, useState } from 'react';

export interface RealtimePayload {
  bookingId?: number;
  bookingCode?: string;
  eventName?: string;
  status?: string;
  prepStatus?: string;
  deliveryStatus?: string;
  tastingId?: number;
  [key: string]: unknown;
}

export function useRealtimeEvents(
  enabled: boolean,
  onEvent: (eventName: string, payload: RealtimePayload) => void
) {
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const token = localStorage.getItem('caterease_token');
    if (!token) return;

    const url = `/api/realtime/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    const handleConnected = () => setConnected(true);
    const handleEvent = (eventName: string) => (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data) as RealtimePayload;
        callbackRef.current(eventName, parsed);
      } catch {
        // Ignore malformed frame
      }
    };

    const events = [
      'booking:status',
      'booking:created',
      'assignment:updated',
      'staff:assigned',
      'tasting:created',
      'tasting:updated',
    ];

    source.addEventListener('connected', handleConnected);
    const listeners = events.map((evName) => {
      const fn = handleEvent(evName);
      source.addEventListener(evName, fn);
      return { evName, fn };
    });

    source.onerror = () => {
      setConnected(false);
    };

    return () => {
      source.removeEventListener('connected', handleConnected);
      for (const { evName, fn } of listeners) {
        source.removeEventListener(evName, fn);
      }
      source.close();
      setConnected(false);
    };
  }, [enabled]);

  return { connected };
}
