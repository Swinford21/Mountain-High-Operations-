'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  Menu,
  Megaphone,
  Package,
  Sun,
  Timer,
  TrendingUp,
  Users,
  UserCog,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/components/sign-out-button'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', label: 'Today', icon: Sun, admin: false },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, admin: false },
  { href: '/jobs', label: 'Jobs', icon: ClipboardList, admin: false },
  { href: '/time', label: 'Time Clock', icon: Timer, admin: false },
  { href: '/customers', label: 'Customers', icon: Users, admin: true },
  { href: '/products', label: 'Products', icon: Package, admin: true },
  { href: '/payments', label: 'Payments', icon: CreditCard, admin: true },
  { href: '/sales', label: 'Sales Trends', icon: TrendingUp, admin: true },
  { href: '/marketing', label: 'Marketing', icon: Megaphone, admin: true },
  { href: '/team', label: 'Team', icon: UserCog, admin: true },
]

type NavUser = { name: string; email: string; role: string }

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 px-2">
      <Image src="/images/logo.jpg" alt="" width={36} height={48} className="h-12 w-9 rounded-sm object-cover" />
      <span className="flex flex-col">
        <span className="font-display text-xl leading-none font-extrabold tracking-wide text-brand-red uppercase">
          Mountain High
        </span>
        <span className="text-xs font-semibold tracking-widest text-brand-gold uppercase">Operations</span>
      </span>
    </Link>
  )
}

function NavLinks({ user, onNavigate }: { user: NavUser; onNavigate?: () => void }) {
  const pathname = usePathname()
  const items = NAV.filter((i) => !i.admin || user.role === 'admin')
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className={cn('size-4', active && 'text-sidebar-primary')} aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function UserBlock({ user }: { user: NavUser }) {
  return (
    <div className="flex flex-col gap-2 border-t border-sidebar-border pt-4">
      <div className="flex flex-col px-2">
        <span className="truncate text-sm font-medium">{user.name}</span>
        <span className="truncate text-xs text-sidebar-foreground/70 capitalize">{user.role}</span>
      </div>
      <SignOutButton className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
    </div>
  )
}

export function AppSidebar({ user }: { user: NavUser }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-8 bg-sidebar px-3 py-5 text-sidebar-foreground lg:flex">
      <Brand />
      <div className="flex-1">
        <NavLinks user={user} />
      </div>
      <UserBlock user={user} />
    </aside>
  )
}

export function MobileTopBar({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
      <Brand />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Open menu"
            />
          }
        >
          <Menu aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col gap-8 border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand />
          <div className="flex-1">
            <NavLinks user={user} onNavigate={() => setOpen(false)} />
          </div>
          <UserBlock user={user} />
        </SheetContent>
      </Sheet>
    </header>
  )
}
