import { AppSidebar, MobileTopBar } from '@/components/app-nav'
import { countUnscheduledEstimates } from '@/lib/estimates'
import { isAdminRole, requireUser } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const unscheduledCount = isAdminRole(user.role) ? await countUnscheduledEstimates() : 0
  const navUser = { name: user.name, email: user.email, role: user.role, unscheduledCount }
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <AppSidebar user={navUser} />
      <MobileTopBar user={navUser} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
