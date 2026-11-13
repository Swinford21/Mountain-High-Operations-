'use server'

import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { crewMembers, crews, jobs, operations } from '@/lib/db/schema'
import { firstIssue, formObject, hexColor, optionalText } from '@/lib/form'
import { slugifyOperation } from '@/lib/operations'
import { requireAdmin } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const operationSchema = z.object({
  label: z.string().trim().min(1, 'Name the operation').max(60),
  singular: z.string().trim().min(1, 'Add the single-job name').max(60),
  color: hexColor,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
})

export async function createOperation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = operationSchema.safeParse(formObject(formData))
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) }
  const id = slugifyOperation(parsed.data.singular)
  if (!id) return { ok: false, message: 'Use letters or numbers in the name' }

  const [existing] = await db.select({ id: operations.id }).from(operations).where(eq(operations.id, id)).limit(1)
  if (existing) return { ok: false, message: 'An operation with that name already exists' }

  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${operations.sortOrder}), 0)::int` }).from(operations)
  await db.insert(operations).values({ id, ...parsed.data, sortOrder: parsed.data.sortOrder || max + 1 })
  revalidatePath('/', 'layout')
  return { ok: true, message: `${parsed.data.label} added` }
}

export async function updateOperation(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = operationSchema
    .extend({ active: z.literal('on').optional() })
    .safeParse(formObject(formData))
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) }
  const { active, ...rest } = parsed.data
  const [updated] = await db
    .update(operations)
    .set({ ...rest, active: active === 'on' })
    .where(eq(operations.id, id))
    .returning({ label: operations.label })
  if (!updated) return { ok: false, message: 'Operation not found' }
  revalidatePath('/', 'layout')
  return { ok: true, message: `${updated.label} saved` }
}

export async function deleteOperation(id: string): Promise<ActionState> {
  await requireAdmin()
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(eq(jobs.operation, id))
  if (count > 0) {
    return { ok: false, message: `${count} job${count === 1 ? ' uses' : 's use'} this operation. Turn it off instead.` }
  }
  await db.delete(operations).where(eq(operations.id, id))
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Operation deleted' }
}

const crewSchema = z.object({
  name: z.string().trim().min(1, 'Name the crew').max(60),
  leadUserId: optionalText(100),
  truckId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .transform((v) => v ?? null),
  notes: optionalText(2000),
  active: z.literal('on').optional(),
})

function memberIds(formData: FormData) {
  return [...new Set(formData.getAll('members').filter((v): v is string => typeof v === 'string' && v.length > 0))].slice(
    0,
    50,
  )
}

async function saveMembers(crewId: number, ids: string[], leadUserId: string | null) {
  const all = leadUserId && !ids.includes(leadUserId) ? [...ids, leadUserId] : ids
  await db.delete(crewMembers).where(eq(crewMembers.crewId, crewId))
  if (all.length) await db.insert(crewMembers).values(all.map((userId) => ({ crewId, userId })))
}

export async function saveCrew(crewId: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = crewSchema.safeParse(formObject(formData))
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) }
  const { active, ...data } = parsed.data

  try {
    let id = crewId
    if (id) {
      const [updated] = await db
        .update(crews)
        .set({ ...data, active: active === 'on' })
        .where(eq(crews.id, id))
        .returning({ id: crews.id })
      if (!updated) return { ok: false, message: 'Crew not found' }
    } else {
      const [created] = await db.insert(crews).values(data).returning({ id: crews.id })
      id = created.id
    }
    await saveMembers(id, memberIds(formData), data.leadUserId)
  } catch (e) {
    if (e instanceof Error && /unique/i.test(e.message)) return { ok: false, message: 'A crew with that name already exists' }
    throw e
  }

  revalidatePath('/settings')
  return { ok: true, message: crewId ? `${data.name} saved` : `${data.name} created` }
}

export async function deleteCrew(crewId: number): Promise<ActionState> {
  await requireAdmin()
  await db.update(jobs).set({ crewId: null }).where(eq(jobs.crewId, crewId))
  await db.delete(crewMembers).where(eq(crewMembers.crewId, crewId))
  await db.delete(crews).where(eq(crews.id, crewId))
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Crew deleted' }
}
