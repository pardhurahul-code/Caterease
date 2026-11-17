import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. users
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    phone: text('phone'),
    passwordHash: text('password_hash'),
    role: text('role').notNull().default('CUSTOMER'), // CUSTOMER | ADMIN | STAFF
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),
    emailVerified: boolean('email_verified').notNull().default(false),
    resetToken: text('reset_token'),
    resetTokenExpires: timestamp('reset_token_expires'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_users_role').on(t.role)]
);

// 2. customers
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  dietaryNotes: text('dietary_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. admins
export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  department: text('department').notNull().default('Operations'),
  permissionsLevel: text('permissions_level').notNull().default('FULL'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. staff
export const staff = pgTable('staff', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  staffCode: text('staff_code').notNull().unique(),
  roleTitle: text('role_title').notNull().default('Culinary Lead'),
  specialization: text('specialization').notNull().default('Banquet Operations'),
  phone: text('phone'),
  availabilityStatus: text('availability_status').notNull().default('Available'),
  shiftSchedule: text('shift_schedule').notNull().default('08:00 - 20:00'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. catering_services
export const cateringServices = pgTable('catering_services', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  serviceType: text('service_type').notNull(), // Full-Service | Buffet | Drop-Off | Live Counters
  basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull().default('0'),
  minGuests: integer('min_guests').notNull().default(20),
  maxGuests: integer('max_guests').notNull().default(2000),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. food_categories
export const foodCategories = pgTable('food_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  displayOrder: integer('display_order').notNull().default(0),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
});

// 7. food_items
export const foodItems = pgTable(
  'food_items',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id')
      .references(() => foodCategories.id, { onDelete: 'restrict' })
      .notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    unit: text('unit').notNull().default('per plate'),
    dietaryType: text('dietary_type').notNull().default('Veg'), // Veg | Non-Veg | Vegan | Jain
    isGlutenFree: boolean('is_gluten_free').notNull().default(false),
    isAvailable: boolean('is_available').notNull().default(true),
    ingredients: text('ingredients').notNull(),
    allergens: text('allergens').notNull().default('None'),
    prepTimeMins: integer('prep_time_mins').notNull().default(45),
    calories: integer('calories').notNull().default(320),
    imageUrl: text('image_url'),
    isFeatured: boolean('is_featured').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_food_items_category').on(t.categoryId),
    index('idx_food_items_dietary').on(t.dietaryType),
  ]
);

// 8. catering_packages
export const cateringPackages = pgTable('catering_packages', {
  id: serial('id').primaryKey(),
  serviceId: integer('service_id').references(() => cateringServices.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  eventType: text('event_type').notNull(), // Wedding | Birthday | Engagement | Corporate | Housewarming | Festival | Family Function | Custom
  description: text('description').notNull(),
  pricePerPerson: numeric('price_per_person', { precision: 10, scale: 2 }).notNull(),
  minGuests: integer('min_guests').notNull().default(25),
  maxGuests: integer('max_guests').notNull().default(1500),
  includedItemsJson: jsonb('included_items_json').$type<string[]>().notNull().default([]),
  customizationOptionsJson: jsonb('customization_options_json').$type<string[]>().notNull().default([]),
  imageUrl: text('image_url'),
  isAvailable: boolean('is_available').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. coupons
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  discountType: text('discount_type').notNull().default('PERCENTAGE'), // PERCENTAGE | FIXED
  discountValue: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
  minOrderValue: numeric('min_order_value', { precision: 10, scale: 2 }).notNull().default('0'),
  maxDiscount: numeric('max_discount', { precision: 10, scale: 2 }),
  startDate: timestamp('start_date').notNull(),
  expiryDate: timestamp('expiry_date').notNull(),
  usageLimit: integer('usage_limit').notNull().default(100),
  perCustomerLimit: integer('per_customer_limit').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. bookings
export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    bookingCode: text('booking_code').notNull().unique(),
    customerId: integer('customer_id')
      .references(() => customers.id, { onDelete: 'restrict' })
      .notNull(),
    packageId: integer('package_id').references(() => cateringPackages.id, { onDelete: 'set null' }),
    eventName: text('event_name').notNull(),
    eventType: text('event_type').notNull(),
    eventDate: text('event_date').notNull(), // YYYY-MM-DD
    eventTime: text('event_time').notNull(), // HH:mm
    eventLocation: text('event_location').notNull(),
    guestCount: integer('guest_count').notNull(),
    dietaryRequirements: text('dietary_requirements'),
    specialInstructions: text('special_instructions'),
    contactName: text('contact_name').notNull(),
    contactPhone: text('contact_phone').notNull(),
    contactEmail: text('contact_email').notNull(),
    budget: numeric('budget', { precision: 12, scale: 2 }),
    deliveryRequirements: text('delivery_requirements').notNull().default('Full Service Setup'),
    status: text('status').notNull().default('Pending'), // Pending | Confirmed | Preparing | Ready for Delivery | Event in Progress | Completed | Cancelled
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull(),
    deliveryCharge: numeric('delivery_charge', { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    paymentStatus: text('payment_status').notNull().default('Unpaid'), // Unpaid | Partial | Paid | Refunded
    couponCode: text('coupon_code'),
    qrToken: text('qr_token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_bookings_customer').on(t.customerId),
    index('idx_bookings_status').on(t.status),
    index('idx_bookings_date').on(t.eventDate),
  ]
);

// 11. booking_details
export const bookingDetails = pgTable('booking_details', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .references(() => bookings.id, { onDelete: 'cascade' })
    .notNull(),
  foodItemId: integer('food_item_id').references(() => foodItems.id, { onDelete: 'set null' }),
  itemName: text('item_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
});

// 12. events
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .references(() => bookings.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  title: text('title').notNull(),
  eventDate: text('event_date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  venue: text('venue').notNull(),
  guestCount: integer('guest_count').notNull(),
  status: text('status').notNull().default('Scheduled'),
  leadStaffId: integer('lead_staff_id').references(() => staff.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. payments
export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    bookingId: integer('booking_id')
      .references(() => bookings.id, { onDelete: 'cascade' })
      .notNull(),
    customerId: integer('customer_id')
      .references(() => customers.id, { onDelete: 'restrict' })
      .notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paymentType: text('payment_type').notNull().default('ADVANCE'), // ADVANCE | FULL | BALANCE
    method: text('method').notNull().default('DEMO'), // UPI | DEBIT_CARD | CREDIT_CARD | CASH | RAZORPAY | DEMO
    status: text('status').notNull().default('PAID'), // PENDING | PAID | FAILED | REFUNDED
    transactionId: text('transaction_id').notNull().unique(),
    razorpayOrderId: text('razorpay_order_id'),
    razorpayPaymentId: text('razorpay_payment_id'),
    isDemo: boolean('is_demo').notNull().default(true),
    paidAt: timestamp('paid_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_payments_booking').on(t.bookingId)]
);

// 14. invoices
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  bookingId: integer('booking_id')
    .references(() => bookings.id, { onDelete: 'cascade' })
    .notNull(),
  paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull(),
  deliveryCharge: numeric('delivery_charge', { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  status: text('status').notNull().default('Issued'),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
});

// 15. suppliers
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  contactPerson: text('contact_person').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  category: text('category').notNull(),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('4.50'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. inventory
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  ingredientName: text('ingredient_name').notNull(),
  category: text('category').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull().default('0'),
  unit: text('unit').notNull(), // kg | liters | pcs | packs
  minStockLevel: numeric('min_stock_level', { precision: 12, scale: 2 }).notNull().default('10'),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  purchasePrice: numeric('purchase_price', { precision: 10, scale: 2 }).notNull().default('0'),
  expiryDate: text('expiry_date'), // YYYY-MM-DD
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

// 17. stock_transactions
export const stockTransactions = pgTable('stock_transactions', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id, { onDelete: 'cascade' })
    .notNull(),
  transactionType: text('transaction_type').notNull(), // STOCK_IN | STOCK_OUT | ADJUSTMENT
  quantityChange: numeric('quantity_change', { precision: 12, scale: 2 }).notNull(),
  previousQuantity: numeric('previous_quantity', { precision: 12, scale: 2 }).notNull(),
  newQuantity: numeric('new_quantity', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  performedByUserId: integer('performed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. staff_assignments
export const staffAssignments = pgTable(
  'staff_assignments',
  {
    id: serial('id').primaryKey(),
    bookingId: integer('booking_id')
      .references(() => bookings.id, { onDelete: 'cascade' })
      .notNull(),
    staffId: integer('staff_id')
      .references(() => staff.id, { onDelete: 'cascade' })
      .notNull(),
    assignedRole: text('assigned_role').notNull().default('Kitchen & Service Lead'),
    taskSummary: text('task_summary').notNull(),
    prepStatus: text('prep_status').notNull().default('PENDING'), // PENDING | PREPARING | READY | COMPLETED
    deliveryStatus: text('delivery_status').notNull().default('PENDING'), // PENDING | DISPATCHED | DELIVERED
    notes: text('notes'),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uniq_booking_staff').on(t.bookingId, t.staffId)]
);

// 19. notifications
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull().default('INFO'), // BOOKING | PAYMENT | INVENTORY | STAFF | REVIEW | SUPPORT | SYSTEM
    isRead: boolean('is_read').notNull().default(false),
    linkUrl: text('link_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_notifications_user').on(t.userId)]
);

// 20. reviews
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .references(() => bookings.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  customerId: integer('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull(),
  rating: integer('rating').notNull(),
  title: text('title').notNull(),
  comment: text('comment').notNull(),
  isApproved: boolean('is_approved').notNull().default(true),
  aiSentiment: text('ai_sentiment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 21. customer_preferences
export const customerPreferences = pgTable('customer_preferences', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  preferredCuisine: text('preferred_cuisine').default('North & South Indian Fusion'),
  dietaryRestrictions: text('dietary_restrictions').default('None'),
  spiceLevel: text('spice_level').default('Medium'),
  favoriteCategories: jsonb('favorite_categories').$type<string[]>().default([]),
  budgetTier: text('budget_tier').default('Premium'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 22. support_tickets + support_messages
export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  ticketNumber: text('ticket_number').notNull().unique(),
  customerId: integer('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull(),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  category: text('category').notNull(),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('Open'), // Open | In Progress | Resolved | Closed
  priority: text('priority').notNull().default('Medium'), // Low | Medium | High
  assignedAdminId: integer('assigned_admin_id').references(() => users.id, { onDelete: 'set null' }),
  attachmentUrl: text('attachment_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const supportMessages = pgTable('support_messages', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id')
    .references(() => supportTickets.id, { onDelete: 'cascade' })
    .notNull(),
  senderUserId: integer('sender_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  senderRole: text('sender_role').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 23. business_settings + newsletter_subscribers + booking_timeline
export const businessSettings = pgTable('business_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  subscribedAt: timestamp('subscribed_at').defaultNow().notNull(),
});

export const bookingTimeline = pgTable('booking_timeline', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id')
    .references(() => bookings.id, { onDelete: 'cascade' })
    .notNull(),
  status: text('status').notNull(),
  note: text('note').notNull(),
  updatedByRole: text('updated_by_role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 24. tasting_requests
export const tastingRequests = pgTable(
  'tasting_requests',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
      .references(() => customers.id, { onDelete: 'cascade' })
      .notNull(),
    eventType: text('event_type').notNull(),
    estimatedGuests: integer('estimated_guests').notNull().default(100),
    preferredDate: text('preferred_date').notNull(),
    preferredTime: text('preferred_time').notNull(),
    tastingGuests: integer('tasting_guests').notNull().default(2),
    selectedDishIdsJson: jsonb('selected_dish_ids_json').$type<number[]>().notNull().default([]),
    selectedDishNamesJson: jsonb('selected_dish_names_json').$type<string[]>().notNull().default([]),
    dietaryNotes: text('dietary_notes'),
    status: text('status').notNull().default('Requested'),
    adminNotes: text('admin_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_tasting_customer').on(t.customerId)]
);
