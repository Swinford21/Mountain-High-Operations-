'use client'

import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CopyLinkButton({ url }: { url: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          toast.success('Link copied')
        } catch {
          toast.error('Could not copy — select the link and copy it manually')
        }
      }}
    >
      <Copy aria-hidden="true" />
      Copy
    </Button>
  )
}
