'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Merge } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { mergeDuplicateCustomers } from '@/app/actions/customers'
import type { DuplicateGroup } from '@/lib/customer-merge'

function defaultKeep(members: DuplicateGroup['members']) {
  return [...members].sort(
    (a, b) =>
      Number(b.squareLinked) - Number(a.squareLinked) ||
      b.jobCount + b.historyCount - (a.jobCount + a.historyCount) ||
      (a.customerSince ?? '9999').localeCompare(b.customerSince ?? '9999') ||
      a.id - b.id,
  )[0].id
}

export function DuplicateGroupCard({ group }: { group: DuplicateGroup }) {
  const [keepId, setKeepId] = useState(() => defaultKeep(group.members))
  const [selected, setSelected] = useState(() => new Set(group.members.map((m) => m.id)))
  const [pending, startTransition] = useTransition()
  const mergeIds = group.members.filter((m) => m.id !== keepId && selected.has(m.id)).map((m) => m.id)
  const radioName = `keep-${group.kind}-${group.key}`

  function toggle(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function merge() {
    startTransition(async () => {
      const res = await mergeDuplicateCustomers(keepId, mergeIds)
      if (res?.ok) toast.success(res.message)
      else toast.error(res?.message ?? 'Merge failed')
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label={`Customers sharing ${group.kind} ${group.key}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Same {group.kind}</span>
          <span className="font-medium">{group.key}</span>
          {group.sameName && (
            <Badge variant="outline" className="border-paid/40 bg-paid/10 text-paid">
              Same name
            </Badge>
          )}
        </div>
        <Button size="sm" disabled={pending || mergeIds.length === 0} onClick={merge}>
          <Merge aria-hidden="true" />
          {pending ? 'Merging…' : `Merge ${mergeIds.length} into kept record`}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th scope="col" className="py-1.5 pr-3 font-medium">Keep</th>
              <th scope="col" className="py-1.5 pr-3 font-medium">Merge</th>
              <th scope="col" className="py-1.5 pr-3 font-medium">Name</th>
              <th scope="col" className="py-1.5 pr-3 font-medium">Email</th>
              <th scope="col" className="py-1.5 pr-3 font-medium">Phone</th>
              <th scope="col" className="py-1.5 pr-3 font-medium">History</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {group.members.map((m) => {
              const isKeep = m.id === keepId
              return (
                <tr key={m.id} className={isKeep ? 'bg-muted/50' : undefined}>
                  <td className="py-2 pr-3">
                    <input
                      type="radio"
                      name={radioName}
                      checked={isKeep}
                      onChange={() => setKeepId(m.id)}
                      aria-label={`Keep ${m.name}`}
                      className="size-4 accent-primary"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Checkbox
                      checked={!isKeep && selected.has(m.id)}
                      disabled={isKeep}
                      onCheckedChange={(v) => toggle(m.id, !!v)}
                      aria-label={`Merge ${m.name}`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Link href={`/customers/${m.id}`} className="font-medium underline-offset-4 hover:underline">
                      {m.name}
                    </Link>
                    {m.squareLinked && <span className="ml-2 text-xs text-muted-foreground">Square</span>}
                    {m.address && <div className="text-xs text-muted-foreground">{m.address}</div>}
                  </td>
                  <td className="py-2 pr-3 break-all">{m.email ?? '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{m.phone ?? '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {m.jobCount} job{m.jobCount === 1 ? '' : 's'} · {m.historyCount} past
                    {m.customerSince ? ` · since ${m.customerSince.slice(0, 4)}` : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
