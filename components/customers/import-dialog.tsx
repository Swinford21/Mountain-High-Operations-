'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { importCustomers } from '@/app/actions/customers'

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const FIELDS = [
  { id: 'name', label: 'Full name', hints: ['full name', 'name', 'customer', 'customer name', 'client'] },
  { id: 'firstName', label: 'First name', hints: ['first name', 'first', 'given name'] },
  { id: 'lastName', label: 'Last name', hints: ['last name', 'last', 'surname', 'family name'] },
  { id: 'company', label: 'Company', hints: ['company', 'business', 'company name'] },
  { id: 'email', label: 'Email', hints: ['email', 'email address', 'e-mail'] },
  { id: 'phone', label: 'Phone', hints: ['phone', 'phone number', 'mobile', 'cell', 'telephone'] },
  { id: 'street', label: 'Street address', hints: ['address', 'street', 'street address', 'address 1', 'address line 1'] },
  { id: 'city', label: 'City', hints: ['city', 'town'] },
  { id: 'state', label: 'State', hints: ['state', 'st', 'province'] },
  { id: 'zip', label: 'ZIP', hints: ['zip', 'zip code', 'postal code', 'postal'] },
  { id: 'notes', label: 'Notes', hints: ['notes', 'note', 'comments', 'memo'] },
] as const

type FieldId = (typeof FIELDS)[number]['id']

function guessMapping(headers: string[]) {
  const mapping: Partial<Record<FieldId, number>> = {}
  const norm = headers.map((h) => h.trim().toLowerCase())
  for (const f of FIELDS) {
    const idx = norm.findIndex((h) => (f.hints as readonly string[]).includes(h))
    if (idx >= 0) mapping[f.id] = idx
  }
  return mapping
}

export function ImportDialog() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Partial<Record<FieldId, number>>>({})
  const [pending, startTransition] = useTransition()
  const [progress, setProgress] = useState<string | null>(null)

  const headers = rows[0] ?? []
  const body = rows.slice(1)

  const mapped = useMemo(() => {
    const get = (r: string[], f: FieldId) => (mapping[f] !== undefined ? (r[mapping[f]!] ?? '').trim() : '')
    return body
      .map((r) => {
        const name =
          get(r, 'name') || [get(r, 'firstName'), get(r, 'lastName')].filter(Boolean).join(' ') || get(r, 'company')
        const cityLine = [get(r, 'city'), [get(r, 'state'), get(r, 'zip')].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', ')
        const address = [get(r, 'street'), cityLine].filter(Boolean).join(', ')
        return { name, email: get(r, 'email'), phone: get(r, 'phone'), address, notes: get(r, 'notes') }
      })
      .filter((r) => r.name)
  }, [body, mapping])

  async function onFile(file: File) {
    const text = await file.text()
    const parsed = parseCsv(text.replace(/^\uFEFF/, ''))
    setRows(parsed)
    setMapping(guessMapping(parsed[0] ?? []))
  }

  function runImport() {
    startTransition(async () => {
      let created = 0
      let skipped = 0
      for (let i = 0; i < mapped.length; i += 500) {
        setProgress(`Importing ${Math.min(i + 500, mapped.length)} of ${mapped.length}…`)
        const r = await importCustomers(mapped.slice(i, i + 500))
        if (!r?.ok) {
          toast.error(r?.message ?? 'Import failed')
          setProgress(null)
          return
        }
        created += r.created ?? 0
        skipped += r.skipped ?? 0
      }
      setProgress(null)
      toast.success(`Imported ${created} customers${skipped ? `, skipped ${skipped} duplicates or blanks` : ''}`)
      setRows([])
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload aria-hidden="true" />
        Import CSV
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import customers</DialogTitle>
          <DialogDescription>
            In Google Sheets choose File → Download → Comma-separated values (.csv), then pick that file here. Customers
            that already exist (same email or phone) are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="csv-file">CSV file</Label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
          />
        </div>

        {headers.length > 0 && (
          <>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-medium">Match your columns</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={`map-${f.id}`} className="text-muted-foreground">
                      {f.label}
                    </Label>
                    <NativeSelect
                      id={`map-${f.id}`}
                      value={mapping[f.id] ?? ''}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [f.id]: e.target.value === '' ? undefined : Number(e.target.value) }))
                      }
                    >
                      <option value="">Not in file</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                Preview <span className="font-normal text-muted-foreground">({mapped.length} customers found)</span>
              </p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th scope="col" className="px-2 py-1.5">Name</th>
                      <th scope="col" className="px-2 py-1.5">Email</th>
                      <th scope="col" className="px-2 py-1.5">Phone</th>
                      <th scope="col" className="px-2 py-1.5">Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mapped.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5">{r.name}</td>
                        <td className="px-2 py-1.5">{r.email}</td>
                        <td className="px-2 py-1.5">{r.phone}</td>
                        <td className="max-w-48 truncate px-2 py-1.5">{r.address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <DialogFooter className="items-center">
          {progress && <p className="text-sm text-muted-foreground" aria-live="polite">{progress}</p>}
          <Button disabled={pending || mapped.length === 0} onClick={runImport}>
            {pending ? 'Importing…' : `Import ${mapped.length || ''} customers`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
