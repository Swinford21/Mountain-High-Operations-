'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuthForm({ mode, isFirstUser = false }: { mode: 'sign-in' | 'sign-up'; isFirstUser?: boolean }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    const name = String(form.get('name') ?? '')
    setError(null)
    setLoading(true)

    const { error } = isSignUp
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password })

    setLoading(false)
    if (error) {
      setError(isSignUp ? 'Could not create that account. Try a different email.' : 'Incorrect email or password.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col items-center justify-center gap-10 bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Image
          src="/images/logo.jpg"
          alt="Mountain High Landscape Supply, established 2017"
          width={360}
          height={480}
          priority
          className="h-auto w-full max-w-xs"
        />
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <p className="text-sm font-semibold tracking-widest text-balance text-brand-gold uppercase">
              Building community through leadership and innovation
            </p>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-xs font-semibold tracking-widest text-sidebar-foreground/60 uppercase">Our core values</h2>
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-base leading-relaxed text-sidebar-foreground/85">
                {['World Class Service', 'Only Premium Products', 'Respect the Team', 'Timeliness', 'Healthy Growth'].map(
                  (value) => (
                    <li key={value}>{value}</li>
                  ),
                )}
              </ul>
            </div>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <Image
            src="/images/logo.jpg"
            alt="Mountain High Landscape Supply"
            width={96}
            height={128}
            className="h-32 w-24 rounded-md lg:hidden"
          />

          <div className="flex flex-col gap-2">
            <h1 className="font-display text-4xl font-extrabold tracking-wide text-balance uppercase">
              {isSignUp ? (isFirstUser ? 'Set up the owner account' : 'Join the team') : 'Clock in to work'}
            </h1>
            <p className="leading-relaxed text-muted-foreground">
              {isSignUp
                ? isFirstUser
                  ? 'Sign up with the owner email (eric@mountainhighmulch.com) to get admin access. You can approve crew members after.'
                  : 'Create your account. An admin will approve you before you can see the schedule.'
                : 'Sign in to see the schedule and use the time clock.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isSignUp && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" name="name" required autoComplete="name" className="h-10" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="h-10"
              />
              {isSignUp && <p className="text-sm text-muted-foreground">At least 8 characters.</p>}
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="h-10 w-full">
              {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Already have an account? ' : 'New to the crew? '}
            <Link
              href={isSignUp ? '/sign-in' : '/sign-up'}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
