import { PageBody, PageHeader } from '@/components/page-header'
import { SalesTrendChart } from '@/components/sales/sales-trend-chart'
import { SalesSummary } from '@/components/sales/sales-summary'
import { SalesTable } from '@/components/sales/sales-table'
import {
  PERFORMANCE_PERIODS,
  SalespersonPerformance,
  type PerformancePeriod,
} from '@/components/sales/salesperson-performance'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Sales trends' }

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const period: PerformancePeriod = PERFORMANCE_PERIODS.find((p) => p.id === sp.period)?.id ?? 'month'
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Sales trends"
        description="Salesperson performance from estimates and jobs, plus 2026 compared with 2025, 2024 and 2023."
      />
      <PageBody>
        <SalespersonPerformance period={period} />
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
