import { AppSidebar, MobileTopBar } from '@/components/app-nav'
import { requireUser } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const navUser = { name: user.name, email: user.email, role: user.role }
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <AppSidebar user={navUser} />
      <MobileTopBar user={navUser} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
