import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  bookings,
  bookingDetails,
  bookingTimeline,
  cateringPackages,
  coupons,
  customers,
  events,
  foodItems,
  payments,
  reviews,
  staff,
  staffAssignments,
  users,
} from '../../db/schema.ts';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.ts';
import { calculateBookingPricing } from '../../utils/pricing.ts';
import { canCustomerEditBooking, canTransitionBookingStatus, type BookingStatus } from '../../utils/bookingWorkflow.ts';
import { createNotification, notifyAllAdmins } from '../services/notificationService.ts';
import { generateQrDataUrl, streamKitchenPrepSheetPdf } from '../services/invoiceService.ts';
import { emitRealtimeEvent } from '../services/realtimeService.ts';
import { buildKitchenComplianceMatrix } from '../../utils/kitchenSheet.ts';

const router = Router();

const createBookingSchema = z.object({
  packageId: z.number().int().positive().optional().nullable(),
  items: z
    .array(
      z.object({
        foodItemId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        notes: z.string().max(200).optional(),
      })
    )
    .default([]),
  eventName: z.string().min(3).max(120),
  eventType: z.string().min(2).max(60),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format'),
  eventTime: z.string().min(3).max(20),
  eventLocation: z.string().min(4).max(250),
  guestCount: z.number().int().min(10).max(5000),
  dietaryRequirements: z.string().max(400).optional(),
  specialInstructions: z.string().max(500).optional(),
  contactName: z.string().min(2).max(100),
  contactPhone: z.string().min(6).max(30),
  contactEmail: z.string().email(),
  budget: z.number().nonnegative().optional().nullable(),
  deliveryRequirements: z.string().max(120).default('Full Service Setup'),
  couponCode: z.string().max(40).optional().nullable(),
});

// Create Booking (Server recalculates every price & validates schedule conflicts)
router.post('/bookings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid booking input.' });
    }

    const data = parsed.data;
    if (!data.packageId && data.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Select a catering package or at least one food item.' });
    }

    const customerId = req.authUser!.customerId;
    if (!customerId) {
      return res.status(403).json({ success: false, message: 'Only customer accounts can place catering bookings.' });
    }

    // Prevent past event dates
    const todayStr = new Date().toISOString().slice(0, 10);
    if (data.eventDate < todayStr) {
      return res.status(400).json({ success: false, message: 'Event date cannot be in the past.' });
    }

    // Check capacity / conflicting event schedule on exact date + time + location
    const existingConflict = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.eventDate, data.eventDate),
          eq(bookings.eventTime, data.eventTime),
          eq(bookings.eventLocation, data.eventLocation.trim()),
          ne(bookings.status, 'Cancelled')
        )
      )
      .limit(1);
    if (existingConflict.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A booking already exists at this exact venue, date, and time slot.',
      });
    }

    // Load authoritative package & food items from DB
    let pkgRow: typeof cateringPackages.$inferSelect | null = null;
    if (data.packageId) {
      const [found] = await db.select().from(cateringPackages).where(eq(cateringPackages.id, data.packageId)).limit(1);
      if (!found || !found.isAvailable) {
        return res.status(400).json({ success: false, message: 'Selected catering package is unavailable.' });
      }
      if (data.guestCount < found.minGuests) {
        return res.status(400).json({
          success: false,
          message: `Package "${found.name}" requires a minimum of ${found.minGuests} guests.`,
        });
      }
      pkgRow = found;
    }

    const itemIds = data.items.map((i) => i.foodItemId);
    const dbFoodItems =
      itemIds.length > 0 ? await db.select().from(foodItems).where(inArray(foodItems.id, itemIds)) : [];
    const foodMap = new Map(dbFoodItems.map((f) => [f.id, f]));

    const lineItems = data.items.map((item) => {
      const dbItem = foodMap.get(item.foodItemId);
      if (!dbItem || !dbItem.isAvailable) {
        throw new Error(`Item ID ${item.foodItemId} is unavailable.`);
      }
      return {
        foodItemId: dbItem.id,
        itemName: dbItem.name,
        quantity: item.quantity,
        unitPrice: Number(dbItem.price),
        totalPrice: Number(dbItem.price) * item.quantity,
        notes: item.notes || null,
      };
    });

    // Validate coupon if provided
    let couponRow: typeof coupons.$inferSelect | null = null;
    let customerUsageCount = 0;
    if (data.couponCode && data.couponCode.trim()) {
      const codeUpper = data.couponCode.trim().toUpperCase();
      const [foundCoupon] = await db.select().from(coupons).where(eq(coupons.code, codeUpper)).limit(1);
      if (!foundCoupon) {
        return res.status(400).json({ success: false, message: `Coupon code "${codeUpper}" was not found.` });
      }
      const prevUses = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.customerId, customerId),
            eq(bookings.couponCode, codeUpper),
            ne(bookings.status, 'Cancelled')
          )
        );
      customerUsageCount = prevUses.length;
      couponRow = foundCoupon;
    }

    const pricing = calculateBookingPricing({
      items: lineItems.map((li) => ({ unitPrice: li.unitPrice, quantity: li.quantity })),
      packageInput: pkgRow
        ? {
            pricePerPerson: Number(pkgRow.pricePerPerson),
            guestCount: data.guestCount,
            minGuests: pkgRow.minGuests,
          }
        : null,
      coupon: couponRow
        ? {
            code: couponRow.code,
            discountType: couponRow.discountType as 'PERCENTAGE' | 'FIXED',
            discountValue: Number(couponRow.discountValue),
            minOrderValue: Number(couponRow.minOrderValue),
            maxDiscount: couponRow.maxDiscount ? Number(couponRow.maxDiscount) : null,
            startDate: couponRow.startDate,
            expiryDate: couponRow.expiryDate,
            usageLimit: couponRow.usageLimit,
            usedCount: couponRow.usedCount,
            isActive: couponRow.isActive,
          }
        : null,
      customerCouponUsageCount: customerUsageCount,
      perCustomerLimit: couponRow?.perCustomerLimit ?? 1,
    });

    if (pricing.couponError) {
      return res.status(400).json({ success: false, message: pricing.couponError });
    }

    const bookingCode = `CE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const qrToken = `qr-${crypto.randomUUID()}`;

    const createdBooking = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(bookings)
        .values({
          bookingCode,
          customerId,
          packageId: pkgRow?.id || null,
          eventName: data.eventName.trim(),
          eventType: data.eventType.trim(),
          eventDate: data.eventDate,
          eventTime: data.eventTime.trim(),
          eventLocation: data.eventLocation.trim(),
          guestCount: data.guestCount,
          dietaryRequirements: data.dietaryRequirements || null,
          specialInstructions: data.specialInstructions || null,
          contactName: data.contactName.trim(),
          contactPhone: data.contactPhone.trim(),
          contactEmail: data.contactEmail.trim(),
          budget: data.budget ? data.budget.toFixed(2) : null,
          deliveryRequirements: data.deliveryRequirements,
          status: 'Pending',
          subtotal: pricing.subtotal.toFixed(2),
          taxAmount: pricing.taxAmount.toFixed(2),
          deliveryCharge: pricing.deliveryCharge.toFixed(2),
          discountAmount: pricing.discountAmount.toFixed(2),
          totalAmount: pricing.totalAmount.toFixed(2),
          paidAmount: '0.00',
          paymentStatus: 'Unpaid',
          couponCode: couponRow ? couponRow.code : null,
          qrToken,
        })
        .returning();

      if (lineItems.length > 0) {
        await tx.insert(bookingDetails).values(
          lineItems.map((li) => ({
            bookingId: inserted.id,
            foodItemId: li.foodItemId,
            itemName: li.itemName,
            quantity: li.quantity,
            unitPrice: li.unitPrice.toFixed(2),
            totalPrice: li.totalPrice.toFixed(2),
            notes: li.notes,
          }))
        );
      }

      await tx.insert(bookingTimeline).values({
        bookingId: inserted.id,
        status: 'Pending',
        note: 'Booking submitted and awaiting confirmation.',
        updatedByRole: 'CUSTOMER',
      });

      await tx.insert(events).values({
        bookingId: inserted.id,
        title: inserted.eventName,
        eventDate: inserted.eventDate,
        startTime: inserted.eventTime,
        venue: inserted.eventLocation,
        guestCount: inserted.guestCount,
        status: 'Scheduled',
      });

      if (couponRow) {
        await tx
          .update(coupons)
          .set({ usedCount: sql`${coupons.usedCount} + 1` })
          .where(eq(coupons.id, couponRow.id));
      }

      return inserted;
    });

    await createNotification({
      userId: req.authUser!.id,
      title: `Booking Received: ${createdBooking.bookingCode}`,
      message: `Your catering request for ${createdBooking.eventName} (${createdBooking.guestCount} guests on ${createdBooking.eventDate}) has been logged.`,
      type: 'BOOKING',
      linkUrl: `/dashboard/customer/bookings/${createdBooking.id}`,
      emailSubject: `CaterEase Booking Received — ${createdBooking.bookingCode}`,
    });

    await notifyAllAdmins({
      title: `New Booking: ${createdBooking.bookingCode}`,
      message: `${createdBooking.contactName} booked ${createdBooking.eventName} for ${createdBooking.guestCount} guests on ${createdBooking.eventDate}.`,
      type: 'BOOKING',
      linkUrl: '/dashboard/admin/bookings',
    });

    emitRealtimeEvent({
      event: 'booking:created',
      targetRoles: ['ADMIN'],
      targetUserIds: [req.authUser!.id],
      payload: {
        bookingId: createdBooking.id,
        bookingCode: createdBooking.bookingCode,
        status: createdBooking.status,
        eventName: createdBooking.eventName,
      },
    });

    return res.status(201).json({ success: true, data: createdBooking });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ success: false, message: err instanceof Error ? err.message : 'Failed to create booking.' });
  }
});

// List Bookings (Scoped strictly by backend role)
router.get('/bookings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const { status } = req.query;

    let rows: any[];
    if (user.role === 'ADMIN') {
      rows = await db
        .select({
          booking: bookings,
          packageName: cateringPackages.name,
          customerName: users.name,
          customerEmail: users.email,
        })
        .from(bookings)
        .leftJoin(cateringPackages, eq(bookings.packageId, cateringPackages.id))
        .leftJoin(customers, eq(bookings.customerId, customers.id))
        .leftJoin(users, eq(customers.userId, users.id))
        .where(status && status !== 'All' ? eq(bookings.status, String(status)) : undefined)
        .orderBy(desc(bookings.createdAt));
    } else if (user.role === 'STAFF' && user.staffId) {
      rows = await db
        .select({
          booking: bookings,
          packageName: cateringPackages.name,
          assignment: staffAssignments,
        })
        .from(staffAssignments)
        .innerJoin(bookings, eq(staffAssignments.bookingId, bookings.id))
        .leftJoin(cateringPackages, eq(bookings.packageId, cateringPackages.id))
        .where(eq(staffAssignments.staffId, user.staffId))
        .orderBy(desc(bookings.eventDate));
    } else if (user.customerId) {
      rows = await db
        .select({
          booking: bookings,
          packageName: cateringPackages.name,
        })
        .from(bookings)
        .leftJoin(cateringPackages, eq(bookings.packageId, cateringPackages.id))
        .where(eq(bookings.customerId, user.customerId))
        .orderBy(desc(bookings.createdAt));
    } else {
      rows = [];
    }

    const formatted = rows.map((r: any) => ({
      ...r.booking,
      packageName: r.packageName || null,
      customerName: r.customerName || r.booking.contactName,
      customerEmail: r.customerEmail || r.booking.contactEmail,
      assignment: r.assignment || null,
    }));

    return res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('List bookings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load bookings.' });
  }
});

// Get Single Booking Detail (Ownership verified)
router.get('/bookings/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const [row] = await db
      .select({
        booking: bookings,
        packageInfo: cateringPackages,
      })
      .from(bookings)
      .leftJoin(cateringPackages, eq(bookings.packageId, cateringPackages.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!row) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const user = req.authUser!;
    if (user.role === 'CUSTOMER' && row.booking.customerId !== user.customerId) {
      return res.status(403).json({ success: false, message: 'Access denied to this booking.' });
    }
    if (user.role === 'STAFF') {
      const [assigned] = await db
        .select()
        .from(staffAssignments)
        .where(and(eq(staffAssignments.bookingId, bookingId), eq(staffAssignments.staffId, user.staffId || -1)))
        .limit(1);
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this booking.' });
      }
    }

    const [itemsWithFood, timeline, paymentList, assignments, reviewList] = await Promise.all([
      db
        .select({
          detail: bookingDetails,
          dietaryType: foodItems.dietaryType,
          allergens: foodItems.allergens,
          prepTimeMins: foodItems.prepTimeMins,
        })
        .from(bookingDetails)
        .leftJoin(foodItems, eq(bookingDetails.foodItemId, foodItems.id))
        .where(eq(bookingDetails.bookingId, bookingId)),
      db.select().from(bookingTimeline).where(eq(bookingTimeline.bookingId, bookingId)).orderBy(desc(bookingTimeline.createdAt)),
      db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(desc(payments.createdAt)),
      db
        .select({
          assignment: staffAssignments,
          staffName: users.name,
          staffCode: staff.staffCode,
          roleTitle: staff.roleTitle,
        })
        .from(staffAssignments)
        .innerJoin(staff, eq(staffAssignments.staffId, staff.id))
        .innerJoin(users, eq(staff.userId, users.id))
        .where(eq(staffAssignments.bookingId, bookingId)),
      db.select().from(reviews).where(eq(reviews.bookingId, bookingId)).limit(1),
    ]);

    const items = itemsWithFood.map((rowItem) => ({
      ...rowItem.detail,
      dietaryType: rowItem.dietaryType || 'Veg',
      allergens: rowItem.allergens || 'None',
      prepTimeMins: rowItem.prepTimeMins || 45,
    }));

    const kitchenMatrix = buildKitchenComplianceMatrix(
      items,
      row.booking.guestCount,
      row.packageInfo?.includedItemsJson || [],
      row.booking.dietaryRequirements
    );

    const appBase = process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL' ? process.env.APP_URL : `${req.protocol}://${req.get('host')}`;
    const verifyUrl = `${appBase}/verify/${row.booking.qrToken}`;
    const qrDataUrl = await generateQrDataUrl(verifyUrl);

    return res.json({
      success: true,
      data: {
        ...row.booking,
        packageInfo: row.packageInfo,
        items,
        kitchenMatrix,
        timeline,
        payments: paymentList,
        staffAssignments: assignments.map((a) => ({
          ...a.assignment,
          staffName: a.staffName,
          staffCode: a.staffCode,
          roleTitle: a.roleTitle,
        })),
        review: reviewList[0] || null,
        qrDataUrl,
        verifyUrl,
      },
    });
  } catch (err) {
    console.error('Get booking detail error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load booking details.' });
  }
});

// Customer edit eligible booking
router.put('/bookings/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const [existing] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!existing) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const user = req.authUser!;
    if (user.role === 'CUSTOMER' && existing.customerId !== user.customerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }
    if (user.role === 'CUSTOMER' && !canCustomerEditBooking(existing.status as BookingStatus)) {
      return res.status(400).json({ success: false, message: `Bookings in "${existing.status}" status cannot be edited.` });
    }

    const editSchema = z.object({
      eventName: z.string().min(3).max(120).optional(),
      eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      eventTime: z.string().min(3).max(20).optional(),
      eventLocation: z.string().min(4).max(250).optional(),
      dietaryRequirements: z.string().max(400).optional(),
      specialInstructions: z.string().max(500).optional(),
    });
    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const [updated] = await db
      .update(bookings)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    await db.insert(bookingTimeline).values({
      bookingId,
      status: updated.status,
      note: 'Booking event details updated.',
      updatedByRole: user.role,
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update booking error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update booking.' });
  }
});

// Update Booking Status (Workflow + RBAC enforced)
router.patch('/bookings/:id/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const schema = z.object({
      status: z.enum(['Pending', 'Confirmed', 'Preparing', 'Ready for Delivery', 'Event in Progress', 'Completed', 'Cancelled']),
      note: z.string().max(300).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid status value.' });

    const [existing] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!existing) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const user = req.authUser!;
    if (user.role === 'CUSTOMER' && existing.customerId !== user.customerId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (user.role === 'STAFF') {
      const [assigned] = await db
        .select()
        .from(staffAssignments)
        .where(and(eq(staffAssignments.bookingId, bookingId), eq(staffAssignments.staffId, user.staffId || -1)))
        .limit(1);
      if (!assigned) return res.status(403).json({ success: false, message: 'Not assigned to this event.' });
    }

    const transition = canTransitionBookingStatus(existing.status as BookingStatus, parsed.data.status, user.role);
    if (!transition.allowed) {
      return res.status(400).json({ success: false, message: transition.reason });
    }

    const [updated] = await db
      .update(bookings)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    await db.insert(bookingTimeline).values({
      bookingId,
      status: parsed.data.status,
      note: parsed.data.note || `Status changed from ${existing.status} to ${parsed.data.status}.`,
      updatedByRole: user.role,
    });

    if (parsed.data.status === 'Completed' || parsed.data.status === 'Cancelled') {
      await db
        .update(events)
        .set({ status: parsed.data.status })
        .where(eq(events.bookingId, bookingId));
    }

    // Notify Customer
    const [cust] = await db.select({ userId: customers.userId }).from(customers).where(eq(customers.id, existing.customerId)).limit(1);
    if (cust) {
      await createNotification({
        userId: cust.userId,
        title: `Booking ${existing.bookingCode}: ${parsed.data.status}`,
        message: `Your event "${existing.eventName}" status is now ${parsed.data.status}.`,
        type: 'BOOKING',
        linkUrl: `/dashboard/customer/bookings/${existing.id}`,
        emailSubject: `CaterEase Booking Update (${existing.bookingCode}): ${parsed.data.status}`,
      });
    }

    const assignedStaffRows = await db
      .select({ userId: staff.userId })
      .from(staffAssignments)
      .innerJoin(staff, eq(staffAssignments.staffId, staff.id))
      .where(eq(staffAssignments.bookingId, bookingId));

    emitRealtimeEvent({
      event: 'booking:status',
      targetUserIds: [
        ...(cust ? [cust.userId] : []),
        ...assignedStaffRows.map((r) => r.userId),
      ],
      targetRoles: ['ADMIN'],
      payload: {
        bookingId,
        bookingCode: existing.bookingCode,
        eventName: existing.eventName,
        status: parsed.data.status,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Status update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update booking status.' });
  }
});

// Download Kitchen Prep, Allergen & Packing Sheet PDF
router.get('/bookings/:id/kitchen-sheet/pdf', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const [row] = await db
      .select({
        booking: bookings,
        packageInfo: cateringPackages,
      })
      .from(bookings)
      .leftJoin(cateringPackages, eq(bookings.packageId, cateringPackages.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!row) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const user = req.authUser!;
    if (user.role === 'CUSTOMER' && row.booking.customerId !== user.customerId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (user.role === 'STAFF') {
      const [assigned] = await db
        .select()
        .from(staffAssignments)
        .where(and(eq(staffAssignments.bookingId, bookingId), eq(staffAssignments.staffId, user.staffId || -1)))
        .limit(1);
      if (!assigned) {
        return res.status(403).json({ success: false, message: 'Not assigned to this booking.' });
      }
    }

    const [itemsWithFood, assignments] = await Promise.all([
      db
        .select({
          detail: bookingDetails,
          dietaryType: foodItems.dietaryType,
          allergens: foodItems.allergens,
          prepTimeMins: foodItems.prepTimeMins,
        })
        .from(bookingDetails)
        .leftJoin(foodItems, eq(bookingDetails.foodItemId, foodItems.id))
        .where(eq(bookingDetails.bookingId, bookingId)),
      db
        .select({
          assignment: staffAssignments,
          staffName: users.name,
          staffCode: staff.staffCode,
        })
        .from(staffAssignments)
        .innerJoin(staff, eq(staffAssignments.staffId, staff.id))
        .innerJoin(users, eq(staff.userId, users.id))
        .where(eq(staffAssignments.bookingId, bookingId)),
    ]);

    streamKitchenPrepSheetPdf(res, {
      bookingCode: row.booking.bookingCode,
      eventName: row.booking.eventName,
      eventType: row.booking.eventType,
      eventDate: row.booking.eventDate,
      eventTime: row.booking.eventTime,
      eventLocation: row.booking.eventLocation,
      guestCount: row.booking.guestCount,
      contactName: row.booking.contactName,
      contactPhone: row.booking.contactPhone,
      deliveryRequirements: row.booking.deliveryRequirements,
      dietaryRequirements: row.booking.dietaryRequirements,
      specialInstructions: row.booking.specialInstructions,
      packageName: row.packageInfo?.name || null,
      packageIncludedItems: row.packageInfo?.includedItemsJson || [],
      items: itemsWithFood.map((r) => ({
        itemName: r.detail.itemName,
        quantity: r.detail.quantity,
        dietaryType: r.dietaryType || 'Veg',
        allergens: r.allergens || 'None',
        prepTimeMins: r.prepTimeMins || 45,
      })),
      staffRoster: assignments.map((a) => ({
        staffName: a.staffName,
        staffCode: a.staffCode,
        assignedRole: a.assignment.assignedRole,
        taskSummary: a.assignment.taskSummary,
      })),
    });
  } catch (err) {
    console.error('Kitchen prep sheet PDF error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate kitchen prep sheet PDF.' });
  }
});

// Public Non-Sensitive QR Code Verification Endpoint
router.get('/qr/verify/:token', async (req, res) => {
  try {
    const [row] = await db
      .select({
        bookingCode: bookings.bookingCode,
        eventName: bookings.eventName,
        eventType: bookings.eventType,
        eventDate: bookings.eventDate,
        eventTime: bookings.eventTime,
        guestCount: bookings.guestCount,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        packageName: cateringPackages.name,
      })
      .from(bookings)
      .leftJoin(cateringPackages, eq(bookings.packageId, cateringPackages.id))
      .where(eq(bookings.qrToken, req.params.token))
      .limit(1);

    if (!row) {
      return res.status(404).json({ success: false, message: 'Verification token is invalid or expired.' });
    }

    return res.json({ success: true, data: { ...row, verified: true } });
  } catch (err) {
    console.error('QR verify error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

export default router;
