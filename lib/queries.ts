import { and, asc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customers, jobItems, jobNotes, jobs, products, trucks, user } from '@/lib/db/schema'

export async function getTrucks() {
  return db
    .select({ id: trucks.id, name: trucks.name, color: trucks.color })
    .from(trucks)
    .where(eq(trucks.active, true))
    .orderBy(asc(trucks.sortOrder), asc(trucks.name))
}

export type TruckOption = Awaited<ReturnType<typeof getTrucks>>[number]

export async function getTeamMembers() {
  return db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(ne(user.role, 'pending'))
    .orderBy(asc(user.name))
}

/** Returns the picker option for one customer (the picker searches the rest on demand). */
export async function getCustomerOptions(id?: number) {
  if (!id || !Number.isInteger(id)) return []
  return db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      address: customers.address,
    })
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1)
}

export async function getProductOptions() {
  return db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      unit: products.unit,
      priceCents: products.priceCents,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.category), asc(products.name))
}

export async function getJobItems(jobId: number) {
  return db.select().from(jobItems).where(eq(jobItems.jobId, jobId)).orderBy(asc(jobItems.id))
}

export type ProductOption = Awaited<ReturnType<typeof getProductOptions>>[number]
export type CustomerOption = Awaited<ReturnType<typeof getCustomerOptions>>[number]
export type TeamMember = Awaited<ReturnType<typeof getTeamMembers>>[number]

export async function getJobsInRange(opts: {
  start: string
  end: string
  operations?: string[]
  assignedTo?: string
  includeCanceled?: boolean
}) {
  const conditions = [gte(jobs.scheduledDate, opts.start), lte(jobs.scheduledDate, opts.end)]
  if (opts.operations?.length) conditions.push(inArray(jobs.operation, opts.operations))
  if (opts.assignedTo) conditions.push(eq(jobs.assignedTo, opts.assignedTo))
  if (!opts.includeCanceled) conditions.push(ne(jobs.status, 'canceled'))

  return db
    .select({
      id: jobs.id,
      title: jobs.title,
      operation: jobs.operation,
      scheduledDate: jobs.scheduledDate,
      startTime: jobs.startTime,
      durationMinutes: jobs.durationMinutes,
      status: jobs.status,
      address: jobs.address,
      assignedTo: jobs.assignedTo,
      assigneeName: user.name,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerAddress: customers.address,
      paymentStatus: jobs.paymentStatus,
      priceCents: jobs.priceCents,
      truckId: jobs.truckId,
      truckName: trucks.name,
      truckColor: trucks.color,
      hasCrewNotes: sql<boolean>`exists (select 1 from ${jobNotes} n where n.job_id = ${jobs.id} and n.visibility = 'crew')`,
    })
    .from(jobs)
    .innerJoin(customers, eq(jobs.customerId, customers.id))
    .leftJoin(user, eq(jobs.assignedTo, user.id))
    .leftJoin(trucks, eq(jobs.truckId, trucks.id))
    .where(and(...conditions))
    .orderBy(asc(jobs.scheduledDate), asc(jobs.startTime))
}

export type JobListItem = Awaited<ReturnType<typeof getJobsInRange>>[number]

export async function getJobDetail(id: number) {
  const [row] = await db
    .select({ job: jobs, customer: customers, assigneeName: user.name, truckName: trucks.name, truckColor: trucks.color })
    .from(jobs)
    .innerJoin(customers, eq(jobs.customerId, customers.id))
    .leftJoin(user, eq(jobs.assignedTo, user.id))
    .leftJoin(trucks, eq(jobs.truckId, trucks.id))
    .where(eq(jobs.id, id))
    .limit(1)
  return row ?? null
}
