import { pgTable, text, timestamp, boolean, serial, integer, date, numeric, primaryKey } from 'drizzle-orm/pg-core'

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
  billingAddress: text('billing_address'),
  notes: text('notes'),
  squareCustomerId: text('square_customer_id').unique(),
  externalId: text('external_id').unique(),
  company: text('company'),
  defaultOperation: text('default_operation'),
  primaryOperation: text('primary_operation'),
  location: text('location'),
  tags: text('tags'),
  customerSince: date('customer_since', { mode: 'string' }),
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
  durationMinutes: integer('duration_minutes').notNull().default(60),
  status: text('status').notNull().default('scheduled'),
  assignedTo: text('assigned_to'),
  truckId: integer('truck_id'),
  crewId: integer('crew_id'),
  /** Jobs created together from one repeating schedule share a series id. */
  seriesId: text('series_id'),
  repeatRule: text('repeat_rule'),
  priceCents: integer('price_cents'),
  paymentStatus: text('payment_status').notNull().default('unpaid'),
  confirmationSentAt: timestamp('confirmation_sent_at', { withTimezone: true }),
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const trucks = pgTable('trucks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull(),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  vin: text('vin'),
  plate: text('plate'),
  mileage: integer('mileage'),
  registrationExpires: date('registration_expires', { mode: 'string' }),
  insuranceExpires: date('insurance_expires', { mode: 'string' }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const truckRepairs = pgTable('truck_repairs', {
  id: serial('id').primaryKey(),
  truckId: integer('truck_id').notNull(),
  repairDate: date('repair_date', { mode: 'string' }).notNull(),
  description: text('description').notNull(),
  vendor: text('vendor'),
  costCents: integer('cost_cents'),
  mileage: integer('mileage'),
  coveredByWarranty: boolean('covered_by_warranty').notNull().default(false),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const truckWarranties = pgTable('truck_warranties', {
  id: serial('id').primaryKey(),
  truckId: integer('truck_id').notNull(),
  item: text('item').notNull(),
  provider: text('provider'),
  policyNumber: text('policy_number'),
  startDate: date('start_date', { mode: 'string' }),
  endDate: date('end_date', { mode: 'string' }),
  mileageLimit: integer('mileage_limit'),
  coverage: text('coverage'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Job types (installation, delivery, …). `id` is the slug stored on jobs.operation. */
export const operations = pgTable('operations', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  singular: text('singular').notNull(),
  color: text('color').notNull(),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crews = pgTable('crews', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  leadUserId: text('lead_user_id'),
  truckId: integer('truck_id'),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crewMembers = pgTable(
  'crew_members',
  {
    crewId: integer('crew_id').notNull(),
    userId: text('user_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.crewId, t.userId] })],
)

/** HR records. Admin-only. `userId` optionally links the employee to their app login. */
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  userId: text('user_id').unique(),
  name: text('name').notNull(),
  position: text('position'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  hireDate: date('hire_date', { mode: 'string' }),
  birthDate: date('birth_date', { mode: 'string' }),
  payType: text('pay_type'),
  payRateCents: integer('pay_rate_cents'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  notes: text('notes'),
  status: text('status').notNull().default('active'),
  terminationDate: date('termination_date', { mode: 'string' }),
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

/** Team-only notes on a job. Never included in customer emails or texts. */
export const jobNotes = pgTable('job_notes', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull(),
  authorId: text('author_id').notNull(),
  body: text('body').notNull(),
  /** 'crew' notes are visible to the whole team; 'admin' notes only to admins. */
  visibility: text('visibility').notNull().default('crew'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Photos and documents attached to a job. Stored in private Blob storage; served through /api/job-files/[id]. */
export const jobFiles = pgTable('job_files', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull(),
  pathname: text('pathname').notNull().unique(),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  caption: text('caption'),
  uploadedBy: text('uploaded_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Admin-only notes about a customer. Never shown to customers or crew. */
export const customerNotes = pgTable('customer_notes', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull(),
  authorId: text('author_id').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Past services imported from the yearly client records spreadsheet (one row per recorded service). */
export const customerHistory = pgTable('customer_history', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull(),
  externalId: text('external_id').notNull(),
  serviceDate: date('service_date', { mode: 'string' }).notNull(),
  operation: text('operation').notNull(),
  location: text('location'),
  sourceLabel: text('source_label'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Customer = typeof customers.$inferSelect
export type JobNote = typeof jobNotes.$inferSelect
export type CustomerHistory = typeof customerHistory.$inferSelect
export type Job = typeof jobs.$inferSelect
export type TimeEntry = typeof timeEntries.$inferSelect
export type Payment = typeof payments.$inferSelect
export type Campaign = typeof campaigns.$inferSelect
export type Employee = typeof employees.$inferSelect
export type Truck = typeof trucks.$inferSelect
export type TruckRepair = typeof truckRepairs.$inferSelect
export type TruckWarranty = typeof truckWarranties.$inferSelect
