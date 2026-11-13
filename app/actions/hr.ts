'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'
import { firstIssue, formObject, optionalDate, optionalMoney, optionalText } from '@/lib/form'
import { requireAdmin } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const employeeSchema = z.object({
  name: z.string().trim().min(1, 'Add the employee name').max(120),
  userId: optionalText(100),
  position: optionalText(120),
  email: z
    .string()
    .trim()
    .email('Use a valid email')
    .max(200)
    .optional()
    .transform((v) => v ?? null),
  phone: optionalText(40),
  address: optionalText(300),
  hireDate: optionalDate,
  birthDate: optionalDate,
  payType: z
    .enum(['hourly', 'salary'])
    .optional()
    .transform((v) => v ?? null),
  payRate: optionalMoney,
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalText(40),
  status: z.enum(['active', 'inactive']).default('active'),
  terminationDate: optionalDate,
  notes: optionalText(4000),
})

export async function saveEmployee(employeeId: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  const parsed = employeeSchema.safeParse(formObject(formData))
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) }
  const { payRate, ...data } = parsed.data
  const values = { ...data, payRateCents: payRate, terminationDate: data.status === 'inactive' ? data.terminationDate : null }

  try {
    if (employeeId) {
      const [updated] = await db
        .update(employees)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(employees.id, employeeId))
        .returning({ id: employees.id })
      if (!updated) return { ok: false, message: 'Employee not found' }
    } else {
      await db.insert(employees).values(values)
    }
  } catch (e) {
    if (e instanceof Error && /unique/i.test(e.message)) {
      return { ok: false, message: 'That app login is already linked to another employee' }
    }
    throw e
  }

  revalidatePath('/hr')
  revalidatePath('/')
  return { ok: true, message: employeeId ? `${data.name} saved` : `${data.name} added` }
}

export async function deleteEmployee(employeeId: number): Promise<ActionState> {
  await requireAdmin()
  await db.delete(employees).where(eq(employees.id, employeeId))
  revalidatePath('/hr')
  revalidatePath('/')
  return { ok: true, message: 'Employee record deleted' }
}
