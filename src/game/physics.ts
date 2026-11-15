import { sampleElevation, sampleTerrain } from './terrain'
import type { Hole, Point } from './types'

export interface BallState {
  x: number
  y: number
  vx: number
  vy: number
  moving: boolean
  sunk: boolean
  water: boolean
}

const FRICTION: Record<string, number> = {
  green: 0.985,
  fairway: 0.972,
  tee: 0.975,
  rough: 0.94,
  bunker: 0.88,
  path: 0.96,
  water: 0.5,
}

export function createBall(hole: Hole): BallState {
  return {
    x: hole.tee.x + 0.5,
    y: hole.tee.y + 0.5,
    vx: 0,
    vy: 0,
    moving: false,
    sunk: false,
    water: false,
  }
}

export function strike(ball: BallState, angle: number, power: number): BallState {
  const speed = power * 0.42
  return {
    ...ball,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    moving: true,
    sunk: false,
    water: false,
  }
}

export function stepBall(ball: BallState, hole: Hole, dt = 1): BallState {
  if (!ball.moving || ball.sunk || ball.water) return ball

  let { x, y, vx, vy } = ball

  // Slope influence from elevation gradient
  const e = sampleElevation(hole, x, y)
  const ex = sampleElevation(hole, x + 0.4, y)
  const ey = sampleElevation(hole, x, y + 0.4)
  const slopeX = (e - ex) * 0.045
  const slopeY = (e - ey) * 0.045
  vx += slopeX * dt
  vy += slopeY * dt

  x += vx * dt
  y += vy * dt

  // Soft bounds
  if (x < 0.5) {
    x = 0.5
    vx *= -0.4
  }
  if (y < 0.5) {
    y = 0.5
    vy *= -0.4
  }
  if (x > hole.width - 0.5) {
    x = hole.width - 0.5
    vx *= -0.4
  }
  if (y > hole.height - 0.5) {
    y = hole.height - 0.5
    vy *= -0.4
  }

  const terrain = sampleTerrain(hole, x, y)
  if (terrain === 'water') {
    return { x, y, vx: 0, vy: 0, moving: false, sunk: false, water: true }
  }

  const friction = FRICTION[terrain] ?? 0.95
  vx *= friction
  vy *= friction

  const speed = Math.hypot(vx, vy)

  // Cup capture when slow and near pin
  const distPin = Math.hypot(x - (hole.pin.x + 0.5), y - (hole.pin.y + 0.5))
  if (distPin < 0.55 && speed < 0.55) {
    return {
      x: hole.pin.x + 0.5,
      y: hole.pin.y + 0.5,
      vx: 0,
      vy: 0,
      moving: false,
      sunk: true,
      water: false,
    }
  }
  // Soft magnet near cup
  if (distPin < 1.1 && speed < 1.2) {
    vx += ((hole.pin.x + 0.5 - x) / distPin) * 0.04
    vy += ((hole.pin.y + 0.5 - y) / distPin) * 0.04
  }

  if (speed < 0.035) {
    return { x, y, vx: 0, vy: 0, moving: false, sunk: false, water: false }
  }

  return { x, y, vx, vy, moving: true, sunk: false, water: false }
}

export function aimPoint(from: Point, to: Point): { angle: number; power: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  return {
    angle: Math.atan2(dy, dx),
    power: Math.min(14, dist * 0.85),
  }
}
