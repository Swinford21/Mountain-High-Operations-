import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Archivo, Big_Shoulders } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo' })
const display = Big_Shoulders({ subsets: ['latin'], weight: ['700', '800', '900'], variable: '--font-display-face' })

export const metadata: Metadata = {
  title: {
    default: 'Mountain High Operations',
    template: '%s | Mountain High Operations',
  },
  description:
    'Scheduling, time clock, customer messaging, and Square payments for Mountain High Landscape Supply.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0d2547',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background ${archivo.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" richColors />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
