import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { Response } from 'express';
import { buildKitchenComplianceMatrix, type KitchenItemInput } from '../../utils/kitchenSheet.ts';

export async function generateQrDataUrl(verifyUrl: string): Promise<string> {
  return QRCode.toDataURL(verifyUrl, {
    width: 240,
    margin: 2,
    color: {
      dark: '#1C1917',
      light: '#FFFFFF',
    },
  });
}

export function streamBookingInvoicePdf(
  res: Response,
  data: {
    invoiceNumber: string;
    bookingCode: string;
    issuedAt: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    eventName: string;
    eventType: string;
    eventDate: string;
    eventTime: string;
    eventLocation: string;
    guestCount: number;
    packageName?: string | null;
    packagePricePerPerson?: string | null;
    items: Array<{ itemName: string; quantity: number; unitPrice: string; totalPrice: string }>;
    subtotal: string;
    discountAmount: string;
    taxAmount: string;
    deliveryCharge: string;
    totalAmount: string;
    paidAmount: string;
    paymentStatus: string;
    transactionRef?: string | null;
  }
) {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="CaterEase-Invoice-${data.bookingCode}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fillColor('#B45309').fontSize(22).font('Helvetica-Bold').text('CaterEase', 48, 48);
  doc.fillColor('#57534E').fontSize(10).font('Helvetica').text('Smart Catering. Seamless Celebrations.', 48, 74);

  doc.fillColor('#1C1917').fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', 380, 48, { align: 'right' });
  doc.fillColor('#57534E').fontSize(10).font('Helvetica')
    .text(`Invoice #: ${data.invoiceNumber}`, 320, 70, { align: 'right' })
    .text(`Booking ID: ${data.bookingCode}`, 320, 85, { align: 'right' })
    .text(`Issued: ${data.issuedAt}`, 320, 100, { align: 'right' });

  doc.moveTo(48, 125).lineTo(547, 125).strokeColor('#E7E5E4').stroke();

  // Customer & Event Details
  doc.fillColor('#1C1917').fontSize(11).font('Helvetica-Bold').text('Billed To', 48, 142);
  doc.fillColor('#44403C').fontSize(10).font('Helvetica')
    .text(data.customerName, 48, 160)
    .text(data.customerEmail, 48, 175)
    .text(data.customerPhone, 48, 190);

  doc.fillColor('#1C1917').fontSize(11).font('Helvetica-Bold').text('Event Details', 300, 142);
  doc.fillColor('#44403C').fontSize(10).font('Helvetica')
    .text(`${data.eventName} (${data.eventType})`, 300, 160)
    .text(`Date & Time: ${data.eventDate} at ${data.eventTime}`, 300, 175)
    .text(`Guests: ${data.guestCount} · Venue: ${data.eventLocation}`, 300, 190, { width: 245 });

  // Line Items Table Header
  let y = 240;
  doc.rect(48, y, 499, 24).fill('#F5F5F4');
  doc.fillColor('#1C1917').fontSize(9.5).font('Helvetica-Bold')
    .text('Description', 58, y + 7)
    .text('Qty', 310, y + 7, { width: 50, align: 'right' })
    .text('Unit Price', 370, y + 7, { width: 80, align: 'right' })
    .text('Amount', 460, y + 7, { width: 78, align: 'right' });

  y += 32;
  doc.font('Helvetica').fontSize(9.5).fillColor('#292524');

  if (data.packageName && data.packagePricePerPerson) {
    const pkgTotal = (Number(data.packagePricePerPerson) * data.guestCount).toFixed(2);
    doc.text(`${data.packageName} (Package)`, 58, y, { width: 245 })
      .text(String(data.guestCount), 310, y, { width: 50, align: 'right' })
      .text(`INR ${Number(data.packagePricePerPerson).toFixed(2)}`, 370, y, { width: 80, align: 'right' })
      .text(`INR ${pkgTotal}`, 460, y, { width: 78, align: 'right' });
    y += 22;
  }

  for (const item of data.items) {
    doc.text(item.itemName, 58, y, { width: 245 })
      .text(String(item.quantity), 310, y, { width: 50, align: 'right' })
      .text(`INR ${Number(item.unitPrice).toFixed(2)}`, 370, y, { width: 80, align: 'right' })
      .text(`INR ${Number(item.totalPrice).toFixed(2)}`, 460, y, { width: 78, align: 'right' });
    y += 20;
    if (y > 680) {
      doc.addPage();
      y = 50;
    }
  }

  y += 12;
  doc.moveTo(48, y).lineTo(547, y).strokeColor('#E7E5E4').stroke();
  y += 16;

  // Totals
  const summaryRows = [
    ['Subtotal', `INR ${Number(data.subtotal).toFixed(2)}`],
    ['Coupon Discount', `- INR ${Number(data.discountAmount).toFixed(2)}`],
    ['GST (5%)', `INR ${Number(data.taxAmount).toFixed(2)}`],
    ['Delivery & Setup', `INR ${Number(data.deliveryCharge).toFixed(2)}`],
  ];

  for (const [label, val] of summaryRows) {
    doc.fillColor('#57534E').font('Helvetica').fontSize(10)
      .text(label, 330, y, { width: 120, align: 'right' })
      .text(val, 455, y, { width: 92, align: 'right' });
    y += 18;
  }

  doc.fillColor('#1C1917').font('Helvetica-Bold').fontSize(12)
    .text('Total Payable', 330, y + 4, { width: 120, align: 'right' })
    .text(`INR ${Number(data.totalAmount).toFixed(2)}`, 455, y + 4, { width: 92, align: 'right' });
  y += 26;

  doc.fillColor('#0F766E').font('Helvetica-Bold').fontSize(10)
    .text(`Paid: INR ${Number(data.paidAmount).toFixed(2)} (${data.paymentStatus})`, 48, y);
  if (data.transactionRef) {
    doc.fillColor('#57534E').font('Helvetica').fontSize(9)
      .text(`Payment Reference: ${data.transactionRef}`, 48, y + 16);
  }

  doc.fillColor('#78716C').fontSize(8.5).text(
    'Thank you for celebrating with CaterEase. This is a computer-generated invoice.',
    48,
    760,
    { align: 'center', width: 499 }
  );

  doc.end();
}

export function streamKitchenPrepSheetPdf(
  res: Response,
  data: {
    bookingCode: string;
    eventName: string;
    eventType: string;
    eventDate: string;
    eventTime: string;
    eventLocation: string;
    guestCount: number;
    contactName: string;
    contactPhone: string;
    deliveryRequirements: string;
    dietaryRequirements?: string | null;
    specialInstructions?: string | null;
    packageName?: string | null;
    packageIncludedItems?: string[];
    items: KitchenItemInput[];
    staffRoster: Array<{ staffName: string; staffCode: string; assignedRole: string; taskSummary: string }>;
  }
) {
  const matrix = buildKitchenComplianceMatrix(
    data.items,
    data.guestCount,
    data.packageIncludedItems || [],
    data.dietaryRequirements
  );

  const doc = new PDFDocument({ margin: 44, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="CaterEase-Kitchen-Prep-${data.bookingCode}.pdf"`);
  doc.pipe(res);

  doc.fillColor('#B45309').fontSize(20).font('Helvetica-Bold').text('CaterEase Kitchen Operations', 44, 44);
  doc.fillColor('#1C1917').fontSize(14).font('Helvetica-Bold').text('PREP, ALLERGEN & PACKING SHEET', 300, 46, { align: 'right' });
  doc.fillColor('#57534E').fontSize(9.5).font('Helvetica')
    .text(`Booking: ${data.bookingCode} | Event Date: ${data.eventDate} at ${data.eventTime}`, 44, 70)
    .text(`Event: ${data.eventName} (${data.eventType}) | Guests: ${data.guestCount} | Setup: ${data.deliveryRequirements}`, 44, 84)
    .text(`Venue: ${data.eventLocation} | Host Contact: ${data.contactName} (${data.contactPhone})`, 44, 98, { width: 505 });

  let y = 126;
  doc.moveTo(44, y).lineTo(550, y).strokeColor('#E7E5E4').stroke();
  y += 14;

  // Compliance Banner
  doc.rect(44, y, 506, 62).fill(matrix.requiresAllergenIsolation || matrix.requiresJainIsolation ? '#FEF3C7' : '#F5F5F4');
  doc.fillColor('#1C1917').fontSize(10).font('Helvetica-Bold').text('DIETARY & ALLERGEN COMPLIANCE MATRIX', 56, y + 10);
  doc.fillColor('#44403C').fontSize(9).font('Helvetica')
    .text(
      `Dish Split — Veg: ${matrix.dietaryBreakdown.Veg} | Non-Veg: ${matrix.dietaryBreakdown['Non-Veg']} | Vegan: ${matrix.dietaryBreakdown.Vegan} | Jain: ${matrix.dietaryBreakdown.Jain}   (Max Prep Window: ${matrix.maxPrepTimeMins} mins)`,
      56,
      y + 26
    )
    .text(
      `Detected Allergens: ${matrix.detectedAllergens.length ? matrix.detectedAllergens.join(', ') : 'None declared'} | Jain Isolation: ${matrix.requiresJainIsolation ? 'REQUIRED (Dedicated Green Zone)' : 'Standard'}`,
      56,
      y + 40
    );

  y += 76;

  if (data.dietaryRequirements || data.specialInstructions) {
    doc.fillColor('#1C1917').fontSize(9.5).font('Helvetica-Bold').text('Client Instructions & Dietary Notes:', 44, y);
    y += 14;
    doc.fillColor('#44403C').fontSize(9).font('Helvetica')
      .text(`Dietary: ${data.dietaryRequirements || 'Standard'} | Notes: ${data.specialInstructions || 'None'}`, 44, y, { width: 506 });
    y += 26;
  }

  // Dish Prep Table
  doc.rect(44, y, 506, 22).fill('#1C1917');
  doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
    .text('Dish / Course', 54, y + 6)
    .text('Dietary', 265, y + 6)
    .text('Allergens', 345, y + 6)
    .text('Portions', 485, y + 6, { width: 55, align: 'right' });
  y += 28;

  if (data.items.length > 0) {
    for (const item of data.items) {
      doc.fillColor('#1C1917').fontSize(9).font('Helvetica')
        .text(item.itemName, 54, y, { width: 205 })
        .text(item.dietaryType || 'Veg', 265, y, { width: 75 })
        .text(item.allergens || 'None', 345, y, { width: 135 })
        .text(`${item.quantity}`, 485, y, { width: 55, align: 'right' });
      y += 20;
      if (y > 690) {
        doc.addPage();
        y = 48;
      }
    }
  } else if (data.packageIncludedItems && data.packageIncludedItems.length > 0) {
    for (const course of data.packageIncludedItems) {
      doc.fillColor('#1C1917').fontSize(9).font('Helvetica')
        .text(`${course} (${data.packageName || 'Package'})`, 54, y, { width: 205 })
        .text('Per Package', 265, y, { width: 75 })
        .text('Verify Matrix', 345, y, { width: 135 })
        .text(`${data.guestCount} pax`, 485, y, { width: 55, align: 'right' });
      y += 18;
    }
  }

  y += 14;
  doc.fillColor('#1C1917').fontSize(10.5).font('Helvetica-Bold').text('Packing & Equipment Checklist', 44, y);
  y += 16;
  for (const eqLine of matrix.equipmentChecklist) {
    doc.fillColor('#292524').fontSize(9).font('Helvetica').text(`[  ] ${eqLine}`, 52, y, { width: 495 });
    y += 15;
  }

  if (data.staffRoster.length > 0) {
    y += 10;
    if (y > 690) {
      doc.addPage();
      y = 48;
    }
    doc.fillColor('#1C1917').fontSize(10.5).font('Helvetica-Bold').text('Assigned Culinary & Service Crew', 44, y);
    y += 16;
    for (const member of data.staffRoster) {
      doc.fillColor('#292524').fontSize(9).font('Helvetica')
        .text(`• ${member.staffName} (${member.staffCode}) — ${member.assignedRole}: ${member.taskSummary}`, 52, y, { width: 495 });
      y += 15;
    }
  }

  doc.fillColor('#78716C').fontSize(8).text(
    'ISO 22000 & FSSAI Batch Prep Record · CaterEase Kitchen Operations',
    44,
    770,
    { align: 'center', width: 506 }
  );

  doc.end();
}
