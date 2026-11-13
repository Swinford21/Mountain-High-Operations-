import { cache } from 'react'
import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { operations } from '@/lib/db/schema'
import type { Operation } from '@/lib/operations'

/** Every operation, including archived ones (so old jobs still show their name and color). */
export const getAllOperations = cache(async (): Promise<Operation[]> => {
  return db
    .select({
      id: operations.id,
      label: operations.label,
      singular: operations.singular,
      color: operations.color,
      active: operations.active,
      sortOrder: operations.sortOrder,
    })
    .from(operations)
    .orderBy(asc(operations.sortOrder), asc(operations.label))
})

/** Operations that can be picked for new jobs and filters. */
export async function getOperations() {
  return (await getAllOperations()).filter((o) => o.active)
}
