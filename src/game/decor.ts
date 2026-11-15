/** Placeable grounds decorations — benches, plantings, landmarks. */

export type DecorKind =
  | 'bench'
  | 'picnic'
  | 'ballwasher'
  | 'teesign'
  | 'lamp'
  | 'bin'
  | 'flowerbed'
  | 'planter'
  | 'shrub'
  | 'hedge'
  | 'oak'
  | 'spruce'
  | 'birch'
  | 'rocks'
  | 'flagpole'
  | 'birdbath'
  | 'fountain'
  | 'gazebo'
  | 'statue'
  | 'clocktower'

export type DecorGroup = 'Amenities' | 'Planting' | 'Landmarks'

export interface DecorSpec {
  kind: DecorKind
  name: string
  group: DecorGroup
  cost: number
  /** Adds to grounds appeal, which lifts weekly green fees */
  appeal: number
  /** Swatch colour for the palette */
  swatch: string
  /** Footprint radius in world units, for spacing checks */
  radius: number
}

export const DECOR_CATALOG: DecorSpec[] = [
  { kind: 'bench', name: 'Bench', group: 'Amenities', cost: 150, appeal: 2, swatch: '#8a6a48', radius: 1 },
  { kind: 'picnic', name: 'Picnic table', group: 'Amenities', cost: 220, appeal: 3, swatch: '#9b7a52', radius: 1.3 },
  { kind: 'ballwasher', name: 'Ball washer', group: 'Amenities', cost: 90, appeal: 1, swatch: '#2f4a35', radius: 0.5 },
  { kind: 'teesign', name: 'Hole sign', group: 'Amenities', cost: 60, appeal: 1, swatch: '#e6dfcf', radius: 0.5 },
  { kind: 'lamp', name: 'Lamp post', group: 'Amenities', cost: 110, appeal: 1, swatch: '#3a3f44', radius: 0.4 },
  { kind: 'bin', name: 'Litter bin', group: 'Amenities', cost: 40, appeal: 1, swatch: '#55703d', radius: 0.4 },
  { kind: 'flowerbed', name: 'Flower bed', group: 'Planting', cost: 120, appeal: 3, swatch: '#b8352c', radius: 1.4 },
  { kind: 'planter', name: 'Stone planter', group: 'Planting', cost: 140, appeal: 2, swatch: '#cfc8b6', radius: 0.8 },
  { kind: 'shrub', name: 'Shrub', group: 'Planting', cost: 50, appeal: 1, swatch: '#3c5338', radius: 0.8 },
  { kind: 'hedge', name: 'Hedge', group: 'Planting', cost: 90, appeal: 2, swatch: '#2c4430', radius: 1.6 },
  { kind: 'oak', name: 'Oak', group: 'Planting', cost: 200, appeal: 3, swatch: '#41583a', radius: 1.6 },
  { kind: 'spruce', name: 'Spruce', group: 'Planting', cost: 180, appeal: 2, swatch: '#1d2e22', radius: 1.2 },
  { kind: 'birch', name: 'Birch', group: 'Planting', cost: 190, appeal: 3, swatch: '#ece9e1', radius: 1 },
  { kind: 'rocks', name: 'Boulders', group: 'Planting', cost: 80, appeal: 1, swatch: '#8d9296', radius: 1.2 },
  { kind: 'flagpole', name: 'Club flag', group: 'Landmarks', cost: 300, appeal: 4, swatch: '#b0392e', radius: 0.6 },
  { kind: 'birdbath', name: 'Birdbath', group: 'Landmarks', cost: 260, appeal: 4, swatch: '#9fb2bd', radius: 0.7 },
  { kind: 'fountain', name: 'Fountain', group: 'Landmarks', cost: 2400, appeal: 18, swatch: '#2a425c', radius: 2.4 },
  { kind: 'gazebo', name: 'Gazebo', group: 'Landmarks', cost: 1800, appeal: 14, swatch: '#e6dfcf', radius: 2.6 },
  { kind: 'statue', name: 'Founder statue', group: 'Landmarks', cost: 1500, appeal: 12, swatch: '#a59f92', radius: 1.2 },
  { kind: 'clocktower', name: 'Clock tower', group: 'Landmarks', cost: 3200, appeal: 22, swatch: '#6d706a', radius: 2 },
]

export const DECOR_BY_KIND = Object.fromEntries(DECOR_CATALOG.map((d) => [d.kind, d])) as Record<
  DecorKind,
  DecorSpec
>

export const DECOR_MAX = 400
/** Fraction of the price returned when a decoration is removed */
export const DECOR_REFUND = 0.5

export interface Decoration {
  id: number
  kind: DecorKind
  /** World position (Three.js units, same space as the course scene) */
  x: number
  y: number
  z: number
  /** Yaw in radians */
  rot: number
}

export type DecorTool = DecorKind | 'remove'

export interface DecorModeState {
  tool: DecorTool
  rot: number
}

export function totalAppeal(decor: Decoration[]): number {
  return decor.reduce((s, d) => s + (DECOR_BY_KIND[d.kind]?.appeal ?? 0), 0)
}

/** Weekly fee bonus from grounds appeal — diminishing returns so spamming benches doesn't pay */
export function decorWeeklyBonus(decor: Decoration[]): number {
  const a = totalAppeal(decor)
  return a <= 0 ? 0 : Math.round(38 * Math.sqrt(a))
}

export function isDecorKind(v: unknown): v is DecorKind {
  return typeof v === 'string' && v in DECOR_BY_KIND
}

export function normalizeDecor(raw: unknown): Decoration[] {
  if (!Array.isArray(raw)) return []
  const out: Decoration[] = []
  for (const r of raw) {
    const d = r as Partial<Decoration>
    if (!isDecorKind(d.kind)) continue
    const nums = [d.id, d.x, d.y, d.z, d.rot].map(Number)
    if (nums.some((n) => !Number.isFinite(n))) continue
    out.push({ id: nums[0], kind: d.kind, x: nums[1], y: nums[2], z: nums[3], rot: nums[4] })
    if (out.length >= DECOR_MAX) break
  }
  return out
}
