import { WORLD_H, WORLD_W } from '../game/types'

/** Map pixels → Three.js units (X right, Z south, Y up) */
export const MAP_SCALE = 12

export const PARK_W = WORLD_W / MAP_SCALE
export const PARK_D = WORLD_H / MAP_SCALE

/** Vertical exaggeration for hole elevation (0–1 → meters-ish) */
export const ELEV_SCALE = 4.2

export function mapToWorld(mapX: number, mapY: number): { x: number; z: number } {
  return {
    x: mapX / MAP_SCALE - PARK_W / 2,
    z: mapY / MAP_SCALE - PARK_D / 2,
  }
}

export function worldToMap(x: number, z: number): { mapX: number; mapY: number } {
  return {
    mapX: (x + PARK_W / 2) * MAP_SCALE,
    mapY: (z + PARK_D / 2) * MAP_SCALE,
  }
}

/** Hole grid cell → local hole mesh coords (origin at parcel center) */
export function cellToLocal(
  cellX: number,
  cellY: number,
  holeW: number,
  holeH: number,
  elev: number,
): { x: number; y: number; z: number } {
  const sx = 28 / holeW
  const sz = 18 / holeH
  return {
    x: (cellX - holeW / 2) * sx,
    y: elev * ELEV_SCALE,
    z: (cellY - holeH / 2) * sz,
  }
}

export const HOLE_MESH_W = 28
export const HOLE_MESH_D = 18
