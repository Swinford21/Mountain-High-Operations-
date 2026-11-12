import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBody, PageHeader } from '@/components/page-header'
import { DuplicateGroupCard } from '@/components/customers/duplicate-group'
import { findDuplicateGroups } from '@/lib/customer-merge'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Possible duplicates' }

const PAGE_SIZE = 25

export default async function DuplicatesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin()
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const { groups, total } = await findDuplicateGroups(PAGE_SIZE, (page - 1) * PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Possible duplicates"
        description={`${total.toLocaleString()} group${total === 1 ? '' : 's'} of customers share an email or phone number. Families and companies often share contact info, so check each group before merging.`}
        actions={
          <Button variant="outline" render={<Link href="/customers" />} nativeButton={false}>
            <ArrowLeft aria-hidden="true" />
            All customers
          </Button>
        }
      />
      <PageBody>
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No possible duplicates found.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {groups.map((g) => (
              <li key={`${g.kind}:${g.key}`}>
                <DuplicateGroupCard group={g} />
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" render={<Link href={`/customers/duplicates?page=${page - 1}`} />} nativeButton={false}>
                  Previous
                </Button>
              )}
              {page < pages && (
                <Button variant="outline" size="sm" render={<Link href={`/customers/duplicates?page=${page + 1}`} />} nativeButton={false}>
                  Next
                </Button>
              )}
            </div>
          </nav>
        )}
      </PageBody>
    </>
  )
}
