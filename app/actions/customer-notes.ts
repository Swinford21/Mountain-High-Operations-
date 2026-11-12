'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { customerNotes, customers } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const noteSchema = z.object({
  targetId: z.coerce.number().int().positive(),
  body: z.string().trim().min(1, 'Write a note first').max(4000, 'Keep notes under 4,000 characters'),
})

export async function addCustomerNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAdmin()
  const parsed = noteSchema.safeParse({ targetId: formData.get('targetId'), body: formData.get('body') })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the note' }
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, parsed.data.targetId))
    .limit(1)
  if (!customer) return { ok: false, message: 'Customer not found' }
  await db.insert(customerNotes).values({ customerId: customer.id, authorId: me.id, body: parsed.data.body })
  revalidatePath(`/customers/${customer.id}`)
  return { ok: true, message: 'Note added' }
}

export async function deleteCustomerNote(noteId: number): Promise<ActionState> {
  await requireAdmin()
  if (!Number.isInteger(noteId)) return { ok: false, message: 'Invalid note' }
  const [note] = await db.delete(customerNotes).where(eq(customerNotes.id, noteId)).returning()
  if (!note) return { ok: false, message: 'Note not found' }
  revalidatePath(`/customers/${note.customerId}`)
  return { ok: true, message: 'Note deleted' }
}
