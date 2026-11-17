import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { users, customers, staff, admins } from '../../db/schema.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';

export type AppRole = 'CUSTOMER' | 'ADMIN' | 'STAFF';

export interface AuthUserContext {
  id: number;
  uid: string;
  email: string;
  name: string;
  phone: string | null;
  role: AppRole;
  customerId?: number;
  staffId?: number;
  adminId?: number;
}

export interface AuthRequest extends Request {
  authUser?: AuthUserContext;
}

const getJwtSecret = () =>
  process.env.JWT_SECRET || 'caterease_dev_fallback_secret_change_in_production_2026';

export function signAppToken(user: { id: number; uid: string; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, uid: user.uid, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

async function hydrateUserContext(userRow: typeof users.$inferSelect): Promise<AuthUserContext> {
  const ctx: AuthUserContext = {
    id: userRow.id,
    uid: userRow.uid,
    email: userRow.email,
    name: userRow.name,
    phone: userRow.phone,
    role: userRow.role as AppRole,
  };

  if (userRow.role === 'CUSTOMER') {
    let [cust] = await db.select().from(customers).where(eq(customers.userId, userRow.id)).limit(1);
    if (!cust) {
      [cust] = await db.insert(customers).values({ userId: userRow.id }).onConflictDoNothing().returning();
      if (!cust) {
        [cust] = await db.select().from(customers).where(eq(customers.userId, userRow.id)).limit(1);
      }
    }
    ctx.customerId = cust?.id;
  } else if (userRow.role === 'STAFF') {
    const [st] = await db.select().from(staff).where(eq(staff.userId, userRow.id)).limit(1);
    ctx.staffId = st?.id;
  } else if (userRow.role === 'ADMIN') {
    const [adm] = await db.select().from(admins).where(eq(admins.userId, userRow.id)).limit(1);
    ctx.adminId = adm?.id;
  }

  return ctx;
}

export async function resolveUserFromToken(token: string): Promise<AuthUserContext | null> {
  // 1. Try app JWT first
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { id: number; email: string };
    const [userRow] = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);
    if (userRow && userRow.isActive) {
      return await hydrateUserContext(userRow);
    }
  } catch {
    // Fall through to Firebase ID Token verification
  }

  // 2. Try Firebase ID Token
  try {
    const fbDecoded = await adminAuth.verifyIdToken(token);
    const email = fbDecoded.email || `${fbDecoded.uid}@firebase.local`;
    const name = fbDecoded.name || email.split('@')[0];

    const [existingByUid] = await db.select().from(users).where(eq(users.uid, fbDecoded.uid)).limit(1);
    if (existingByUid) {
      return existingByUid.isActive ? await hydrateUserContext(existingByUid) : null;
    }

    const [existingByEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingByEmail) {
      const [updated] = await db
        .update(users)
        .set({ uid: fbDecoded.uid, emailVerified: Boolean(fbDecoded.email_verified), updatedAt: new Date() })
        .where(eq(users.id, existingByEmail.id))
        .returning();
      return updated.isActive ? await hydrateUserContext(updated) : null;
    }

    const [inserted] = await db
      .insert(users)
      .values({
        uid: fbDecoded.uid,
        email,
        name,
        role: 'CUSTOMER',
        emailVerified: Boolean(fbDecoded.email_verified),
        avatarUrl: fbDecoded.picture || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, name, updatedAt: new Date() },
      })
      .returning();

    return await hydrateUserContext(inserted);
  } catch {
    return null;
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  const token = authHeader.slice(7).trim();
  const user = await resolveUserFromToken(token);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token.' });
  }
  req.authUser = user;
  next();
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = await resolveUserFromToken(token);
    if (user) req.authUser = user;
  }
  next();
};

export const requireRole = (...roles: AppRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!roles.includes(req.authUser.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions for this action.' });
    }
    next();
  };
};
