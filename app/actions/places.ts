'use server'

import { requireAdmin } from '@/lib/session'

export type AddressSuggestion = { placeId: string; text: string }

/**
 * Google Places (New) address autocomplete. Runs on the server so the API key never reaches the browser.
 * Returns [] when Google isn't configured so the address field still works as a plain input.
 */
export async function suggestAddresses(query: string, sessionToken: string): Promise<AddressSuggestion[]> {
  await requireAdmin()
  const key = process.env.GOOGLE_MAPS_API_KEY
  const input = String(query ?? '').trim().slice(0, 200)
  if (!key || input.length < 3) return []

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text',
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ['us'],
        sessionToken: /^[\w-]{1,64}$/.test(sessionToken) ? sessionToken : undefined,
      }),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error('[places] autocomplete failed', res.status, (await res.text()).slice(0, 300))
      return []
    }
    const data = (await res.json()) as {
      suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[]
    }
    return (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is { placeId: string; text: { text: string } } => !!p?.placeId && !!p.text?.text)
      .map((p) => ({ placeId: p.placeId, text: p.text.text.replace(/, USA$/, '') }))
  } catch (err) {
    console.error('[places] autocomplete error', err)
    return []
  }
}
