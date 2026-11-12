'use server'

import { requireAdmin } from '@/lib/session'

export type AddressSuggestion = { placeId: string; text: string }

/** Marietta, GA — results near the yard rank first. */
const BIAS = { lon: -84.55, lat: 33.95 }

/**
 * Address autocomplete. Uses Geoapify when GEOAPIFY_API_KEY is set, otherwise Google Places (New).
 * Runs on the server so the key never reaches the browser, and returns [] when no provider is
 * configured so the address field still works as a plain input.
 */
export async function suggestAddresses(query: string, sessionToken: string): Promise<AddressSuggestion[]> {
  await requireAdmin()
  const input = String(query ?? '').trim().slice(0, 200)
  if (input.length < 3) return []
  if (process.env.GEOAPIFY_API_KEY) return geoapify(input, process.env.GEOAPIFY_API_KEY)
  if (process.env.GOOGLE_MAPS_API_KEY) return google(input, sessionToken, process.env.GOOGLE_MAPS_API_KEY)
  return []
}

async function geoapify(input: string, key: string): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    text: input,
    filter: 'countrycode:us',
    bias: `proximity:${BIAS.lon},${BIAS.lat}`,
    format: 'json',
    limit: '6',
    apiKey: key,
  })
  try {
    const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, { cache: 'no-store' })
    if (!res.ok) {
      console.error('[places] geoapify autocomplete failed', res.status, (await res.text()).slice(0, 300))
      return []
    }
    const data = (await res.json()) as { results?: { place_id?: string; formatted?: string }[] }
    const seen = new Set<string>()
    return (data.results ?? [])
      .filter((r): r is { place_id: string; formatted: string } => !!r.place_id && !!r.formatted)
      .map((r) => ({ placeId: r.place_id, text: r.formatted.replace(/, United States of America$/, '') }))
      .filter((s) => !seen.has(s.text) && !!seen.add(s.text))
  } catch (err) {
    console.error('[places] geoapify autocomplete error', err)
    return []
  }
}

async function google(input: string, sessionToken: string, key: string): Promise<AddressSuggestion[]> {
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
      console.error('[places] google autocomplete failed', res.status, (await res.text()).slice(0, 300))
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
    console.error('[places] google autocomplete error', err)
    return []
  }
}
