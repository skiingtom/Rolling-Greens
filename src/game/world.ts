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
      detail: 'Shape land north of the road for the opening hole of North Links.',
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
