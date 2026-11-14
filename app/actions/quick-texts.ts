'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { BUSINESS_NAME, logMessage, sendSms } from '@/lib/notify'
import { getJobDetail } from '@/lib/queries'
import { requireUser } from '@/lib/session'
import type { ActionState } from '@/app/actions/jobs'

const GOOGLE_REVIEW_URL = 'https://g.page/r/CXWwSe78wYlEEBM/review'

const kindSchema = z.enum(['on-our-way', 'arrived', 'google-review'])
export type QuickTextKind = z.infer<typeof kindSchema>

function messageFor(kind: QuickTextKind, firstName: string, jobTitle: string) {
  switch (kind) {
    case 'on-our-way':
      return `${BUSINESS_NAME}: Hi ${firstName}, our crew is on the way for your ${jobTitle}. See you soon!`
    case 'arrived':
      return `${BUSINESS_NAME}: Hi ${firstName}, our crew has arrived for your ${jobTitle}.`
    case 'google-review':
      return `Thank you for choosing ${BUSINESS_NAME}, ${firstName}! If you have a minute, we'd really appreciate a Google review: ${GOOGLE_REVIEW_URL}`
  }
}

const LABELS: Record<QuickTextKind, string> = {
  'on-our-way': 'On our way',
  arrived: 'We have arrived',
  'google-review': 'Google review',
}

/** Crew and admins can both send these from the job page. */
export async function sendQuickText(jobId: number, kind: QuickTextKind): Promise<ActionState> {
  await requireUser()
  const parsedKind = kindSchema.safeParse(kind)
  if (!parsedKind.success || !Number.isInteger(jobId) || jobId <= 0) return { ok: false, message: 'Invalid request' }

  const detail = await getJobDetail(jobId)
  if (!detail) return { ok: false, message: 'Job not found' }
  const { customer, job } = detail
  if (!customer.phone) return { ok: false, message: 'Customer has no phone number on file' }

  const firstName = customer.name.trim().split(/\s+/)[0] || 'there'
  const result = await sendSms({
    to: customer.phone,
    body: messageFor(parsedKind.data, firstName, job.title),
    logo: false,
  })
  await logMessage({
    customerId: customer.id,
    jobId,
    channel: 'sms',
    kind: parsedKind.data,
    recipient: customer.phone,
    result,
  })
  revalidatePath(`/jobs/${jobId}`)
  return result.ok
    ? { ok: true, message: `"${LABELS[parsedKind.data]}" text sent to ${customer.name}` }
    : { ok: false, message: result.error }
}
