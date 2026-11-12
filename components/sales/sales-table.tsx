import { Change } from '@/components/sales/sales-summary'
import { LAST_FULL_MONTH, MONTHLY_SALES, MONTHS, NOVEMBER_TO_DATE, pctChange, YEARS, yearToDate } from '@/lib/sales-history'

const usd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function SalesTable() {
  return (
    <section aria-labelledby="month-table-heading" className="flex flex-col gap-3">
      <h2 id="month-table-heading" className="font-semibold">
        Month by month
      </h2>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Month</th>
              {YEARS.map((y) => (
                <th key={y} scope="col" className="px-4 py-2.5 text-right font-medium">{y}</th>
              ))}
              <th scope="col" className="px-4 py-2.5 text-right font-medium">vs. 2025</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">vs. 2024</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MONTHS.map((m, i) => {
              const isNov = i === LAST_FULL_MONTH + 1
              const current = MONTHLY_SALES[2026][i]
              const row = isNov
                ? YEARS.map((y) => NOVEMBER_TO_DATE[y])
                : YEARS.map((y) => MONTHLY_SALES[y][i])
              const now = isNov ? NOVEMBER_TO_DATE[2026] : current
              return (
                <tr key={m}>
                  <th scope="row" className="px-4 py-2.5 text-left font-medium">
                    {m}
                    {isNov && <span className="ml-2 text-xs font-normal text-muted-foreground">weeks 1–3</span>}
                  </th>
                  {row.map((v, j) => (
                    <td key={YEARS[j]} className={`px-4 py-2.5 text-right tabular-nums ${j === 0 ? 'font-semibold' : 'text-muted-foreground'}`}>
                      {v == null ? '—' : usd(v)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    {now == null ? '—' : <Change value={pctChange(now, row[1] ?? 0)} />}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {now == null ? '—' : <Change value={pctChange(now, row[2] ?? 0)} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t bg-muted/50">
            <tr>
              <th scope="row" className="px-4 py-2.5 text-left font-semibold">Jan–Oct</th>
              {YEARS.map((y) => (
                <td key={y} className="px-4 py-2.5 text-right font-semibold tabular-nums">{usd(yearToDate(y))}</td>
              ))}
              <td className="px-4 py-2.5 text-right"><Change value={pctChange(yearToDate(2026), yearToDate(2025))} /></td>
              <td className="px-4 py-2.5 text-right"><Change value={pctChange(yearToDate(2026), yearToDate(2024))} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
