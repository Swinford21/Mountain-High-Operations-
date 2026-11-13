import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

export const OWNER_EMAILS = (process.env.OWNER_EMAILS ?? 'eric@mountainhighmulch.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

// Exact extra origins (e.g. a custom domain) as a comma-separated list. No wildcards.
const EXTRA_TRUSTED_ORIGINS = (process.env.TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => /^https:\/\/[^*\s/]+$/.test(o))

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_ENV === 'production'
      ? 'https://mountainhighops.com'
      : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'pending', input: false },
      phone: { type: 'string', required: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Owner emails become owners automatically. Everyone else signs up as
        // "pending" until an admin approves them on the Team page.
        before: async (newUser) => {
          const isOwner = OWNER_EMAILS.includes(newUser.email.trim().toLowerCase())
          return { data: { ...newUser, role: isOwner ? 'owner' : 'pending' } }
        },
      },
    },
  },
  trustedOrigins: [
    ...EXTRA_TRUSTED_ORIGINS,
    ...(process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          // Exact origin of this project's v0 preview iframe.
          'https://push-to-github.v0.build',
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
          ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
          ...(process.env.V0_BUILD_URL ? [process.env.V0_BUILD_URL] : []),
          ...(process.env.V0_SANDBOX_URL ? [process.env.V0_SANDBOX_URL] : []),
        ]
      : []),
    ...(process.env.NODE_ENV === 'production'
      ? [
          'https://mountainhighops.com',
          'https://www.mountainhighops.com',
          ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          // Required by the cross-site v0 preview iframe. Without these
          // attributes, login succeeds but the next request appears signed out.
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
