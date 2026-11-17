import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  bookings,
  bookingDetails,
  businessSettings,
  customers,
  inventory,
  newsletterSubscribers,
  notifications,
  payments,
  reviews,
  staff,
  supportMessages,
  supportTickets,
  users,
} from '../../db/schema.ts';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.ts';
import { canCustomerReviewBooking, type BookingStatus } from '../../utils/bookingWorkflow.ts';
import { isLowStock } from '../../utils/inventoryLogic.ts';
import { createNotification, notifyAllAdmins } from '../services/notificationService.ts';

const router = Router();

// ==================== REVIEWS ====================
router.get('/reviews', async (req, res) => {
  try {
    const includeAll = req.query.all === 'true';
    const rows = await db
      .select({
        review: reviews,
        customerName: users.name,
        eventType: bookings.eventType,
        eventName: bookings.eventName,
      })
      .from(reviews)
      .innerJoin(customers, eq(reviews.customerId, customers.id))
      .innerJoin(users, eq(customers.userId, users.id))
      .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
      .where(includeAll ? undefined : eq(reviews.isApproved, true))
      .orderBy(desc(reviews.createdAt));

    res.json({
      success: true,
      data: rows.map((r) => ({
        ...r.review,
        customerName: r.customerName,
        eventType: r.eventType,
        eventName: r.eventName,
      })),
    });
  } catch (err) {
    console.error('Reviews fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to load reviews.' });
  }
});

router.post('/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      bookingId: z.number().int().positive(),
      rating: z.number().int().min(1).max(5),
      title: z.string().min(3).max(120),
      comment: z.string().min(8).max(800),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const customerId = req.authUser!.customerId;
    if (!customerId) return res.status(403).json({ success: false, message: 'Only customers can submit reviews.' });

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, parsed.data.bookingId)).limit(1);
    if (!booking || booking.customerId !== customerId) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const [existingReview] = await db.select().from(reviews).where(eq(reviews.bookingId, booking.id)).limit(1);
    if (!canCustomerReviewBooking(booking.status as BookingStatus, Boolean(existingReview))) {
      return res.status(400).json({
        success: false,
        message: existingReview
          ? 'You have already reviewed this booking.'
          : 'Only completed bookings are eligible for customer reviews.',
      });
    }

    const sentiment = parsed.data.rating >= 4 ? 'Positive' : parsed.data.rating === 3 ? 'Neutral' : 'Needs Attention';
    const [created] = await db
      .insert(reviews)
      .values({
        bookingId: booking.id,
        customerId,
        rating: parsed.data.rating,
        title: parsed.data.title.trim(),
        comment: parsed.data.comment.trim(),
        isApproved: true,
        aiSentiment: sentiment,
      })
      .returning();

    await notifyAllAdmins({
      title: `New ${parsed.data.rating}★ Review on ${booking.bookingCode}`,
      message: `${req.authUser!.name}: "${parsed.data.title}"`,
      type: 'REVIEW',
      linkUrl: '/dashboard/admin/reviews',
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Submit review error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit review.' });
  }
});

router.patch('/reviews/:id/moderate', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (!existing) return res.status(404).json({ success: false, message: 'Review not found.' });
    const [updated] = await db.update(reviews).set({ isApproved: !existing.isApproved }).where(eq(reviews.id, id)).returning();
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to moderate review.' });
  }
});

router.delete('/reviews/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await db.delete(reviews).where(eq(reviews.id, Number(req.params.id)));
    res.json({ success: true, message: 'Review deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete review.' });
  }
});

// ==================== NOTIFICATIONS ====================
router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.authUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const unreadCount = rows.filter((n) => !n.isRead).length;
    res.json({ success: true, data: { items: rows, unreadCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load notifications.' });
  }
});

router.patch('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, Number(req.params.id)), eq(notifications.userId, req.authUser!.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
});

router.patch('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, req.authUser!.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications read.' });
  }
});

router.post('/notifications/broadcast', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().min(2).max(120),
      message: z.string().min(4).max(400),
      targetRole: z.enum(['ALL', 'CUSTOMER', 'STAFF']).default('ALL'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const targetUsers =
      parsed.data.targetRole === 'ALL'
        ? await db.select({ id: users.id }).from(users)
        : await db.select({ id: users.id }).from(users).where(eq(users.role, parsed.data.targetRole));

    for (const u of targetUsers) {
      await createNotification({
        userId: u.id,
        title: parsed.data.title,
        message: parsed.data.message,
        type: 'SYSTEM',
      });
    }
    res.json({ success: true, message: `Broadcast sent to ${targetUsers.length} users.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Broadcast failed.' });
  }
});

// ==================== SUPPORT TICKETS ====================
router.get('/support', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const tickets =
      user.role === 'ADMIN'
        ? await db
            .select({
              ticket: supportTickets,
              customerName: users.name,
              customerEmail: users.email,
            })
            .from(supportTickets)
            .innerJoin(customers, eq(supportTickets.customerId, customers.id))
            .innerJoin(users, eq(customers.userId, users.id))
            .orderBy(desc(supportTickets.updatedAt))
        : user.customerId
          ? await db
              .select({ ticket: supportTickets })
              .from(supportTickets)
              .where(eq(supportTickets.customerId, user.customerId))
              .orderBy(desc(supportTickets.updatedAt))
          : [];

    const allMsgs = await db.select().from(supportMessages).orderBy(supportMessages.createdAt);
    const msgMap = new Map<number, typeof allMsgs>();
    for (const m of allMsgs) {
      const list = msgMap.get(m.ticketId) || [];
      list.push(m);
      msgMap.set(m.ticketId, list);
    }

    res.json({
      success: true,
      data: tickets.map((t: any) => ({
        ...t.ticket,
        customerName: t.customerName || user.name,
        customerEmail: t.customerEmail || user.email,
        messages: msgMap.get(t.ticket.id) || [],
      })),
    });
  } catch (err) {
    console.error('Load tickets error:', err);
    res.status(500).json({ success: false, message: 'Failed to load support tickets.' });
  }
});

router.post('/support', requireAuth, async (req: AuthRequest, res) => {
  try {
    const customerId = req.authUser!.customerId;
    if (!customerId) return res.status(403).json({ success: false, message: 'Only customers can open support tickets.' });

    const schema = z.object({
      bookingId: z.number().int().positive().nullable().optional(),
      category: z.string().min(2).max(60),
      subject: z.string().min(3).max(140),
      description: z.string().min(8).max(1000),
      priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const ticketNumber = `TKT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`;
    const created = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .insert(supportTickets)
        .values({
          ticketNumber,
          customerId,
          bookingId: parsed.data.bookingId || null,
          category: parsed.data.category,
          subject: parsed.data.subject.trim(),
          description: parsed.data.description.trim(),
          priority: parsed.data.priority,
          status: 'Open',
        })
        .returning();

      await tx.insert(supportMessages).values({
        ticketId: ticket.id,
        senderUserId: req.authUser!.id,
        senderRole: 'CUSTOMER',
        message: parsed.data.description.trim(),
      });

      return ticket;
    });

    await notifyAllAdmins({
      title: `New Support Ticket: ${ticketNumber}`,
      message: `${req.authUser!.name} opened "${parsed.data.subject}"`,
      type: 'SUPPORT',
      linkUrl: '/dashboard/admin/support',
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create support ticket.' });
  }
});

router.post('/support/:id/reply', requireAuth, async (req: AuthRequest, res) => {
  try {
    const ticketId = Number(req.params.id);
    const schema = z.object({
      message: z.string().min(1).max(1000),
      status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Reply message is required.' });

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    if (req.authUser!.role === 'CUSTOMER' && ticket.customerId !== req.authUser!.customerId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await db.insert(supportMessages).values({
      ticketId,
      senderUserId: req.authUser!.id,
      senderRole: req.authUser!.role,
      message: parsed.data.message.trim(),
    });

    const nextStatus =
      req.authUser!.role === 'ADMIN' && parsed.data.status ? parsed.data.status : ticket.status === 'Open' && req.authUser!.role === 'ADMIN' ? 'In Progress' : ticket.status;

    await db.update(supportTickets).set({ status: nextStatus, updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));

    if (req.authUser!.role === 'ADMIN') {
      const [cust] = await db.select({ userId: customers.userId }).from(customers).where(eq(customers.id, ticket.customerId)).limit(1);
      if (cust) {
        await createNotification({
          userId: cust.userId,
          title: `Support Update: ${ticket.ticketNumber}`,
          message: `Admin replied to "${ticket.subject}". Status: ${nextStatus}.`,
          type: 'SUPPORT',
          linkUrl: '/dashboard/customer/support',
        });
      }
    }

    res.json({ success: true, message: 'Reply posted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to post reply.' });
  }
});

// ==================== NEWSLETTER & SETTINGS ====================
router.post('/newsletter', async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });

    await db
      .insert(newsletterSubscribers)
      .values({ email: parsed.data.email.toLowerCase().trim() })
      .onConflictDoNothing();

    res.json({ success: true, message: 'Thank you for subscribing to CaterEase seasonal menus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Subscription failed.' });
  }
});

router.get('/settings', async (_req, res) => {
  try {
    const rows = await db.select().from(businessSettings);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    res.json({ success: true, data: map });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load settings.' });
  }
});

router.put('/settings', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const entries = Object.entries(req.body as Record<string, unknown>);
    for (const [key, val] of entries) {
      await db
        .insert(businessSettings)
        .values({ key, value: String(val) })
        .onConflictDoUpdate({
          target: businessSettings.key,
          set: { value: String(val), updatedAt: new Date() },
        });
    }
    res.json({ success: true, message: 'Business settings saved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save settings.' });
  }
});

// ==================== ADMIN ANALYTICS (RECHARTS) ====================
router.get('/analytics/overview', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const [allBookings, allPayments, allCustomers, allStaff, allInventory, allDetails] = await Promise.all([
      db.select().from(bookings),
      db.select().from(payments),
      db.select().from(customers),
      db.select().from(staff),
      db.select().from(inventory),
      db.select().from(bookingDetails),
    ]);

    const totalRevenue = allPayments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const statusCounts: Record<string, number> = {};
    const categoryRevenue: Record<string, number> = {};
    const monthlyMap: Record<string, { month: string; revenue: number; bookings: number }> = {};

    for (const b of allBookings) {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
      if (b.status !== 'Cancelled') {
        categoryRevenue[b.eventType] = (categoryRevenue[b.eventType] || 0) + Number(b.totalAmount);
      }
      const monthKey = (b.eventDate || '').slice(0, 7) || '2026-11';
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { month: monthKey, revenue: 0, bookings: 0 };
      monthlyMap[monthKey].bookings += 1;
      if (b.status !== 'Cancelled') {
        monthlyMap[monthKey].revenue += Number(b.totalAmount);
      }
    }

    const monthlyRevenue = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    const bookingStatusChart = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    const revenueByEventCategory = Object.entries(categoryRevenue).map(([category, revenue]) => ({
      category,
      revenue: Math.round(revenue),
    }));

    const methodMap: Record<string, number> = {};
    for (const p of allPayments.filter((x) => x.status === 'PAID')) {
      methodMap[p.method] = (methodMap[p.method] || 0) + Number(p.amount);
    }
    const paymentMethods = Object.entries(methodMap).map(([method, amount]) => ({
      method,
      amount: Math.round(amount),
    }));

    const itemQty: Record<string, number> = {};
    for (const d of allDetails) {
      itemQty[d.itemName] = (itemQty[d.itemName] || 0) + d.quantity;
    }
    const popularItems = Object.entries(itemQty)
      .map(([name, orders]) => ({ name, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 6);

    const lowStockItems = allInventory.filter((i) => isLowStock(Number(i.quantity), Number(i.minStockLevel)));

    // Weekly bookings breakdown from event dates/created_at
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyBookings = weekDays.map((day, idx) => ({
      day,
      bookings: allBookings.filter((b) => new Date(b.createdAt).getDay() === ((idx + 1) % 7)).length,
    }));

    // Customer growth cumulative by month
    const custMonthMap: Record<string, number> = {};
    for (const c of allCustomers) {
      const m = new Date(c.createdAt).toISOString().slice(0, 7);
      custMonthMap[m] = (custMonthMap[m] || 0) + 1;
    }
    const customerGrowth = Object.entries(custMonthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, newCustomers]) => ({ month, newCustomers }));

    res.json({
      success: true,
      data: {
        kpis: {
          totalRevenue: Math.round(totalRevenue),
          totalBookings: allBookings.length,
          totalCustomers: allCustomers.length,
          totalStaff: allStaff.length,
          pendingBookings: statusCounts['Pending'] || 0,
          completedEvents: statusCounts['Completed'] || 0,
          cancelledBookings: statusCounts['Cancelled'] || 0,
          lowStockCount: lowStockItems.length,
        },
        lowStockItems,
        recentTransactions: allPayments.slice(0, 6),
        charts: {
          monthlyRevenue,
          weeklyBookings,
          bookingStatusChart,
          popularItems,
          revenueByEventCategory,
          customerGrowth,
          paymentMethods,
        },
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute analytics.' });
  }
});

// CSV Export for Admin Reports
router.get('/analytics/export', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const rows = await db.select().from(bookings).orderBy(desc(bookings.createdAt));
    const header = 'BookingCode,EventName,EventType,EventDate,Guests,Status,PaymentStatus,TotalAmount,PaidAmount\n';
    const body = rows
      .map(
        (b) =>
          `"${b.bookingCode}","${b.eventName.replace(/"/g, '""')}","${b.eventType}","${b.eventDate}",${b.guestCount},"${b.status}","${b.paymentStatus}",${b.totalAmount},${b.paidAmount}`
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="caterease-bookings-report.csv"');
    res.send(header + body);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed.' });
  }
});

export default router;
