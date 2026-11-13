'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { crews, jobs, truckRepairs, trucks, truckWarranties } from '@/lib/db/schema'
import { firstIssue, formObject, hexColor, optionalDate, optionalInt, optionalMoney, optionalText } from '@/lib/form'
import { requireAdmin } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const truckSchema = z.object({
  name: z.string().trim().min(1, 'Name the truck').max(60),
  color: hexColor,
  make: optionalText(60),
  model: optionalText(60),
  year: optionalInt(2100),
  vin: optionalText(40),
  plate: optionalText(20),
  mileage: optionalInt(),
  registrationExpires: optionalDate,
  insuranceExpires: optionalDate,
  notes: optionalText(4000),
  active: z.literal('on').optional(),
})

function isUniqueError(e: unknown) {
  return e instanceof Error && /unique/i.test(e.message)
}

export async function saveTruck(truckId: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = truckSchema.safeParse(formObject(formData))
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) }
  const { active, ...data } = parsed.data

  let id = truckId
  try {
    if (id) {
      const [updated] = await db
        .update(trucks)
        .set({ ...data, active: active === 'on' })
        .where(eq(trucks.id, id))
        .returning({ id: trucks.id })
      if (!updated) return { ok: false, message: 'Truck not found' }
    } else {
      const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${trucks.sortOrder}), 0)::int` }).from(trucks)
      const [created] = await db
        .insert(trucks)
        .values({ ...data, sortOrder: max + 1 })
        .returning({ id: trucks.id })
      id = created.id
    }
  } catch (e) {
    if (isUniqueError(e)) return { ok: false, message: 'A truck with that name already exists' }
    throw e
  }

  revalidatePath('/', 'layout')
  if (!truckId) redirect(`/logistics/${id}`)
  return { ok: true, message: `${data.name} saved` }
}

export async function deleteTruck(truckId: number): Promise<ActionState> {
  await requireAdmin()
  await db.update(jobs).set({ truckId: null }).where(eq(jobs.truckId, truckId))
  await db.update(crews).set({ truckId: null }).where(eq(crews.truckId, truckId))
  await db.delete(truckRepairs).where(eq(truckRepairs.truckId, truckId))
  await db.delete(truckWarranties).where(eq(truckWarranties.truckId, truckId))
  await db.delete(trucks).where(eq(trucks.id, truckId))
  revalidatePath('/', 'layout')
  redirect('/logistics')
}

const repairSchema = z.object({
  repairDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the repair date'),
  description: z.string().trim().min(1, 'Describe the repair').max(2000),
  vendor: optionalText(120),
  cost: optionalMoney,
  mileage: optionalInt(),
  coveredByWarranty: z.literal('on').optional(),
})

export async function addRepair(truckId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAdmin()
  const parsed = repairSchema.safeParse(formObject(formData))
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) }
  const { cost, coveredByWarranty, ...data } = parsed.data

  const [truck] = await db.select({ mileage: trucks.mileage }).from(trucks).where(eq(trucks.id, truckId)).limit(1)
  if (!truck) return { ok: false, message: 'Truck not found' }

  await db.insert(truckRepairs).values({
    ...data,
    truckId,
    costCents: cost,
    coveredByWarranty: coveredByWarranty === 'on',
    createdBy: me.id,
  })
  // Keep the odometer current when a repair records a higher reading.
  if (data.mileage && (!truck.mileage || data.mileage > truck.mileage)) {
    await db.update(trucks).set({ mileage: data.mileage }).where(eq(trucks.id, truckId))
  }
  revalidatePath(`/logistics/${truckId}`)
  revalidatePath('/logistics')
  return { ok: true, message: 'Repair logged' }
}

export async function deleteRepair(truckId: number, repairId: number): Promise<ActionState> {
  await requireAdmin()
  await db.delete(truckRepairs).where(and(eq(truckRepairs.id, repairId), eq(truckRepairs.truckId, truckId)))
  revalidatePath(`/logistics/${truckId}`)
  revalidatePath('/logistics')
  return { ok: true, message: 'Repair removed' }
}

const warrantySchema = z.object({
  item: z.string().trim().min(1, 'What does the warranty cover?').max(200),
  provider: optionalText(120),
  policyNumber: optionalText(80),
  startDate: optionalDate,
  endDate: optionalDate,
  mileageLimit: optionalInt(),
  coverage: optionalText(2000),
})

export async function saveWarranty(
  truckId: number,
  warrantyId: number | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const parsed = warrantySchema.safeParse(formObject(formData))
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) }
  const [truck] = await db.select({ id: trucks.id }).from(trucks).where(eq(trucks.id, truckId)).limit(1)
  if (!truck) return { ok: false, message: 'Truck not found' }

  if (warrantyId) {
    await db
      .update(truckWarranties)
      .set(parsed.data)
      .where(and(eq(truckWarranties.id, warrantyId), eq(truckWarranties.truckId, truckId)))
  } else {
    await db.insert(truckWarranties).values({ ...parsed.data, truckId })
  }
  revalidatePath(`/logistics/${truckId}`)
  revalidatePath('/logistics')
  return { ok: true, message: warrantyId ? 'Warranty saved' : 'Warranty added' }
}

export async function deleteWarranty(truckId: number, warrantyId: number): Promise<ActionState> {
  await requireAdmin()
  await db.delete(truckWarranties).where(and(eq(truckWarranties.id, warrantyId), eq(truckWarranties.truckId, truckId)))
  revalidatePath(`/logistics/${truckId}`)
  revalidatePath('/logistics')
  return { ok: true, message: 'Warranty removed' }
}
