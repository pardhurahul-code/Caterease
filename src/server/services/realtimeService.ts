import type { Request, Response } from 'express';
import type { AppRole, AuthUserContext } from '../middleware/auth.ts';

interface SseClient {
  id: string;
  userId: number;
  role: AppRole;
  res: Response;
}

const clients = new Map<string, SseClient>();

export function registerSseClient(user: AuthUserContext, req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const clientId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const client: SseClient = { id: clientId, userId: user.id, role: user.role, res };
  clients.set(clientId, client);

  res.write(`event: connected\ndata: ${JSON.stringify({ userId: user.id, role: user.role, connectedAt: new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      clients.delete(clientId);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
}

export function emitRealtimeEvent(params: {
  event: string;
  payload: Record<string, unknown>;
  targetUserIds?: number[];
  targetRoles?: AppRole[];
}) {
  const frame = `event: ${params.event}\ndata: ${JSON.stringify(params.payload)}\n\n`;
  for (const client of clients.values()) {
    const matchesUser = params.targetUserIds?.includes(client.userId) ?? false;
    const matchesRole = params.targetRoles?.includes(client.role) ?? false;
    if (matchesUser || matchesRole) {
      try {
        client.res.write(frame);
      } catch {
        clients.delete(client.id);
      }
    }
  }
}
