import Image from 'next/image'
import { UnsubscribeForm } from '@/components/marketing/unsubscribe-form'

export const metadata = { title: 'Unsubscribe', robots: { index: false } }

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; t?: string }>
}) {
  const sp = await searchParams
  const customerId = Number(sp.c)
  const token = sp.t ?? ''
  const valid = Number.isInteger(customerId) && customerId > 0 && token.length > 0

  return (
    <main className="flex min-h-svh items-center justify-center bg-sidebar px-6 py-12 text-sidebar-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Image src="/images/logo.jpg" alt="Mountain High Landscape Supply" width={120} height={160} className="h-40 w-30" />
        <h1 className="font-display text-3xl font-extrabold tracking-wide uppercase">Email preferences</h1>
        {valid ? (
          <UnsubscribeForm customerId={customerId} token={token} />
        ) : (
          <p className="leading-relaxed text-sidebar-foreground/80">
            This link is incomplete. Reply to any of our emails or call 678-335-2565 and we&apos;ll take you off the list.
          </p>
        )}
      </div>
    </main>
  )
}
