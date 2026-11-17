import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { users, customers, customerPreferences } from '../../db/schema.ts';
import { requireAuth, signAppToken, type AuthRequest } from '../middleware/auth.ts';
import { createNotification } from '../services/notificationService.ts';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(6).max(24).optional(),
  password: z.string().min(6).max(100),
  city: z.string().max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid registration data.' });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const uid = `local_${crypto.randomUUID()}`;

    const created = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          uid,
          email,
          name: parsed.data.name.trim(),
          phone: parsed.data.phone?.trim() || null,
          passwordHash,
          role: 'CUSTOMER',
          emailVerified: true,
        })
        .returning();

      const [newCustomer] = await tx
        .insert(customers)
        .values({
          userId: newUser.id,
          city: parsed.data.city?.trim() || 'Mumbai',
          loyaltyPoints: 100,
        })
        .returning();

      await tx.insert(customerPreferences).values({ customerId: newCustomer.id });

      return { newUser, newCustomer };
    });

    await createNotification({
      userId: created.newUser.id,
      title: 'Welcome to CaterEase',
      message: 'Your customer account is active with 100 welcome hospitality points.',
      type: 'SYSTEM',
      linkUrl: '/dashboard/customer',
      emailSubject: 'Welcome to CaterEase — Account Confirmed',
    });

    const token = signAppToken(created.newUser);
    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: created.newUser.id,
          email: created.newUser.email,
          name: created.newUser.name,
          phone: created.newUser.phone,
          role: created.newUser.role,
          customerId: created.newCustomer.id,
        },
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Unable to register account.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email and password.' });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const [userRow] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!userRow || !userRow.passwordHash) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (!userRow.isActive) {
      return res.status(403).json({ success: false, message: 'Your account is currently deactivated.' });
    }

    const valid = await bcrypt.compare(parsed.data.password, userRow.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signAppToken(userRow);
    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: userRow.id,
          email: userRow.email,
          name: userRow.name,
          phone: userRow.phone,
          role: userRow.role,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Unable to sign in.' });
  }
});

// Called right after Firebase Google Sign-In on client to sync PostgreSQL record
router.post('/google-sync', requireAuth, async (req: AuthRequest, res) => {
  return res.json({ success: true, data: { user: req.authUser } });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.authUser!;
    let customerProfile = null;
    if (u.customerId) {
      const [cust] = await db.select().from(customers).where(eq(customers.id, u.customerId)).limit(1);
      const [prefs] = await db.select().from(customerPreferences).where(eq(customerPreferences.customerId, u.customerId)).limit(1);
      customerProfile = { ...cust, preferences: prefs || null };
    }
    return res.json({ success: true, data: { user: u, customerProfile } });
  } catch (err) {
    console.error('Me fetch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load profile.' });
  }
});

router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(100),
      phone: z.string().max(24).optional().nullable(),
      address: z.string().max(250).optional().nullable(),
      city: z.string().max(80).optional().nullable(),
      state: z.string().max(80).optional().nullable(),
      postalCode: z.string().max(20).optional().nullable(),
      dietaryNotes: z.string().max(300).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid profile fields.' });
    }

    const u = req.authUser!;
    await db
      .update(users)
      .set({ name: parsed.data.name.trim(), phone: parsed.data.phone ?? null, updatedAt: new Date() })
      .where(eq(users.id, u.id));

    if (u.customerId) {
      await db
        .update(customers)
        .set({
          address: parsed.data.address ?? null,
          city: parsed.data.city ?? null,
          state: parsed.data.state ?? null,
          postalCode: parsed.data.postalCode ?? null,
          dietaryNotes: parsed.data.dietaryNotes ?? null,
        })
        .where(eq(customers.id, u.customerId));
    }

    return res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6).max(100),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const [userRow] = await db.select().from(users).where(eq(users.id, req.authUser!.id)).limit(1);
    if (!userRow || !userRow.passwordHash) {
      return res.status(400).json({ success: false, message: 'Password change is only available for email/password accounts.' });
    }
    const ok = await bcrypt.compare(parsed.data.currentPassword, userRow.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, userRow.id));

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }
    const email = parsed.data.email.toLowerCase().trim();
    const [userRow] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (userRow) {
      const token = crypto.randomBytes(20).toString('hex');
      const expires = new Date(Date.now() + 3600 * 1000);
      await db.update(users).set({ resetToken: token, resetTokenExpires: expires }).where(eq(users.id, userRow.id));

      return res.json({
        success: true,
        message: 'Password reset instructions generated.',
        // Returned in demo/development mode if SMTP is unconfigured so reset flow can be tested end-to-end
        demoResetToken: !process.env.EMAIL_USER ? token : undefined,
      });
    }

    return res.json({ success: true, message: 'If an account matches that email, reset instructions have been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process password reset request.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(10),
      newPassword: z.string().min(6).max(100),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Valid reset token and new password (6+ chars) required.' });
    }

    const [userRow] = await db.select().from(users).where(eq(users.resetToken, parsed.data.token)).limit(1);
    if (!userRow || !userRow.resetTokenExpires || userRow.resetTokenExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token is invalid or has expired.' });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await db
      .update(users)
      .set({ passwordHash: newHash, resetToken: null, resetTokenExpires: null, updatedAt: new Date() })
      .where(eq(users.id, userRow.id));

    return res.json({ success: true, message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

export default router;
