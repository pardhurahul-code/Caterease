import { Router } from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  bookings,
  bookingDetails,
  cateringPackages,
  customers,
  invoices,
  payments,
  users,
} from '../../db/schema.ts';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.ts';
import { computeRemainingBalance, derivePaymentStatus } from '../../utils/bookingWorkflow.ts';
import { createNotification, notifyAllAdmins } from '../services/notificationService.ts';
import { streamBookingInvoicePdf } from '../services/invoiceService.ts';

const router = Router();

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.trim() === '' || keySecret.trim() === '') {
    return null;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// Create Payment Order (Real Razorpay if configured, else clearly labelled DEMO PAYMENT MODE)
router.post('/payments/create-order', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      bookingId: z.number().int().positive(),
      paymentType: z.enum(['ADVANCE', 'FULL', 'BALANCE']).default('ADVANCE'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid payment order parameters.' });

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, parsed.data.bookingId)).limit(1);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (req.authUser!.role === 'CUSTOMER' && booking.customerId !== req.authUser!.customerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const total = Number(booking.totalAmount);
    const paid = Number(booking.paidAmount);
    const remaining = computeRemainingBalance(total, paid);

    if (remaining <= 0) {
      return res.status(400).json({ success: false, message: 'This booking is already paid in full.' });
    }

    let amount = remaining;
    if (parsed.data.paymentType === 'ADVANCE' && paid === 0) {
      amount = Math.round(total * 0.3 * 100) / 100;
    }

    const rzp = getRazorpayInstance();
    if (rzp) {
      const order = await rzp.orders.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `${booking.bookingCode}-${Date.now()}`,
      });
      return res.json({
        success: true,
        data: {
          mode: 'RAZORPAY_LIVE',
          isDemo: false,
          orderId: order.id,
          amount,
          currency: 'INR',
          keyId: process.env.RAZORPAY_KEY_ID,
          bookingCode: booking.bookingCode,
        },
      });
    }

    // Clearly labelled Demo Payment Mode
    return res.json({
      success: true,
      data: {
        mode: 'DEMO_PAYMENT_MODE',
        isDemo: true,
        orderId: `demo_order_${crypto.randomBytes(6).toString('hex')}`,
        amount,
        currency: 'INR',
        bookingCode: booking.bookingCode,
        notice: 'DEMO PAYMENT MODE — Simulated test transaction; no real money is charged.',
      },
    });
  } catch (err) {
    console.error('Create payment order error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create payment order.' });
  }
});

// Verify & Record Payment on Backend (Never trust client-supplied amounts or status)
router.post('/payments/verify', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      bookingId: z.number().int().positive(),
      paymentType: z.enum(['ADVANCE', 'FULL', 'BALANCE']).default('ADVANCE'),
      method: z.enum(['UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH', 'RAZORPAY', 'DEMO']).default('DEMO'),
      orderId: z.string().min(4),
      razorpayPaymentId: z.string().optional(),
      razorpaySignature: z.string().optional(),
      simulateFailure: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid payment verification payload.' });

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, parsed.data.bookingId)).limit(1);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (req.authUser!.role === 'CUSTOMER' && booking.customerId !== req.authUser!.customerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const total = Number(booking.totalAmount);
    const prevPaid = Number(booking.paidAmount);
    const remaining = computeRemainingBalance(total, prevPaid);
    if (remaining <= 0) {
      return res.status(400).json({ success: false, message: 'Booking is already fully paid.' });
    }

    let amountToCharge = remaining;
    if (parsed.data.paymentType === 'ADVANCE' && prevPaid === 0) {
      amountToCharge = Math.round(total * 0.3 * 100) / 100;
    }

    const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
    let isDemo = true;

    if (rzpSecret && parsed.data.razorpayPaymentId && parsed.data.razorpaySignature) {
      const expectedSig = crypto
        .createHmac('sha256', rzpSecret)
        .update(`${parsed.data.orderId}|${parsed.data.razorpayPaymentId}`)
        .digest('hex');
      if (expectedSig !== parsed.data.razorpaySignature) {
        return res.status(400).json({ success: false, message: 'Razorpay signature verification failed.' });
      }
      isDemo = false;
    }

    if (parsed.data.simulateFailure) {
      const failTxn = `FAIL-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      await db.insert(payments).values({
        bookingId: booking.id,
        customerId: booking.customerId,
        amount: amountToCharge.toFixed(2),
        paymentType: parsed.data.paymentType,
        method: parsed.data.method,
        status: 'FAILED',
        transactionId: failTxn,
        razorpayOrderId: parsed.data.orderId,
        isDemo: true,
      });

      await createNotification({
        userId: req.authUser!.id,
        title: `Payment Failed: ${booking.bookingCode}`,
        message: `Demo payment attempt of ₹${amountToCharge.toLocaleString('en-IN')} failed. Please retry.`,
        type: 'PAYMENT',
        linkUrl: `/dashboard/customer/bookings/${booking.id}`,
      });

      return res.status(402).json({ success: false, message: 'Payment authorization declined in simulation.' });
    }

    const txnId = `TXN-CE-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const result = await db.transaction(async (tx) => {
      const [paymentRow] = await tx
        .insert(payments)
        .values({
          bookingId: booking.id,
          customerId: booking.customerId,
          amount: amountToCharge.toFixed(2),
          paymentType: parsed.data.paymentType,
          method: parsed.data.method,
          status: 'PAID',
          transactionId: txnId,
          razorpayOrderId: parsed.data.orderId,
          razorpayPaymentId: parsed.data.razorpayPaymentId || null,
          isDemo,
        })
        .returning();

      const nextPaid = Math.min(total, Math.round((prevPaid + amountToCharge) * 100) / 100);
      const nextPayStatus = derivePaymentStatus(total, nextPaid);

      await tx
        .update(bookings)
        .set({
          paidAmount: nextPaid.toFixed(2),
          paymentStatus: nextPayStatus,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, booking.id));

      const invoiceNum = `INV-${booking.bookingCode.replace('CE-', '')}-${paymentRow.id}`;
      await tx.insert(invoices).values({
        invoiceNumber: invoiceNum,
        bookingId: booking.id,
        paymentId: paymentRow.id,
        subtotal: booking.subtotal,
        taxAmount: booking.taxAmount,
        deliveryCharge: booking.deliveryCharge,
        discountAmount: booking.discountAmount,
        totalAmount: booking.totalAmount,
        status: nextPayStatus,
      });

      return { paymentRow, nextPaid, nextPayStatus, invoiceNum };
    });

    await createNotification({
      userId: req.authUser!.id,
      title: `Payment Confirmed: ₹${amountToCharge.toLocaleString('en-IN')}`,
      message: `${isDemo ? '[DEMO] ' : ''}Payment ${txnId} recorded for ${booking.bookingCode}. Status: ${result.nextPayStatus}.`,
      type: 'PAYMENT',
      linkUrl: `/dashboard/customer/bookings/${booking.id}`,
      emailSubject: `CaterEase Payment Receipt — ${txnId}`,
    });

    await notifyAllAdmins({
      title: `Payment Received (${booking.bookingCode})`,
      message: `₹${amountToCharge.toLocaleString('en-IN')} via ${parsed.data.method} (${isDemo ? 'Demo Mode' : 'Live'}).`,
      type: 'PAYMENT',
      linkUrl: '/dashboard/admin/payments',
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('Verify payment error:', err);
    return res.status(500).json({ success: false, message: 'Payment verification failed.' });
  }
});

router.get('/payments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    let rows;
    if (user.role === 'ADMIN') {
      rows = await db
        .select({
          payment: payments,
          bookingCode: bookings.bookingCode,
          eventName: bookings.eventName,
          customerName: bookings.contactName,
        })
        .from(payments)
        .innerJoin(bookings, eq(payments.bookingId, bookings.id))
        .orderBy(desc(payments.createdAt));
    } else if (user.customerId) {
      rows = await db
        .select({
          payment: payments,
          bookingCode: bookings.bookingCode,
          eventName: bookings.eventName,
        })
        .from(payments)
        .innerJoin(bookings, eq(payments.bookingId, bookings.id))
        .where(eq(payments.customerId, user.customerId))
        .orderBy(desc(payments.createdAt));
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.json({
      success: true,
      data: rows.map((r: any) => ({
        ...r.payment,
        bookingCode: r.bookingCode,
        eventName: r.eventName,
        customerName: r.customerName || undefined,
      })),
    });
  } catch (err) {
    console.error('List payments error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load payments.' });
  }
});

// Admin Refund Tracking
router.post('/payments/:id/refund', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const paymentId = Number(req.params.id);
    const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!pay) return res.status(404).json({ success: false, message: 'Payment record not found.' });
    if (pay.status === 'REFUNDED') return res.status(400).json({ success: false, message: 'Payment already refunded.' });

    await db.transaction(async (tx) => {
      await tx.update(payments).set({ status: 'REFUNDED' }).where(eq(payments.id, paymentId));
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, pay.bookingId)).limit(1);
      if (booking) {
        const nextPaid = Math.max(0, Number(booking.paidAmount) - Number(pay.amount));
        await tx
          .update(bookings)
          .set({
            paidAmount: nextPaid.toFixed(2),
            paymentStatus: nextPaid === 0 ? 'Refunded' : 'Partial',
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, booking.id));
      }
    });

    return res.json({ success: true, message: 'Payment marked as refunded.' });
  } catch (err) {
    console.error('Refund error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process refund.' });
  }
});

// Download PDF Invoice
router.get('/invoices/:bookingId/pdf', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const [row] = await db
      .select({
        booking: bookings,
        packageName: cateringPackages.name,
        packagePricePerPerson: cateringPackages.pricePerPerson,
        customerUserName: users.name,
      })
      .from(bookings)
      .leftJoin(cateringPackages, eq(bookings.packageId, cateringPackages.id))
      .leftJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(users, eq(customers.userId, users.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!row) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (req.authUser!.role === 'CUSTOMER' && row.booking.customerId !== req.authUser!.customerId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const items = await db.select().from(bookingDetails).where(eq(bookingDetails.bookingId, bookingId));
    const [latestPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .orderBy(desc(payments.createdAt))
      .limit(1);

    const [inv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .orderBy(desc(invoices.issuedAt))
      .limit(1);

    streamBookingInvoicePdf(res, {
      invoiceNumber: inv?.invoiceNumber || `INV-${row.booking.bookingCode.replace('CE-', '')}`,
      bookingCode: row.booking.bookingCode,
      issuedAt: new Date(inv?.issuedAt || row.booking.createdAt).toISOString().slice(0, 10),
      customerName: row.booking.contactName || row.customerUserName || 'Valued Guest',
      customerEmail: row.booking.contactEmail,
      customerPhone: row.booking.contactPhone,
      eventName: row.booking.eventName,
      eventType: row.booking.eventType,
      eventDate: row.booking.eventDate,
      eventTime: row.booking.eventTime,
      eventLocation: row.booking.eventLocation,
      guestCount: row.booking.guestCount,
      packageName: row.packageName,
      packagePricePerPerson: row.packagePricePerPerson,
      items: items.map((i) => ({
        itemName: i.itemName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
      })),
      subtotal: row.booking.subtotal,
      discountAmount: row.booking.discountAmount,
      taxAmount: row.booking.taxAmount,
      deliveryCharge: row.booking.deliveryCharge,
      totalAmount: row.booking.totalAmount,
      paidAmount: row.booking.paidAmount,
      paymentStatus: row.booking.paymentStatus,
      transactionRef: latestPayment?.transactionId || null,
    });
  } catch (err) {
    console.error('PDF invoice error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate PDF invoice.' });
  }
});

export default router;
