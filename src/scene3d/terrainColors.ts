import { TERRAIN_FROM_INDEX, type TerrainType } from '../game/types'

export const TERRAIN_RGB: Record<TerrainType, [number, number, number]> = {
  rough: [0.28, 0.48, 0.24],
  fairway: [0.38, 0.68, 0.32],
  green: [0.52, 0.78, 0.42],
  bunker: [0.86, 0.76, 0.52],
  water: [0.18, 0.48, 0.72],
  tee: [0.34, 0.62, 0.3],
  path: [0.62, 0.54, 0.4],
}

export function terrainColor(index: number, shade = 1): [number, number, number] {
  const t = TERRAIN_FROM_INDEX[index] ?? 'rough'
  const [r, g, b] = TERRAIN_RGB[t]
  return [r * shade, g * shade, b * shade]
}

export const MEADOW = '#4a8a42'
export const ROAD = '#3d3f45'
export const ROAD_LINE = '#c9c4a8'
export const WATER = '#2f7fba'
export const SKY_TOP = '#7ec8f0'
export const SKY_HORIZON = '#d4eef8'
