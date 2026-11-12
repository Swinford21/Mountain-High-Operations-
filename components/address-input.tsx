'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { suggestAddresses, type AddressSuggestion } from '@/app/actions/places'
import { cn } from '@/lib/utils'

/** Address field with Google Maps suggestions. Works controlled (value + onValueChange) or uncontrolled (defaultValue). */
export function AddressInput({
  id,
  name,
  value,
  defaultValue = '',
  onValueChange,
  placeholder,
  className,
}: {
  id: string
  name: string
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const listId = useId()
  const [inner, setInner] = useState(defaultValue)
  const current = value ?? inner
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [, startSearch] = useTransition()
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef('')
  const session = useRef('')

  function setValue(next: string) {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  function onType(next: string) {
    setValue(next)
    setActive(-1)
    latest.current = next
    clearTimeout(debounce.current)
    if (next.trim().length < 3) {
      setSuggestions([])
      return
    }
    if (!session.current) session.current = crypto.randomUUID()
    debounce.current = setTimeout(() => {
      startSearch(async () => {
        const results = await suggestAddresses(next, session.current)
        if (latest.current === next) {
          setSuggestions(results)
          setOpen(results.length > 0)
        }
      })
    }, 250)
  }

  function choose(s: AddressSuggestion) {
    setValue(s.text)
    setSuggestions([])
    setOpen(false)
    session.current = ''
  }

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        value={current}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={cn('h-9', className)}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !suggestions.length) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => (i + 1) % suggestions.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault()
            choose(suggestions[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm',
                i === active ? 'bg-muted' : 'hover:bg-muted',
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
            >
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{s.text}</span>
            </li>
          ))}
          <li className="px-3 pt-1 pb-0.5 text-right text-xs text-muted-foreground" aria-hidden="true">
            Powered by Google
          </li>
        </ul>
      )}
    </div>
  )
}
