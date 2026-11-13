export const POSITIONS = [
  { id: 'manager', label: 'Manager' },
  { id: 'installer', label: 'Installer' },
  { id: 'driver', label: 'Driver' },
] as const

export type PositionId = (typeof POSITIONS)[number]['id']

export function positionLabel(id: string | null | undefined) {
  return POSITIONS.find((p) => p.id === id)?.label ?? null
}
