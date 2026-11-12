import { PageBody, PageHeader } from '@/components/page-header'
import { SalesTrendChart } from '@/components/sales/sales-trend-chart'
import { SalesSummary } from '@/components/sales/sales-summary'
import { SalesTable } from '@/components/sales/sales-table'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Sales trends' }

export default async function SalesPage() {
  await requireAdmin()
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Sales trends"
        description="2026 compared with 2025, 2024 and 2023. Full months through October, November in progress."
      />
      <PageBody>
        <SalesSummary />
        <SalesTrendChart />
        <SalesTable />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Source: the monthly tabs of the 2026 sales tracker spreadsheet. Starting in August, the tracker splits sales
          into pickup, install and delivery and compares each month against the same breakdown in prior years. That&apos;s
          why the prior-year figures for August through December are lower than the totals on the &quot;Sales Percent
          Breakdown&quot; tab.
        </p>
      </PageBody>
    </>
  )
}
