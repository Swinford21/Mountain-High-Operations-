'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { products, session, user } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const roleSchema = z.enum(['admin', 'crew', 'pending'])

export async function setUserRole(userId: string, role: string): Promise<ActionState> {
  const me = await requireAdmin()
  const parsed = roleSchema.safeParse(role)
  if (!parsed.success) return { ok: false, message: 'Unknown role' }
  if (userId === me.id && parsed.data !== 'admin') return { ok: false, message: "You can't remove your own admin access" }

  await db.update(user).set({ role: parsed.data, updatedAt: new Date() }).where(eq(user.id, userId))
  // Revoking access signs them out everywhere.
  if (parsed.data === 'pending') await db.delete(session).where(eq(session.userId, userId))
  revalidatePath('/team')
  return {
    ok: true,
    message: parsed.data === 'pending' ? 'Access removed' : `Role set to ${parsed.data}`,
  }
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
