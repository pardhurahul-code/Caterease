import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  bookings,
  coupons,
  customerPreferences,
  customers,
  events,
  foodItems,
  inventory,
  staff,
  staffAssignments,
  stockTransactions,
  suppliers,
  tastingRequests,
  users,
} from '../../db/schema.ts';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.ts';
import { computeStockUpdate, getExpiryStatus, isLowStock } from '../../utils/inventoryLogic.ts';
import { detectStaffScheduleConflict } from '../../utils/staffSchedule.ts';
import { validateCoupon } from '../../utils/pricing.ts';
import { createNotification, notifyAllAdmins } from '../services/notificationService.ts';
import { emitRealtimeEvent } from '../services/realtimeService.ts';

const router = Router();

// ==================== COUPONS ====================
router.get('/coupons/active', async (_req, res) => {
  try {
    const rows = await db.select().from(coupons).where(eq(coupons.isActive, true)).orderBy(desc(coupons.createdAt));
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Active coupons error:', err);
    res.status(500).json({ success: false, message: 'Failed to load active coupons.' });
  }
});

router.post('/coupons/validate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      code: z.string().min(2).max(40),
      subtotal: z.number().nonnegative(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Provide coupon code and subtotal.' });

    const codeUpper = parsed.data.code.trim().toUpperCase();
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, codeUpper)).limit(1);
    if (!coupon) return res.status(404).json({ success: false, message: `Coupon "${codeUpper}" not found.` });

    let customerUses = 0;
    if (req.authUser!.customerId) {
      const prev = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.customerId, req.authUser!.customerId),
            eq(bookings.couponCode, codeUpper),
            ne(bookings.status, 'Cancelled')
          )
        );
      customerUses = prev.length;
    }

    const result = validateCoupon(
      {
        code: coupon.code,
        discountType: coupon.discountType as 'PERCENTAGE' | 'FIXED',
        discountValue: Number(coupon.discountValue),
        minOrderValue: Number(coupon.minOrderValue),
        maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
        startDate: coupon.startDate,
        expiryDate: coupon.expiryDate,
        usageLimit: coupon.usageLimit,
        usedCount: coupon.usedCount,
        isActive: coupon.isActive,
      },
      parsed.data.subtotal,
      customerUses,
      coupon.perCustomerLimit
    );

    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    return res.json({
      success: true,
      data: {
        code: coupon.code,
        description: coupon.description,
        discountAmount: result.discountAmount,
      },
    });
  } catch (err) {
    console.error('Validate coupon error:', err);
    res.status(500).json({ success: false, message: 'Coupon validation failed.' });
  }
});

router.get('/coupons', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load coupons.' });
  }
});

router.post('/coupons', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const schema = z.object({
      code: z.string().min(3).max(30),
      description: z.string().min(3).max(200),
      discountType: z.enum(['PERCENTAGE', 'FIXED']),
      discountValue: z.number().positive(),
      minOrderValue: z.number().nonnegative().default(0),
      maxDiscount: z.number().nonnegative().nullable().optional(),
      startDate: z.string(),
      expiryDate: z.string(),
      usageLimit: z.number().int().positive().default(100),
      perCustomerLimit: z.number().int().positive().default(1),
      isActive: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const [created] = await db
      .insert(coupons)
      .values({
        code: parsed.data.code.trim().toUpperCase(),
        description: parsed.data.description,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue.toFixed(2),
        minOrderValue: parsed.data.minOrderValue.toFixed(2),
        maxDiscount: parsed.data.maxDiscount ? parsed.data.maxDiscount.toFixed(2) : null,
        startDate: new Date(parsed.data.startDate),
        expiryDate: new Date(parsed.data.expiryDate),
        usageLimit: parsed.data.usageLimit,
        perCustomerLimit: parsed.data.perCustomerLimit,
        isActive: parsed.data.isActive,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Create coupon error:', err);
    res.status(500).json({ success: false, message: 'Failed to create coupon.' });
  }
});

router.patch('/coupons/:id/toggle', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    if (!existing) return res.status(404).json({ success: false, message: 'Coupon not found.' });
    const [updated] = await db.update(coupons).set({ isActive: !existing.isActive }).where(eq(coupons.id, id)).returning();
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to toggle coupon.' });
  }
});

router.delete('/coupons/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await db.delete(coupons).where(eq(coupons.id, Number(req.params.id)));
    res.json({ success: true, message: 'Coupon deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete coupon.' });
  }
});

// ==================== SUPPLIERS ====================
router.get('/suppliers', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const rows = await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load suppliers.' });
  }
});

router.post('/suppliers', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(120),
      contactPerson: z.string().min(2).max(100),
      email: z.string().email(),
      phone: z.string().min(6).max(30),
      address: z.string().min(4).max(200),
      category: z.string().min(2).max(80),
      rating: z.number().min(1).max(5).default(4.5),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const [created] = await db
      .insert(suppliers)
      .values({ ...parsed.data, rating: parsed.data.rating.toFixed(2) })
      .returning();
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create supplier.' });
  }
});

router.delete('/suppliers/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await db.delete(suppliers).where(eq(suppliers.id, Number(req.params.id)));
    res.json({ success: true, message: 'Supplier removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove supplier.' });
  }
});

// ==================== INVENTORY & STOCK TRANSACTIONS ====================
router.get('/inventory', requireAuth, requireRole('ADMIN', 'STAFF'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        item: inventory,
        supplierName: suppliers.name,
      })
      .from(inventory)
      .leftJoin(suppliers, eq(inventory.supplierId, suppliers.id))
      .orderBy(inventory.ingredientName);

    const enriched = rows.map((r) => ({
      ...r.item,
      supplierName: r.supplierName || 'Unassigned',
      isLowStock: isLowStock(Number(r.item.quantity), Number(r.item.minStockLevel)),
      expiryStatus: getExpiryStatus(r.item.expiryDate),
    }));

    const transactions = await db
      .select({
        tx: stockTransactions,
        ingredientName: inventory.ingredientName,
        unit: inventory.unit,
        userName: users.name,
      })
      .from(stockTransactions)
      .innerJoin(inventory, eq(stockTransactions.inventoryId, inventory.id))
      .leftJoin(users, eq(stockTransactions.performedByUserId, users.id))
      .orderBy(desc(stockTransactions.createdAt))
      .limit(40);

    res.json({
      success: true,
      data: {
        items: enriched,
        transactions: transactions.map((t) => ({
          ...t.tx,
          ingredientName: t.ingredientName,
          unit: t.unit,
          performedByName: t.userName || 'System',
        })),
      },
    });
  } catch (err) {
    console.error('Inventory load error:', err);
    res.status(500).json({ success: false, message: 'Failed to load inventory.' });
  }
});

router.post('/inventory', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      ingredientName: z.string().min(2).max(120),
      category: z.string().min(2).max(60),
      quantity: z.number().nonnegative(),
      unit: z.string().min(1).max(20),
      minStockLevel: z.number().nonnegative(),
      supplierId: z.number().int().positive().nullable().optional(),
      purchasePrice: z.number().nonnegative().default(0),
      expiryDate: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const created = await db.transaction(async (tx) => {
      const [item] = await tx
        .insert(inventory)
        .values({
          ingredientName: parsed.data.ingredientName.trim(),
          category: parsed.data.category,
          quantity: parsed.data.quantity.toFixed(2),
          unit: parsed.data.unit,
          minStockLevel: parsed.data.minStockLevel.toFixed(2),
          supplierId: parsed.data.supplierId || null,
          purchasePrice: parsed.data.purchasePrice.toFixed(2),
          expiryDate: parsed.data.expiryDate || null,
        })
        .returning();

      await tx.insert(stockTransactions).values({
        inventoryId: item.id,
        transactionType: 'STOCK_IN',
        quantityChange: parsed.data.quantity.toFixed(2),
        previousQuantity: '0.00',
        newQuantity: parsed.data.quantity.toFixed(2),
        reason: 'Initial inventory registration',
        performedByUserId: req.authUser!.id,
      });

      return item;
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Create inventory error:', err);
    res.status(500).json({ success: false, message: 'Failed to add inventory item.' });
  }
});

router.post('/inventory/:id/transaction', requireAuth, requireRole('ADMIN', 'STAFF'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      transactionType: z.enum(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT']),
      amount: z.number().nonnegative(),
      reason: z.string().min(2).max(200),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const [item] = await db.select().from(inventory).where(eq(inventory.id, id)).limit(1);
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found.' });

    const currentQty = Number(item.quantity);
    const calc = computeStockUpdate(currentQty, parsed.data.transactionType, parsed.data.amount);
    if (!calc.valid) {
      return res.status(400).json({ success: false, message: calc.error });
    }

    const updated = await db.transaction(async (tx) => {
      const [nextItem] = await tx
        .update(inventory)
        .set({ quantity: calc.newQuantity.toFixed(2), lastUpdated: new Date() })
        .where(eq(inventory.id, id))
        .returning();

      await tx.insert(stockTransactions).values({
        inventoryId: id,
        transactionType: parsed.data.transactionType,
        quantityChange: calc.quantityChange.toFixed(2),
        previousQuantity: currentQty.toFixed(2),
        newQuantity: calc.newQuantity.toFixed(2),
        reason: parsed.data.reason.trim(),
        performedByUserId: req.authUser!.id,
      });

      return nextItem;
    });

    if (isLowStock(calc.newQuantity, Number(item.minStockLevel))) {
      await notifyAllAdmins({
        title: `Low Stock Alert: ${item.ingredientName}`,
        message: `Remaining quantity is ${calc.newQuantity} ${item.unit} (minimum threshold: ${item.minStockLevel} ${item.unit}).`,
        type: 'INVENTORY',
        linkUrl: '/dashboard/admin/inventory',
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Inventory transaction error:', err);
    res.status(500).json({ success: false, message: 'Failed to record stock transaction.' });
  }
});

router.delete('/inventory/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await db.delete(inventory).where(eq(inventory.id, Number(req.params.id)));
    res.json({ success: true, message: 'Inventory item deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete inventory item.' });
  }
});

// ==================== STAFF & ASSIGNMENTS ====================
router.get('/staff', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        staff: staff,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
      })
      .from(staff)
      .innerJoin(users, eq(staff.userId, users.id))
      .orderBy(users.name);

    res.json({
      success: true,
      data: rows.map((r) => ({ ...r.staff, name: r.name, email: r.email, isActive: r.isActive })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load staff roster.' });
  }
});

router.post('/staff', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      phone: z.string().min(6).max(30),
      password: z.string().min(6).max(100).default('Staff@123'),
      roleTitle: z.string().min(2).max(80),
      specialization: z.string().min(2).max(120),
      shiftSchedule: z.string().default('08:00 - 20:00'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const email = parsed.data.email.toLowerCase().trim();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered.' });

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const staffCode = `STF-${Math.floor(200 + Math.random() * 799)}`;

    const created = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          uid: `local_${crypto.randomUUID()}`,
          email,
          name: parsed.data.name.trim(),
          phone: parsed.data.phone.trim(),
          passwordHash,
          role: 'STAFF',
          emailVerified: true,
        })
        .returning();

      const [st] = await tx
        .insert(staff)
        .values({
          userId: u.id,
          staffCode,
          roleTitle: parsed.data.roleTitle,
          specialization: parsed.data.specialization,
          phone: parsed.data.phone.trim(),
          shiftSchedule: parsed.data.shiftSchedule,
        })
        .returning();

      return { ...st, name: u.name, email: u.email };
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Create staff error:', err);
    res.status(500).json({ success: false, message: 'Failed to add staff member.' });
  }
});

router.post('/ops/assign-staff', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const schema = z.object({
      bookingId: z.number().int().positive(),
      staffId: z.number().int().positive(),
      assignedRole: z.string().min(2).max(80).default('Kitchen & Service Lead'),
      taskSummary: z.string().min(4).max(300),
      notes: z.string().max(300).optional(),
      forceOverride: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, parsed.data.bookingId)).limit(1);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const [st] = await db.select().from(staff).where(eq(staff.id, parsed.data.staffId)).limit(1);
    if (!st) return res.status(404).json({ success: false, message: 'Staff member not found.' });

    const existingForStaff = await db
      .select({
        bookingId: bookings.id,
        bookingCode: bookings.bookingCode,
        eventName: bookings.eventName,
        eventDate: bookings.eventDate,
        eventTime: bookings.eventTime,
        status: bookings.status,
      })
      .from(staffAssignments)
      .innerJoin(bookings, eq(staffAssignments.bookingId, bookings.id))
      .where(eq(staffAssignments.staffId, parsed.data.staffId));

    const conflictCheck = detectStaffScheduleConflict(existingForStaff, booking.id, booking.eventDate);
    if (conflictCheck.hasConflict && !parsed.data.forceOverride) {
      return res.status(409).json({
        success: false,
        code: 'STAFF_CONFLICT',
        message: `Schedule conflict: Staff member is already assigned to ${conflictCheck.conflict!.bookingCode} (${conflictCheck.conflict!.eventName}) on ${booking.eventDate}.`,
        conflict: conflictCheck.conflict,
      });
    }

    const [assignment] = await db
      .insert(staffAssignments)
      .values({
        bookingId: parsed.data.bookingId,
        staffId: parsed.data.staffId,
        assignedRole: parsed.data.assignedRole,
        taskSummary: parsed.data.taskSummary,
        notes: parsed.data.notes || null,
      })
      .onConflictDoUpdate({
        target: [staffAssignments.bookingId, staffAssignments.staffId],
        set: {
          assignedRole: parsed.data.assignedRole,
          taskSummary: parsed.data.taskSummary,
          notes: parsed.data.notes || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await db.update(events).set({ leadStaffId: st.id }).where(eq(events.bookingId, booking.id));

    await createNotification({
      userId: st.userId,
      title: `New Event Assignment: ${booking.bookingCode}`,
      message: `Assigned as ${parsed.data.assignedRole} for ${booking.eventName} (${booking.guestCount} guests on ${booking.eventDate}).`,
      type: 'STAFF',
      linkUrl: '/dashboard/staff',
    });

    emitRealtimeEvent({
      event: 'staff:assigned',
      targetUserIds: [st.userId],
      targetRoles: ['ADMIN'],
      payload: {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        staffId: st.id,
        eventDate: booking.eventDate,
      },
    });

    res.json({ success: true, data: assignment });
  } catch (err) {
    console.error('Assign staff error:', err);
    res.status(500).json({ success: false, message: 'Failed to assign staff.' });
  }
});

// Staff Shift Calendar Endpoint (Admin sees all crew shifts; Staff sees their own shifts)
router.get('/ops/staff-schedule', requireAuth, requireRole('ADMIN', 'STAFF'), async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const rows = await db
      .select({
        assignmentId: staffAssignments.id,
        assignedRole: staffAssignments.assignedRole,
        taskSummary: staffAssignments.taskSummary,
        prepStatus: staffAssignments.prepStatus,
        deliveryStatus: staffAssignments.deliveryStatus,
        staffId: staff.id,
        staffCode: staff.staffCode,
        roleTitle: staff.roleTitle,
        shiftSchedule: staff.shiftSchedule,
        staffName: users.name,
        bookingId: bookings.id,
        bookingCode: bookings.bookingCode,
        eventName: bookings.eventName,
        eventType: bookings.eventType,
        eventDate: bookings.eventDate,
        eventTime: bookings.eventTime,
        eventLocation: bookings.eventLocation,
        guestCount: bookings.guestCount,
        bookingStatus: bookings.status,
      })
      .from(staffAssignments)
      .innerJoin(staff, eq(staffAssignments.staffId, staff.id))
      .innerJoin(users, eq(staff.userId, users.id))
      .innerJoin(bookings, eq(staffAssignments.bookingId, bookings.id))
      .where(user.role === 'STAFF' && user.staffId ? eq(staffAssignments.staffId, user.staffId) : undefined)
      .orderBy(bookings.eventDate, bookings.eventTime);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Staff schedule error:', err);
    res.status(500).json({ success: false, message: 'Failed to load staff shift calendar.' });
  }
});

// Staff Dashboard: Update assignment prep/delivery status
router.patch('/ops/assignments/:id', requireAuth, requireRole('STAFF', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const assignmentId = Number(req.params.id);
    const schema = z.object({
      prepStatus: z.enum(['PENDING', 'PREPARING', 'READY', 'COMPLETED']).optional(),
      deliveryStatus: z.enum(['PENDING', 'DISPATCHED', 'DELIVERED']).optional(),
      notes: z.string().max(300).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid assignment status.' });

    const [existing] = await db.select().from(staffAssignments).where(eq(staffAssignments.id, assignmentId)).limit(1);
    if (!existing) return res.status(404).json({ success: false, message: 'Assignment not found.' });

    if (req.authUser!.role === 'STAFF' && existing.staffId !== req.authUser!.staffId) {
      return res.status(403).json({ success: false, message: 'You can only update your own assignments.' });
    }

    const [updated] = await db
      .update(staffAssignments)
      .set({
        ...(parsed.data.prepStatus ? { prepStatus: parsed.data.prepStatus } : {}),
        ...(parsed.data.deliveryStatus ? { deliveryStatus: parsed.data.deliveryStatus } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(staffAssignments.id, assignmentId))
      .returning();

    const [bk] = await db
      .select({ id: bookings.id, bookingCode: bookings.bookingCode, customerId: bookings.customerId })
      .from(bookings)
      .where(eq(bookings.id, existing.bookingId))
      .limit(1);

    let customerUserId: number | undefined;
    if (bk) {
      const [cust] = await db.select({ userId: customers.userId }).from(customers).where(eq(customers.id, bk.customerId)).limit(1);
      customerUserId = cust?.userId;
    }

    emitRealtimeEvent({
      event: 'assignment:updated',
      targetUserIds: customerUserId ? [customerUserId] : [],
      targetRoles: ['ADMIN', 'STAFF'],
      payload: {
        bookingId: existing.bookingId,
        bookingCode: bk?.bookingCode,
        prepStatus: updated.prepStatus,
        deliveryStatus: updated.deliveryStatus,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update assignment error:', err);
    res.status(500).json({ success: false, message: 'Failed to update assignment.' });
  }
});

// ==================== CUSTOMERS & PREFERENCES ====================
router.get('/customers', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const rows = await db
      .select({
        customer: customers,
        name: users.name,
        email: users.email,
        phone: users.phone,
        isActive: users.isActive,
      })
      .from(customers)
      .innerJoin(users, eq(customers.userId, users.id))
      .orderBy(desc(customers.createdAt));

    res.json({
      success: true,
      data: rows.map((r) => ({ ...r.customer, name: r.name, email: r.email, phone: r.phone, isActive: r.isActive })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load customers.' });
  }
});

router.put('/customers/preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.authUser!.customerId) return res.status(403).json({ success: false, message: 'Customer account required.' });
    const schema = z.object({
      preferredCuisine: z.string().max(120),
      dietaryRestrictions: z.string().max(200),
      spiceLevel: z.string().max(40),
      favoriteCategories: z.array(z.string()).default([]),
      budgetTier: z.string().max(40),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid preferences.' });

    const [updated] = await db
      .insert(customerPreferences)
      .values({ customerId: req.authUser!.customerId, ...parsed.data })
      .onConflictDoUpdate({
        target: customerPreferences.customerId,
        set: { ...parsed.data, updatedAt: new Date() },
      })
      .returning();

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save preferences.' });
  }
});

// ==================== PRE-EVENT FOOD TASTING REQUESTS ====================
router.get('/tastings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    if (user.role === 'ADMIN') {
      const rows = await db
        .select({
          tasting: tastingRequests,
          customerName: users.name,
          customerEmail: users.email,
          customerPhone: users.phone,
        })
        .from(tastingRequests)
        .innerJoin(customers, eq(tastingRequests.customerId, customers.id))
        .innerJoin(users, eq(customers.userId, users.id))
        .orderBy(desc(tastingRequests.createdAt));

      return res.json({
        success: true,
        data: rows.map((r) => ({
          ...r.tasting,
          customerName: r.customerName,
          customerEmail: r.customerEmail,
          customerPhone: r.customerPhone,
        })),
      });
    }

    if (!user.customerId) {
      return res.json({ success: true, data: [] });
    }

    const rows = await db
      .select()
      .from(tastingRequests)
      .where(eq(tastingRequests.customerId, user.customerId))
      .orderBy(desc(tastingRequests.createdAt));

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Load tastings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load tasting requests.' });
  }
});

router.post('/tastings', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.authUser!.customerId) {
      return res.status(403).json({ success: false, message: 'Customer account required to request tastings.' });
    }
    const schema = z.object({
      eventType: z.string().min(2).max(60),
      estimatedGuests: z.number().int().min(20).max(5000),
      preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format'),
      preferredTime: z.string().min(3).max(20),
      tastingGuests: z.number().int().min(1).max(6).default(2),
      selectedDishIds: z.array(z.number().int().positive()).min(1).max(4),
      dietaryNotes: z.string().max(300).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid tasting request.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (parsed.data.preferredDate < todayStr) {
      return res.status(400).json({ success: false, message: 'Preferred tasting date cannot be in the past.' });
    }

    const dishes = await db
      .select({ id: foodItems.id, name: foodItems.name })
      .from(foodItems)
      .where(inArray(foodItems.id, parsed.data.selectedDishIds));

    if (dishes.length === 0) {
      return res.status(400).json({ success: false, message: 'Select valid dishes from the catalog.' });
    }

    const [created] = await db
      .insert(tastingRequests)
      .values({
        customerId: req.authUser!.customerId,
        eventType: parsed.data.eventType,
        estimatedGuests: parsed.data.estimatedGuests,
        preferredDate: parsed.data.preferredDate,
        preferredTime: parsed.data.preferredTime,
        tastingGuests: parsed.data.tastingGuests,
        selectedDishIdsJson: dishes.map((d) => d.id),
        selectedDishNamesJson: dishes.map((d) => d.name),
        dietaryNotes: parsed.data.dietaryNotes?.trim() || null,
        status: 'Requested',
      })
      .returning();

    await notifyAllAdmins({
      title: `New Food Tasting Request (${parsed.data.eventType})`,
      message: `${req.authUser!.name} requested a tasting on ${parsed.data.preferredDate} at ${parsed.data.preferredTime} for ${dishes.map((d) => d.name).join(', ')}.`,
      type: 'BOOKING',
      linkUrl: '/dashboard/admin/bookings',
    });

    emitRealtimeEvent({
      event: 'tasting:created',
      targetRoles: ['ADMIN'],
      targetUserIds: [req.authUser!.id],
      payload: { tastingId: created.id, status: created.status },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Create tasting error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit tasting request.' });
  }
});

router.patch('/tastings/:id/status', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      status: z.enum(['Requested', 'Scheduled', 'Completed', 'Declined']),
      adminNotes: z.string().max(300).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid tasting update.' });

    const [existing] = await db.select().from(tastingRequests).where(eq(tastingRequests.id, id)).limit(1);
    if (!existing) return res.status(404).json({ success: false, message: 'Tasting request not found.' });

    const [updated] = await db
      .update(tastingRequests)
      .set({
        status: parsed.data.status,
        ...(parsed.data.adminNotes !== undefined ? { adminNotes: parsed.data.adminNotes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tastingRequests.id, id))
      .returning();

    const [cust] = await db.select({ userId: customers.userId }).from(customers).where(eq(customers.id, existing.customerId)).limit(1);
    if (cust) {
      await createNotification({
        userId: cust.userId,
        title: `Food Tasting ${parsed.data.status}`,
        message: `Your tasting session for ${existing.preferredDate} at ${existing.preferredTime} is now ${parsed.data.status}.`,
        type: 'BOOKING',
        linkUrl: '/dashboard/customer',
      });
      emitRealtimeEvent({
        event: 'tasting:updated',
        targetUserIds: [cust.userId],
        targetRoles: ['ADMIN'],
        payload: { tastingId: updated.id, status: updated.status },
      });
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update tasting status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update tasting status.' });
  }
});

export default router;
