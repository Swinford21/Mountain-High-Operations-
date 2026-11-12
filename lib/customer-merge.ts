import { inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customerHistory, customerNotes, customers, jobs, messageLog, payments, type Customer } from '@/lib/db/schema'

const FILLABLE = ['email', 'phone', 'address', 'company', 'defaultOperation', 'primaryOperation', 'location', 'tags'] as const

/**
 * Folds `mergeIds` into `keepId`: moves their jobs, payments, messages and service history,
 * fills any blank contact fields on the kept record, then deletes the merged records.
 */
export async function mergeCustomers(keepId: number, mergeIds: number[]) {
  const ids = [...new Set(mergeIds)].filter((id) => id !== keepId)
  if (ids.length === 0) return { merged: 0 }

  return db.transaction(async (tx) => {
    const rows = await tx.select().from(customers).where(inArray(customers.id, [keepId, ...ids]))
    const keep = rows.find((r) => r.id === keepId)
    const others = rows.filter((r) => r.id !== keepId)
    if (!keep || others.length === 0) return { merged: 0 }
    const otherIds = others.map((o) => o.id)

    const patch: Partial<Customer> = {}
    for (const field of FILLABLE) {
      if (!keep[field]?.trim()) {
        const value = others.find((o) => o[field]?.trim())?.[field]
        if (value) patch[field] = value
      }
    }
    const notes = [keep.notes, ...others.map((o) => o.notes)].filter((n): n is string => !!n?.trim())
    const uniqueNotes = [...new Set(notes.map((n) => n.trim()))]
    if (uniqueNotes.length > 1 || (!keep.notes && uniqueNotes.length)) patch.notes = uniqueNotes.join('\n\n')
    const since = [keep.customerSince, ...others.map((o) => o.customerSince)].filter((d): d is string => !!d).sort()[0]
    if (since && since !== keep.customerSince) patch.customerSince = since
    if (others.some((o) => !o.emailOptIn)) patch.emailOptIn = false
    if (others.some((o) => !o.smsOptIn)) patch.smsOptIn = false
    const squareId = keep.squareCustomerId ?? others.find((o) => o.squareCustomerId)?.squareCustomerId
    const externalId = keep.externalId ?? others.find((o) => o.externalId)?.externalId

    await tx.update(jobs).set({ customerId: keepId }).where(inArray(jobs.customerId, otherIds))
    await tx.update(payments).set({ customerId: keepId }).where(inArray(payments.customerId, otherIds))
    await tx.update(messageLog).set({ customerId: keepId }).where(inArray(messageLog.customerId, otherIds))
    await tx.update(customerHistory).set({ customerId: keepId }).where(inArray(customerHistory.customerId, otherIds))
    await tx.update(customerNotes).set({ customerId: keepId }).where(inArray(customerNotes.customerId, otherIds))
    await tx.delete(customers).where(inArray(customers.id, otherIds))
    await tx
      .update(customers)
      .set({
        ...patch,
        ...(squareId && !keep.squareCustomerId ? { squareCustomerId: squareId } : {}),
        ...(externalId && !keep.externalId ? { externalId } : {}),
        updatedAt: new Date(),
      })
      .where(sql`${customers.id} = ${keepId}`)

    return { merged: otherIds.length }
  })
}

export type DuplicateGroup = {
  kind: 'email' | 'phone'
  key: string
  sameName: boolean
  members: {
    id: number
    name: string
    email: string | null
    phone: string | null
    address: string | null
    customerSince: string | null
    squareLinked: boolean
    jobCount: number
    historyCount: number
  }[]
}

/** Customers sharing an email or a 10-digit phone number, groups with matching names first. */
export async function findDuplicateGroups(limit: number, offset: number) {
  const groupsSql = sql`
    with c as (
      select id,
        lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', ' ', 'g')) as nk,
        lower(trim(coalesce(email, ''))) as ek,
        right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) as pk
      from customers
    ),
    g as (
      select 'email' as kind, ek as key, array_agg(id order by id) as ids, count(distinct nk) = 1 as same_name
      from c where ek <> '' group by ek having count(*) > 1
      union all
      select 'phone', pk, array_agg(id order by id), count(distinct nk) = 1
      from c where length(pk) = 10 group by pk having count(*) > 1
    ),
    d as (select distinct on (ids) * from g order by ids, kind)
  `
  const [groups, [{ total }]] = await Promise.all([
    db.execute<{ kind: 'email' | 'phone'; key: string; ids: number[]; same_name: boolean }>(
      sql`${groupsSql} select * from d order by same_name desc, key limit ${limit} offset ${offset}`,
    ),
    db.execute<{ total: number }>(sql`${groupsSql} select count(*)::int as total from d`).then((r) => r.rows),
  ])

  const ids = [...new Set(groups.rows.flatMap((g) => g.ids))]
  const members = ids.length
    ? await db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
          address: customers.address,
          customerSince: customers.customerSince,
          squareCustomerId: customers.squareCustomerId,
          jobCount: sql<number>`(select count(*)::int from jobs j where j.customer_id = ${customers.id})`,
          historyCount: sql<number>`(select count(*)::int from customer_history h where h.customer_id = ${customers.id})`,
        })
        .from(customers)
        .where(inArray(customers.id, ids))
    : []
  const byId = new Map(members.map((m) => [m.id, m]))

  const result: DuplicateGroup[] = groups.rows.map((g) => ({
    kind: g.kind,
    key: g.key,
    sameName: g.same_name,
    members: g.ids
      .map((id) => byId.get(id))
      .filter((m) => !!m)
      .map(({ squareCustomerId, ...m }) => ({ ...m, squareLinked: !!squareCustomerId })),
  }))
  return { groups: result, total }
}
