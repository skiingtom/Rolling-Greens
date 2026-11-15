export type TerrainType =
  | 'rough'
  | 'fairway'
  | 'green'
  | 'bunker'
  | 'water'
  | 'tee'
  | 'path'

export type SculptMode = 'raise' | 'lower' | 'smooth' | 'flatten'
export type PaintTool = TerrainType | 'erase'
export type EditorTool = 'sculpt' | 'paint' | 'tee' | 'pin' | 'path'

export type Screen = 'landing' | 'course' | 'editor' | 'playtest'

export type LayoutKind = 'range' | 'hole'
export type CourseId = 'a' | 'b'
export type RangeSize = 'starter' | 'large'
/** Construction progress on a claimed plot */
export type BuildStage = 'raw' | 'terraformed' | 'built' | 'open'

export interface Point {
  x: number
  y: number
}

export interface Hole {
  id: number
  kind: LayoutKind
  /** Course assignment; null for the driving range */
  courseId: CourseId | null
  /** 1–18 within a course; 0 for range */
  number: number
  name: string
  par: 3 | 4 | 5
  width: number
  height: number
  elevation: Float32Array
  terrain: Uint8Array
  tee: Point
  pin: Point
  designed: boolean
  buildStage: BuildStage
  rating: number | null
  playCount: number
  bestScore: number | null
  /** Position on the grounds map (world px) */
  mapX: number
  mapY: number
}

export interface CourseInfo {
  id: CourseId
  name: string
  /** Target hole count for this routing (always 18) */
  capacity: 18
}

export const COURSES: CourseInfo[] = [
  { id: 'a', name: 'North Links', capacity: 18 },
  { id: 'b', name: 'South Parkland', capacity: 18 },
]

export const MAX_HOLES = 36
export const STARTING_BUDGET = 2800

export const RANGE_UPGRADE_COST = 12000

export const TERRAIN_INDEX: Record<TerrainType, number> = {
  rough: 0,
  fairway: 1,
  green: 2,
  bunker: 3,
  water: 4,
  tee: 5,
  path: 6,
}

export const TERRAIN_FROM_INDEX: TerrainType[] = [
  'rough',
  'fairway',
  'green',
  'bunker',
  'water',
  'tee',
  'path',
]

export const TERRAIN_COST: Record<TerrainType, number> = {
  rough: 0,
  fairway: 4,
  green: 14,
  bunker: 10,
  water: 12,
  tee: 12,
  path: 3,
}

export const SCULPT_COST = 2

export const GRID_W = 72
export const GRID_H = 48

export const PAR_TARGETS: Record<3 | 4 | 5, { min: number; max: number }> = {
  3: { min: 120, max: 220 },
  4: { min: 280, max: 450 },
  5: { min: 460, max: 600 },
}

export const YARDS_PER_CELL = 8

/** World map extent — large enough to feel open when panning */
export const WORLD_W = 4800
export const WORLD_H = 2800

export function nextHoleCost(totalHoles: number): number {
  // Early holes cheaper; second eighteen costs more
  const base = 2000 + totalHoles * 380
  if (totalHoles >= 18) return Math.round(base * 1.35)
  if (totalHoles >= 9) return Math.round(base * 1.15)
  return base
}

export function milestoneLabel(holeCount: number, rangeSize: RangeSize): string {
  if (holeCount >= 36 && rangeSize === 'large') return 'Full resort — 36 holes & grand range'
  if (holeCount >= 36) return '36 holes open — expand the range'
  if (holeCount >= 27) return 'Building the back eighteen'
  if (holeCount >= 18) return 'Championship eighteen — start the second course'
  if (holeCount >= 9) return 'Front nine open — push toward 18'
  if (holeCount >= 1) return 'Shaping the first nine'
  return 'Driving range open — claim land for Hole 1'
}
