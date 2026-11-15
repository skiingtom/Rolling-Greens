import { countTerrain, yardage } from './terrain'
import { PAR_TARGETS, type Hole } from './types'

function elevationRange(hole: Hole): number {
  let minE = 1
  let maxE = 0
  for (let i = 0; i < hole.elevation.length; i++) {
    const e = hole.elevation[i]
    minE = Math.min(minE, e)
    maxE = Math.max(maxE, e)
  }
  return maxE - minE
}

function rateDrivingRange(hole: Hole): number {
  const green = countTerrain(hole, 'green')
  const tee = countTerrain(hole, 'tee')
  const fairway = countTerrain(hole, 'fairway')
  const bunker = countTerrain(hole, 'bunker')
  const yards = yardage(hole)

  let score = 45

  // Bay space
  if (tee >= 20) score += 12
  else if (tee >= 8) score += 7
  else if (tee > 0) score += 3

  // Landing strip
  if (fairway >= 120) score += 14
  else if (fairway >= 50) score += 8
  else if (fairway >= 15) score += 4

  // Multiple target greens
  if (green >= 40) score += 14
  else if (green >= 20) score += 9
  else if (green > 0) score += 4

  if (bunker > 5 && bunker < 80) score += 6

  // Long enough to practice drivers
  if (yards >= 280) score += 10
  else if (yards >= 180) score += 5

  const er = elevationRange(hole)
  if (er > 0.08 && er < 0.45) score += 6

  const pinOnGreen =
    hole.terrain[hole.pin.y * hole.width + hole.pin.x] === 2
  const teeOnTee = hole.terrain[hole.tee.y * hole.width + hole.tee.x] === 5
  if (pinOnGreen) score += 5
  if (teeOnTee) score += 4

  return Math.max(1, Math.min(100, Math.round(score)))
}

/**
 * Rates a layout 1–100. Driving ranges score on bays, landing strip, and targets;
 * holes score on layout coherence vs par.
 */
export function rateHole(hole: Hole): number {
  if (hole.kind === 'range') return rateDrivingRange(hole)

  const yards = yardage(hole)
  const target = PAR_TARGETS[hole.par]
  const green = countTerrain(hole, 'green')
  const tee = countTerrain(hole, 'tee')
  const fairway = countTerrain(hole, 'fairway')
  const bunker = countTerrain(hole, 'bunker')
  const water = countTerrain(hole, 'water')
  const total = hole.width * hole.height

  let score = 40

  if (tee >= 4) score += 8
  else if (tee > 0) score += 3
  if (green >= 20 && green <= 90) score += 14
  else if (green > 0) score += 6

  if (fairway >= 40) score += 12
  else if (fairway >= 15) score += 6

  const hazardRatio = (bunker + water) / total
  if (hazardRatio > 0.02 && hazardRatio < 0.12) score += 10
  else if (hazardRatio > 0 && hazardRatio < 0.2) score += 4
  else if (hazardRatio >= 0.2) score -= 8

  if (yards >= target.min && yards <= target.max) score += 14
  else if (yards >= target.min * 0.75 && yards <= target.max * 1.2) score += 6
  else score -= 6

  const er = elevationRange(hole)
  if (er > 0.12 && er < 0.55) score += 8
  else if (er > 0.05) score += 3

  const pinOnGreen =
    hole.terrain[hole.pin.y * hole.width + hole.pin.x] === 2
  const teeOnTee = hole.terrain[hole.tee.y * hole.width + hole.tee.x] === 5
  if (pinOnGreen) score += 6
  if (teeOnTee) score += 4

  const dist = Math.hypot(hole.pin.x - hole.tee.x, hole.pin.y - hole.tee.y)
  if (dist < 8) score -= 15

  return Math.max(1, Math.min(100, Math.round(score)))
}

export function ratingLabel(rating: number, kind: Hole['kind'] = 'hole'): string {
  if (kind === 'range') {
    if (rating >= 90) return 'Tour warm-up'
    if (rating >= 80) return 'Busy bays'
    if (rating >= 70) return 'Local favorite'
    if (rating >= 55) return 'Solid range'
    if (rating >= 40) return 'Needs nets'
    return 'Weedy mats'
  }
  if (rating >= 90) return 'Signature'
  if (rating >= 80) return 'Championship'
  if (rating >= 70) return 'Club favorite'
  if (rating >= 55) return 'Solid'
  if (rating >= 40) return 'Needs work'
  return 'Rough draft'
}

export function prizeForRating(rating: number, kind: Hole['kind'] = 'hole'): number {
  const scale = kind === 'range' ? 0.65 : 1
  if (rating >= 90) return Math.round(2800 * scale)
  if (rating >= 80) return Math.round(1600 * scale)
  if (rating >= 70) return Math.round(900 * scale)
  if (rating >= 55) return Math.round(400 * scale)
  return Math.round(100 * scale)
}
