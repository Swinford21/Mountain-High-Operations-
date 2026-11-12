import Link from 'next/link'
import { asc, ilike, or, sql } from 'drizzle-orm'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageBody, PageHeader } from '@/components/page-header'
import { ImportDialog } from '@/components/customers/import-dialog'
import { SquareSyncButton } from '@/components/customers/square-sync-button'
import { db } from '@/lib/db'
import { customers } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Customers' }

const PAGE_SIZE = 50

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 100)
  const page = Math.max(1, Number(sp.page) || 1)
  const pattern = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`
  const where = q
    ? or(
        ilike(customers.name, pattern),
        ilike(customers.email, pattern),
        ilike(customers.phone, pattern),
        ilike(customers.address, pattern),
      )
    : undefined

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        address: customers.address,
        squareCustomerId: customers.squareCustomerId,
        jobCount: sql<number>`(select count(*)::int from jobs j where j.customer_id = ${customers.id})`,
      })
      .from(customers)
      .where(where)
      .orderBy(asc(customers.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(customers).where(where),
  ])
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const pageHref = (p: number) => `/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Customers"
        description={`${count.toLocaleString()} customer${count === 1 ? '' : 's'}${q ? ` matching "${q}"` : ''}`}
        actions={
          <>
            <SquareSyncButton />
            <ImportDialog />
            <Button render={<Link href="/customers/new" />} nativeButton={false}>
              <Plus aria-hidden="true" />
              Add customer
            </Button>
          </>
        }
      />
      <PageBody>
        <form className="relative max-w-md" role="search">
          <label htmlFor="customer-search" className="sr-only">
            Search customers
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="customer-search"
            name="q"
            defaultValue={q}
            placeholder="Search name, email, phone, address"
            className="h-10 bg-card pl-9"
          />
        </form>

        {rows.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
            <p className="font-medium">{q ? 'No customers match that search.' : 'No customers yet.'}</p>
            {!q && (
              <p className="max-w-lg leading-relaxed text-muted-foreground">
                Import your Google Sheet as a CSV, pull customers in from Square, or add them one at a time.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Phone</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Email</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Address</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/customers/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                        {c.name}
                      </Link>
                      {c.squareCustomerId && (
                        <Badge variant="outline" className="ml-2 align-middle">
                          Square
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{c.phone ?? '—'}</td>
                    <td className="hidden max-w-56 truncate px-4 py-2.5 md:table-cell">{c.email ?? '—'}</td>
                    <td className="hidden max-w-72 truncate px-4 py-2.5 text-muted-foreground lg:table-cell">
                      {c.address ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.jobCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-3 text-sm">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="underline underline-offset-4">
                Previous
              </Link>
            )}
            <span className="text-muted-foreground">
              Page {page} of {pages}
            </span>
            {page < pages && (
              <Link href={pageHref(page + 1)} className="underline underline-offset-4">
                Next
              </Link>
            )}
          </nav>
        )}
      </PageBody>
    </>
  )
}
