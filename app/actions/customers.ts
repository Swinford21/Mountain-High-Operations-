'use server'

import { asc, eq, ilike, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { customers, jobs } from '@/lib/db/schema'
import { mergeCustomers } from '@/lib/customer-merge'
import { toE164 } from '@/lib/notify'
import { isSquareConfigured, syncSquareCatalog, syncSquareCustomers, syncSquarePayments } from '@/lib/square'
import { requireAdmin } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null))

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: text(320).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email looks invalid'),
  phone: text(40),
  address: text(500),
  billingAddress: text(500),
  notes: text(4000),
})

export async function createCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = customerSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form' }
  const [created] = await db.insert(customers).values(parsed.data).returning({ id: customers.id })
  revalidatePath('/customers')
  redirect(`/customers/${created.id}`)
}

export async function updateCustomer(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = customerSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form' }
  await db
    .update(customers)
    .set({
      ...parsed.data,
      emailOptIn: formData.get('emailOptIn') === 'on',
      smsOptIn: formData.get('smsOptIn') === 'on',
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id))
  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { ok: true, message: 'Customer saved' }
}

export async function deleteCustomer(id: number): Promise<ActionState> {
  await requireAdmin()
  const [hasJob] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.customerId, id)).limit(1)
  if (hasJob) return { ok: false, message: 'This customer has jobs. Delete or reassign those first.' }
  await db.delete(customers).where(eq(customers.id, id))
  revalidatePath('/customers')
  redirect('/customers')
}

const importRow = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(320).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
})

/** Imports up to 1,000 rows per call, skipping customers that already exist by email or phone. */
export async function importCustomers(rows: unknown[]): Promise<ActionState & { created?: number; skipped?: number }> {
  await requireAdmin()
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, message: 'No rows to import' }
  if (rows.length > 1000) return { ok: false, message: 'Send at most 1,000 rows at a time' }

  const existing = await db.select({ email: customers.email, phone: customers.phone }).from(customers)
  const emails = new Set(existing.map((c) => c.email?.toLowerCase()).filter(Boolean))
  const phones = new Set(existing.map((c) => toE164(c.phone)).filter(Boolean))

  const toInsert: (typeof customers.$inferInsert)[] = []
  let skipped = 0
  for (const raw of rows) {
    const parsed = importRow.safeParse(raw)
    if (!parsed.success) {
      skipped++
      continue
    }
    const r = parsed.data
    const email = r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) ? r.email : null
    const phoneKey = toE164(r.phone)
    if ((email && emails.has(email.toLowerCase())) || (phoneKey && phones.has(phoneKey))) {
      skipped++
      continue
    }
    if (email) emails.add(email.toLowerCase())
    if (phoneKey) phones.add(phoneKey)
    toInsert.push({ name: r.name, email, phone: r.phone || null, address: r.address || null, notes: r.notes || null })
  }

  if (toInsert.length) await db.insert(customers).values(toInsert)
  revalidatePath('/customers')
  return { ok: true, message: `Imported ${toInsert.length}, skipped ${skipped}`, created: toInsert.length, skipped }
}

export async function searchCustomers(query: string) {
  await requireAdmin()
  const q = String(query ?? '').trim().slice(0, 100)
  if (q.length < 2) return []
  const pattern = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`
  const digits = q.replace(/\D/g, '')
  const conditions = [
    ilike(customers.name, pattern),
    ilike(customers.email, pattern),
    ilike(customers.address, pattern),
    ilike(customers.company, pattern),
  ]
  if (digits.length >= 3) {
    conditions.push(sql`regexp_replace(coalesce(${customers.phone}, ''), '\\D', '', 'g') like ${`%${digits}%`}`)
  }
  return db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      address: customers.address,
    })
    .from(customers)
    .where(or(...conditions))
    .orderBy(asc(customers.name))
    .limit(10)
}

const mergeInput = z.object({
  keepId: z.number().int().positive(),
  mergeIds: z.array(z.number().int().positive()).min(1).max(20),
})

export async function mergeDuplicateCustomers(keepId: number, mergeIds: number[]): Promise<ActionState> {
  await requireAdmin()
  const parsed = mergeInput.safeParse({ keepId, mergeIds })
  if (!parsed.success) return { ok: false, message: 'Pick a record to keep and at least one to merge' }
  const { merged } = await mergeCustomers(parsed.data.keepId, parsed.data.mergeIds)
  if (merged === 0) return { ok: false, message: 'Nothing to merge. The records may already be merged.' }
  revalidatePath('/customers', 'layout')
  return { ok: true, message: `Merged ${merged} record${merged === 1 ? '' : 's'}` }
}

export async function syncSquare(): Promise<ActionState> {
  await requireAdmin()
  if (!isSquareConfigured()) return { ok: false, message: 'Square is not connected. Add SQUARE_ACCESS_TOKEN.' }
  try {
    const c = await syncSquareCustomers()
    const p = await syncSquarePayments()
    const cat = await syncSquareCatalog()
    revalidatePath('/', 'layout')
    return {
      ok: true,
      message: `Square synced: ${c.created} new and ${c.updated} updated customers, ${p.upserted} payments, ${cat.added} new products.`,
    }
  } catch (err) {
    console.error('[square] sync failed', err)
    return {
      ok: false,
      message: 'Square sync failed. Check that the access token and environment (production or sandbox) are correct.',
    }
  }
}
