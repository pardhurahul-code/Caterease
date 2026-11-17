import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { notifications, users } from '../../db/schema.ts';

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_HOST) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT || 587) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function sendEmailIfConfigured(to: string, subject: string, html: string): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'CaterEase <no-reply@caterease.local>',
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.warn('Email delivery skipped/failed:', err);
    return false;
  }
}

export async function createNotification(params: {
  userId: number;
  title: string;
  message: string;
  type: 'BOOKING' | 'PAYMENT' | 'INVENTORY' | 'STAFF' | 'REVIEW' | 'SUPPORT' | 'SYSTEM';
  linkUrl?: string;
  emailSubject?: string;
}) {
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      linkUrl: params.linkUrl || null,
    });

    if (params.emailSubject) {
      const [u] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, params.userId)).limit(1);
      if (u?.email) {
        await sendEmailIfConfigured(
          u.email,
          params.emailSubject,
          `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e7e5e4;border-radius:12px;">
            <h2 style="color:#b45309;margin:0 0 8px;">CaterEase</h2>
            <h3 style="margin:0 0 12px;color:#1c1917;">${params.title}</h3>
            <p style="color:#44403c;line-height:1.6;">Hello ${u.name},</p>
            <p style="color:#44403c;line-height:1.6;">${params.message}</p>
            <p style="color:#78716c;font-size:12px;margin-top:24px;">Smart Catering. Seamless Celebrations.</p>
          </div>`
        );
      }
    }
  } catch (err) {
    console.error('Notification creation error:', err);
  }
}

export async function notifyAllAdmins(params: {
  title: string;
  message: string;
  type: 'BOOKING' | 'PAYMENT' | 'INVENTORY' | 'STAFF' | 'REVIEW' | 'SUPPORT' | 'SYSTEM';
  linkUrl?: string;
}) {
  try {
    const adminUsers = await db.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN'));
    for (const adm of adminUsers) {
      await createNotification({ ...params, userId: adm.id });
    }
  } catch (err) {
    console.error('Admin notify error:', err);
  }
}
