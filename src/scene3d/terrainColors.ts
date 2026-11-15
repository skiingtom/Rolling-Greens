import { TERRAIN_FROM_INDEX, type TerrainType } from '../game/types'

/**
 * Painted-course palette — muted sage and olive greens, chalky paths,
 * white sand, and deep slate water, lifted from a gouache aerial study.
 */
export const TERRAIN_RGB: Record<TerrainType, [number, number, number]> = {
  rough: [0.33, 0.43, 0.24],
  fairway: [0.45, 0.56, 0.32],
  green: [0.5, 0.64, 0.36],
  bunker: [0.93, 0.92, 0.87],
  water: [0.16, 0.26, 0.36],
  tee: [0.5, 0.6, 0.36],
  path: [0.8, 0.79, 0.74],
}

/** Dark collar mown around greens, as in the painting's green edge */
export const COLLAR_RGB: [number, number, number] = [0.28, 0.37, 0.2]

export function terrainColor(index: number, shade = 1): [number, number, number] {
  const t = TERRAIN_FROM_INDEX[index] ?? 'rough'
  const [r, g, b] = TERRAIN_RGB[t]
  return [r * shade, g * shade, b * shade]
}

export const MEADOW = '#55703d'
export const MEADOW_RGB: [number, number, number] = [0.33, 0.43, 0.24]
export const ROAD = '#c4c1b6'
export const PLAZA = '#d5d1c5'
export const WATER = '#2a425c'
export const HAZE = '#8fa07a'
export const CONIFER_DARK = '#16251b'
export const CONIFER_MID = '#26392a'
export const CONIFER_TIP = '#3c5338'

/** Painted figure palette: mostly red and white shirts, slate trousers */
export const SHIRTS = ['#b8352c', '#ece9e1', '#b8352c', '#e3e0d6', '#5d6d7e', '#ece9e1', '#9c2f28']
export const PANTS = ['#3a3f44', '#56595a', '#b9b3a2', '#2d3238']
export const SKINS = ['#e2b48f', '#c1906a', '#eac3a1', '#a8754f']

export const CART_BODY = '#b4332b'
export const CART_ROOF = '#eeebe2'

// —— Small deterministic value-noise helpers for painterly mottling ——

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function smooth(t: number) {
  return t * t * (3 - 2 * t)
}

export function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const a = hash2(ix, iy)
  const b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1)
  const d = hash2(ix + 1, iy + 1)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/** 0..1 fractal noise */
export function fbm(x: number, y: number, octaves = 4): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let f = 1
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * f, y * f) * amp
    norm += amp
    amp *= 0.5
    f *= 2.03
  }
  return sum / norm
}

/** Mottle a color in world space — broad tonal patches like loose brushwork */
export function mottle(
  rgb: [number, number, number],
  wx: number,
  wz: number,
  amount = 1,
): [number, number, number] {
  const broad = fbm(wx * 0.035, wz * 0.035, 3) - 0.5
  const fine = fbm(wx * 0.22 + 31, wz * 0.22 - 7, 2) - 0.5
  const k = 1 + (broad * 0.28 + fine * 0.08) * amount
  // Warm/cool drift: lighter patches lean yellow, darker lean blue-green
  const drift = broad * 0.04 * amount
  return [rgb[0] * k + drift, rgb[1] * k + drift * 0.5, rgb[2] * k - drift * 0.6]
}
