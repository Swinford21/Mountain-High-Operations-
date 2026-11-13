import { z } from 'zod'

/** FormData → plain object, with empty fields dropped so optional schemas treat them as missing. */
export function formObject(formData: FormData) {
  const raw: Record<string, FormDataEntryValue> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && value.trim() === '') continue
    raw[key] = value
  }
  return raw
}

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null)

export const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date')
  .optional()
  .transform((v) => v ?? null)

export const optionalInt = (max = 10_000_000) =>
  z.coerce
    .number()
    .int('Use a whole number')
    .min(0)
    .max(max)
    .optional()
    .transform((v) => v ?? null)

/** "$1,234.50" → 123450 cents. */
export const optionalMoney = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null
    const n = Number(v.replace(/[$,]/g, ''))
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid dollar amount' })
      return z.NEVER
    }
    return Math.round(n * 100)
  })

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid color').transform((v) => v.toLowerCase())

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Check the form'
}
