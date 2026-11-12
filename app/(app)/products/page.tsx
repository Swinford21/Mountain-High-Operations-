import Link from 'next/link'
import { and, asc, eq, ilike, type SQL } from 'drizzle-orm'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PageBody, PageHeader } from '@/components/page-header'
import { ProductRow } from '@/components/products/product-row'
import { db } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/session'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Products' }

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 100)
  const category = sp.category ?? ''

  const categories = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .orderBy(asc(products.category))

  const conditions: SQL[] = []
  if (q) conditions.push(ilike(products.name, `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`))
  if (category) conditions.push(eq(products.category, category))

  const rows = await db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(products.category), asc(products.name))

  const grouped = new Map<string, typeof rows>()
  for (const r of rows) grouped.set(r.category, [...(grouped.get(r.category) ?? []), r])

  const href = (c: string) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (c) p.set('category', c)
    const s = p.toString()
    return s ? `/products?${s}` : '/products'
  }

  return (
    <>
      <PageHeader
        eyebrow="Square catalog"
        title="Products"
        description={`${rows.length} product${rows.length === 1 ? '' : 's'}. Prices here fill in automatically when you add materials to a job.`}
      />
      <PageBody>
        <form role="search" className="relative max-w-md">
          {category && <input type="hidden" name="category" value={category} />}
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input id="product-search" name="q" defaultValue={q} placeholder="Search products" className="h-10 bg-card pl-9" />
        </form>

        <nav aria-label="Categories" className="flex flex-wrap gap-2">
          {[{ category: '' }, ...categories].map((c) => (
            <Link
              key={c.category || 'all'}
              href={href(c.category)}
              aria-current={category === c.category ? 'true' : undefined}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium',
                category === c.category ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
              )}
            >
              {c.category || 'All'}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-8">
          {[...grouped.entries()].map(([cat, list]) => (
            <section key={cat} className="flex flex-col gap-2">
              <h2 className="font-display text-xl font-extrabold tracking-wide uppercase">{cat}</h2>
              <ul className="flex flex-col divide-y rounded-xl border bg-card">
                {list.map((p) => (
                  <ProductRow
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    unit={p.unit}
                    priceCents={p.priceCents}
                    active={p.active}
                  />
                ))}
              </ul>
            </section>
          ))}
          {rows.length === 0 && <p className="text-muted-foreground">No products match.</p>}
        </div>
      </PageBody>
    </>
  )
}
