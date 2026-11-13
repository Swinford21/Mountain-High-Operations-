'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { account, products, session, trucks, user } from '@/lib/db/schema'
import { requireAdmin, requireOwner } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const roleSchema = z.enum(['owner', 'admin', 'crew', 'pending'])

export async function setUserRole(userId: string, role: string): Promise<ActionState> {
  const me = await requireAdmin()
  const parsed = roleSchema.safeParse(role)
  if (!parsed.success) return { ok: false, message: 'Unknown role' }
  if (userId === me.id) return { ok: false, message: "You can't change your own role" }

  const [target] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)
  if (!target) return { ok: false, message: 'Team member not found' }
  if ((parsed.data === 'owner' || target.role === 'owner') && me.role !== 'owner') {
    return { ok: false, message: 'Only an owner can manage owners' }
  }

  await db.update(user).set({ role: parsed.data, updatedAt: new Date() }).where(eq(user.id, userId))
  // Revoking access signs them out everywhere.
  if (parsed.data === 'pending') await db.delete(session).where(eq(session.userId, userId))
  revalidatePath('/team')
  return {
    ok: true,
    message: parsed.data === 'pending' ? 'Access removed' : `Role set to ${parsed.data}`,
  }
}

const passwordSchema = z
  .string()
  .min(8, 'Passwords need at least 8 characters')
  .max(128, 'Keep passwords under 128 characters')

/** Owner-only: set a new sign-in password for a team member and sign them out of other devices. */
export async function setUserPassword(userId: string, password: string): Promise<ActionState> {
  const me = await requireOwner()
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid password' }

  const [target] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, userId)).limit(1)
  if (!target) return { ok: false, message: 'Team member not found' }

  const ctx = await auth.$context
  const hash = await ctx.password.hash(parsed.data)
  const updated = await db
    .update(account)
    .set({ password: hash, updatedAt: new Date() })
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
    .returning({ id: account.id })
  if (updated.length === 0) {
    await ctx.internalAdapter.linkAccount({ userId, accountId: userId, providerId: 'credential', password: hash })
  }
  if (userId !== me.id) await db.delete(session).where(eq(session.userId, userId))

  return {
    ok: true,
    message: userId === me.id ? 'Your password was changed' : `Password changed for ${target.name}. They were signed out.`,
  }
}

export async function setTruckColor(truckId: number, color: string): Promise<ActionState> {
  await requireAdmin()
  if (!Number.isInteger(truckId) || truckId <= 0) return { ok: false, message: 'Truck not found' }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { ok: false, message: 'Pick a valid color' }
  const [updated] = await db
    .update(trucks)
    .set({ color: color.toLowerCase() })
    .where(eq(trucks.id, truckId))
    .returning({ name: trucks.name })
  if (!updated) return { ok: false, message: 'Truck not found' }
  revalidatePath('/', 'layout')
  return { ok: true, message: `${updated.name} color updated` }
}

export async function updateProduct(
  productId: number,
  input: { priceCents?: number | null; active?: boolean },
): Promise<ActionState> {
  await requireAdmin()
  const parsed = z
    .object({
      priceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
      active: z.boolean().optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid value' }
  await db.update(products).set(parsed.data).where(eq(products.id, productId))
  revalidatePath('/products')
  return { ok: true, message: 'Product updated' }
}
