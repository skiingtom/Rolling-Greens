import type { CourseId, Point } from './types'
import { WORLD_H, WORLD_W } from './types'

/** Clubhouse sits beside the county road */
export const CLUBHOUSE = { x: 1680, y: 1280, w: 160, h: 110 }

/** Road centerline waypoints (gentle S-curve across the map) */
export const ROAD_PATH: Point[] = [
  { x: -80, y: 1420 },
  { x: 600, y: 1380 },
  { x: 1200, y: 1340 },
  { x: 1680, y: 1360 },
  { x: 2200, y: 1390 },
  { x: 2800, y: 1330 },
  { x: 3400, y: 1300 },
  { x: 4000, y: 1340 },
  { x: WORLD_W + 80, y: 1380 },
]

/** Starter range east of the clubhouse; large range expands further east */
export const RANGE_SLOTS = {
  starter: { x: 1980, y: 1080 },
  large: { x: 1980, y: 980 },
}

/**
 * Hole parcel positions — Course A loops north of the road,
 * Course B loops south. Arranged so the map feels like two
 * full routings radiating from the clubhouse.
 */
export function holeMapPosition(courseId: CourseId, number: number): Point {
  if (courseId === 'a') {
    // North Links — arc / loop above the road
    const i = number - 1
    const col = i % 6
    const row = Math.floor(i / 6)
    return {
      x: 980 + col * 420 + (row % 2) * 80,
      y: 280 + row * 280,
    }
  }
  // South Parkland — below the road
  const i = number - 1
  const col = i % 6
  const row = Math.floor(i / 6)
  return {
    x: 980 + col * 420 + ((row + 1) % 2) * 70,
    y: 1680 + row * 280,
  }
}

export function nextBuildTarget(holeCount: number): {
  courseId: CourseId
  number: number
  phase: 'nine' | 'eighteen' | 'second-nine' | 'second-eighteen' | 'complete'
} | null {
  if (holeCount >= 36) return null
  if (holeCount < 9) {
    return { courseId: 'a', number: holeCount + 1, phase: 'nine' }
  }
  if (holeCount < 18) {
    return { courseId: 'a', number: holeCount + 1, phase: 'eighteen' }
  }
  if (holeCount < 27) {
    return { courseId: 'b', number: holeCount - 18 + 1, phase: 'second-nine' }
  }
  return { courseId: 'b', number: holeCount - 18 + 1, phase: 'second-eighteen' }
}

export function phaseCopy(holeCount: number): { title: string; detail: string } {
  if (holeCount === 0) {
    return {
      title: 'Claim your first acreage',
      detail: 'Buy raw land north of the road, then terraform and build Hole 1 from scratch.',
    }
  }
  if (holeCount < 9) {
    return {
      title: `North Links · Hole ${holeCount + 1} of 9`,
      detail: 'Keep shaping the front nine along the northern meadows.',
    }
  }
  if (holeCount === 9) {
    return {
      title: 'Front nine complete',
      detail: 'Push east and finish an 18-hole championship routing.',
    }
  }
  if (holeCount < 18) {
    return {
      title: `North Links · Hole ${holeCount + 1} of 18`,
      detail: 'Close out the first full eighteen.',
    }
  }
  if (holeCount === 18) {
    return {
      title: 'Championship eighteen open',
      detail: 'Break ground south of the road for South Parkland — your second course.',
    }
  }
  if (holeCount < 27) {
    return {
      title: `South Parkland · Hole ${holeCount - 18 + 1} of 9`,
      detail: 'A second front nine for resort play.',
    }
  }
  if (holeCount < 36) {
    return {
      title: `South Parkland · Hole ${holeCount - 18 + 1} of 18`,
      detail: 'Finish 36 holes — two working eighteens.',
    }
  }
  return {
    title: 'Resort complete',
    detail: 'Two 18-hole courses online. Expand the driving range if you haven’t.',
  }
}

export function defaultPar(courseHoleNumber: number): 3 | 4 | 5 {
  const n = ((courseHoleNumber - 1) % 9) + 1
  if (n === 3 || n === 8) return 3
  if (n === 5 || n === 9) return 5
  return 4
}

/** Soft field patches for endless atmosphere (decorative) */
export function fieldPatches(seed = 1): { x: number; y: number; w: number; h: number; tone: number }[] {
  const patches = []
  let s = seed * 9973
  const rand = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  for (let i = 0; i < 48; i++) {
    patches.push({
      x: rand() * WORLD_W,
      y: rand() * WORLD_H,
      w: 180 + rand() * 420,
      h: 120 + rand() * 280,
      tone: 0.35 + rand() * 0.45,
    })
  }
  return patches
}

export type TreeSpec = { x: number; y: number; scale: number; variant: number }

/** Dense canopy for a Planet Zoo–style park */
export function parkTrees(seed = 3): TreeSpec[] {
  const trees: TreeSpec[] = []
  let s = seed * 7919
  const rand = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }

  // Landmark groves around the clubhouse / range so the start view feels lush
  const groves = [
    { cx: CLUBHOUSE.x - 240, cy: CLUBHOUSE.y - 90, n: 36, r: 190 },
    { cx: CLUBHOUSE.x + 300, cy: CLUBHOUSE.y - 50, n: 32, r: 175 },
    { cx: CLUBHOUSE.x - 60, cy: CLUBHOUSE.y - 240, n: 28, r: 160 },
    { cx: CLUBHOUSE.x + 120, cy: CLUBHOUSE.y + 90, n: 18, r: 110 },
    { cx: 2100, cy: 1000, n: 38, r: 200 },
    { cx: 1500, cy: 1050, n: 26, r: 150 },
    { cx: 2300, cy: 1180, n: 22, r: 140 },
  ]
  for (const g of groves) {
    for (let i = 0; i < g.n; i++) {
      const a = rand() * Math.PI * 2
      const d = 35 + rand() * g.r
      trees.push({
        x: g.cx + Math.cos(a) * d,
        y: g.cy + Math.sin(a) * d * 0.65,
        scale: 0.95 + rand() * 1.25,
        variant: Math.floor(rand() * 5),
      })
    }
  }

  for (let i = 0; i < 420; i++) {
    const x = rand() * WORLD_W
    const y = rand() * WORLD_H
    // Keep clear of the road band and immediate plaza pad
    if (y > 1260 && y < 1440) continue
    if (Math.hypot(x - CLUBHOUSE.x, y - CLUBHOUSE.y) < 100) continue
    if (x > 1950 && x < 2350 && y > 1040 && y < 1220 && rand() > 0.2) continue
    trees.push({
      x,
      y,
      scale: 0.6 + rand() * 1.15,
      variant: Math.floor(rand() * 5),
    })
  }
  return trees
}

export type GuestSpec = { x: number; y: number; hue: number; delay: number; span: number }

/** Guests ambling the plaza / range path — Planet Zoo park life */
export function parkGuests(seed = 17): GuestSpec[] {
  const guests: GuestSpec[] = []
  let s = seed * 6151
  const rand = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  const lanes = [
    { x0: CLUBHOUSE.x - 40, y0: CLUBHOUSE.y + 70, x1: 1980, y1: 1140 },
    { x0: CLUBHOUSE.x + 20, y0: CLUBHOUSE.y + 100, x1: CLUBHOUSE.x - 80, y1: CLUBHOUSE.y + 160 },
    { x0: 1720, y0: 1320, x1: 1900, y1: 1180 },
    { x0: 1880, y0: 1200, x1: 2100, y1: 1120 },
  ]
  for (let i = 0; i < 14; i++) {
    const lane = lanes[i % lanes.length]
    guests.push({
      x: lane.x0 + (lane.x1 - lane.x0) * rand(),
      y: lane.y0 + (lane.y1 - lane.y0) * rand(),
      hue: Math.floor(rand() * 360),
      delay: rand() * 8,
      span: 18 + rand() * 36,
    })
  }
  return guests
}

export type BushSpec = { x: number; y: number; scale: number }

export function parkBushes(seed = 11): BushSpec[] {
  const bushes: BushSpec[] = []
  let s = seed * 4243
  const rand = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  for (let i = 0; i < 180; i++) {
    const x = rand() * WORLD_W
    const y = rand() * WORLD_H
    if (y > 1240 && y < 1460) continue
    if (Math.hypot(x - CLUBHOUSE.x, y - CLUBHOUSE.y) < 180) continue
    bushes.push({ x, y, scale: 0.5 + rand() * 0.8 })
  }
  return bushes
}

/** Decorative ponds for park atmosphere */
export function parkPonds(_seed = 19): { x: number; y: number; w: number; h: number }[] {
  void _seed
  return [
    { x: 1320, y: 1080, w: 160, h: 70 },
    { x: 2480, y: 1600, w: 200, h: 90 },
    { x: 720, y: 600, w: 140, h: 60 },
    { x: 3100, y: 900, w: 180, h: 75 },
  ]
}

/** Plaza path from road up to clubhouse / range */
export const PLAZA_PATH = [
  { x: CLUBHOUSE.x, y: 1380 },
  { x: CLUBHOUSE.x, y: CLUBHOUSE.y + 40 },
  { x: 1980, y: 1180 },
]
