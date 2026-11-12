import { pgTable, text, timestamp, boolean, serial, integer, date, numeric } from 'drizzle-orm/pg-core'

// --- Better Auth tables (camelCase columns match Better Auth defaults) -----

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('pending'),
  phone: text('phone'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables -------------------------------------------------------------
// This is shared business data for one company, so access is controlled by
// team role (admin / crew) rather than per-user row ownership.

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  notes: text('notes'),
  squareCustomerId: text('square_customer_id').unique(),
  emailOptIn: boolean('email_opt_in').notNull().default(true),
  smsOptIn: boolean('sms_opt_in').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull(),
  operation: text('operation').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  address: text('address'),
  scheduledDate: date('scheduled_date', { mode: 'string' }).notNull(),
  startTime: text('start_time').notNull().default('08:00'),
  durationMinutes: integer('duration_minutes').notNull().default(120),
  status: text('status').notNull().default('scheduled'),
  assignedTo: text('assigned_to'),
  priceCents: integer('price_cents'),
  paymentStatus: text('payment_status').notNull().default('unpaid'),
  confirmationSentAt: timestamp('confirmation_sent_at', { withTimezone: true }),
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const timeEntries = pgTable('time_entries', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  jobId: integer('job_id'),
  clockIn: timestamp('clock_in', { withTimezone: true }).notNull().defaultNow(),
  clockOut: timestamp('clock_out', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  squarePaymentId: text('square_payment_id').notNull().unique(),
  squareCustomerId: text('square_customer_id'),
  customerId: integer('customer_id'),
  jobId: integer('job_id'),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull(),
  note: text('note'),
  receiptUrl: text('receipt_url'),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
})

export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  channel: text('channel').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  audience: text('audience').notNull().default('all'),
  status: text('status').notNull().default('draft'),
  recipientsCount: integer('recipients_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const messageLog = pgTable('message_log', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id'),
  jobId: integer('job_id'),
  campaignId: integer('campaign_id'),
  channel: text('channel').notNull(),
  kind: text('kind').notNull(),
  recipient: text('recipient').notNull(),
  status: text('status').notNull(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  squareToken: text('square_token').unique(),
  name: text('name').notNull(),
  variation: text('variation'),
  category: text('category').notNull().default('Other'),
  unit: text('unit').notNull().default('each'),
  priceCents: integer('price_cents'),
  sku: text('sku'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const jobItems = pgTable('job_items', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull(),
  productId: integer('product_id'),
  name: text('name').notNull(),
  unit: text('unit').notNull().default('each'),
  quantity: numeric('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  unitPriceCents: integer('unit_price_cents').notNull().default(0),
})

export type Customer = typeof customers.$inferSelect
export type Job = typeof jobs.$inferSelect
export type TimeEntry = typeof timeEntries.$inferSelect
export type Payment = typeof payments.$inferSelect
export type Campaign = typeof campaigns.$inferSelect
