import { holeMapPosition, RANGE_SLOTS } from './world'
import {
  GRID_H,
  GRID_W,
  TERRAIN_FROM_INDEX,
  TERRAIN_INDEX,
  YARDS_PER_CELL,
  type CourseId,
  type Hole,
  type Point,
  type SculptMode,
  type TerrainType,
  type WaterMode,
} from './types'

export function idx(x: number, y: number, w = GRID_W): number {
  return y * w + x
}

export function inBounds(x: number, y: number, w = GRID_W, h = GRID_H): boolean {
  return x >= 0 && y >= 0 && x < w && y < h
}

function seedElevation(elevation: Float32Array, id: number, width: number, height: number) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n =
        0.42 +
        0.08 * Math.sin(x * 0.11 + id * 1.7) +
        0.06 * Math.cos(y * 0.09 + id) +
        0.04 * Math.sin((x + y) * 0.07)
      elevation[idx(x, y, width)] = clamp(n, 0.15, 0.85)
    }
  }
}

/** Claimed acreage: wild meadow — you terraform and build the hole from scratch. */
export function createBlankHole(
  id: number,
  courseId: CourseId,
  number: number,
  par: 3 | 4 | 5 = 4,
): Hole {
  const width = GRID_W
  const height = GRID_H
  const elevation = new Float32Array(width * height)
  const terrain = new Uint8Array(width * height)

  // Uneven raw land — bumps, hollows, no fairway yet
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n =
        0.38 +
        0.14 * Math.sin(x * 0.17 + id * 2.1) +
        0.12 * Math.cos(y * 0.13 + id * 0.7) +
        0.08 * Math.sin((x * y) * 0.004 + id) +
        0.05 * Math.cos((x - y) * 0.09)
      elevation[idx(x, y, width)] = clamp(n, 0.12, 0.88)
      terrain[idx(x, y, width)] = TERRAIN_INDEX.rough
    }
  }

  // Suggested markers only — nothing is built yet
  const tee: Point = { x: 8, y: Math.floor(height / 2) }
  const pin: Point = { x: width - 10, y: Math.floor(height / 2) }

  const pos = holeMapPosition(courseId, number)
  const courseLabel = courseId === 'a' ? 'North' : 'South'

  return {
    id,
    kind: 'hole',
    courseId,
    number,
    name: `${courseLabel} ${number}`,
    par,
    width,
    height,
    elevation,
    terrain,
    tee,
    pin,
    designed: false,
    buildStage: 'raw',
    rating: null,
    playCount: 0,
    bestScore: null,
    mapX: pos.x,
    mapY: pos.y,
  }
}

/** Starter property: driving range beside the clubhouse road. */
export function createDrivingRange(size: 'starter' | 'large' = 'starter'): Hole {
  const width = GRID_W
  const height = GRID_H
  const elevation = new Float32Array(width * height)
  const terrain = new Uint8Array(width * height)

  seedElevation(elevation, size === 'large' ? 99 : 0, width, height)
  terrain.fill(TERRAIN_INDEX.rough)

  for (let y = 4; y < height - 4; y++) {
    for (let x = 3; x < width - 3; x++) {
      const i = idx(x, y, width)
      elevation[i] = clamp(elevation[i] * 0.55 + 0.28, 0.2, 0.7)
    }
  }

  const fairwayStart = size === 'large' ? 10 : 14
  const fairwaySpread = size === 'large' ? 12 : 9
  for (let y = 8; y < height - 8; y++) {
    for (let x = fairwayStart; x < width - 6; x++) {
      const mid = height / 2
      const spread = fairwaySpread + (x - fairwayStart) * 0.05
      if (Math.abs(y - mid) < spread) {
        terrain[idx(x, y, width)] = TERRAIN_INDEX.fairway
      }
    }
  }

  const bays = size === 'large' ? 8 : 5
  for (let bay = 0; bay < bays; bay++) {
    const by = 8 + bay * (size === 'large' ? 4.5 : 6)
    const yi = Math.round(by)
    stampRect(terrain, 4, yi, 6, 3, TERRAIN_INDEX.tee, width, height)
    stampRect(terrain, 3, yi + 1, 2, 1, TERRAIN_INDEX.path, width, height)
  }

  stampCircle(terrain, 32, 24, 3, TERRAIN_INDEX.green, width, height)
  stampCircle(terrain, 46, 16, 3, TERRAIN_INDEX.green, width, height)
  stampCircle(terrain, 46, 32, 3, TERRAIN_INDEX.green, width, height)
  stampCircle(terrain, 58, 24, 4, TERRAIN_INDEX.green, width, height)
  if (size === 'large') {
    stampCircle(terrain, 40, 10, 2, TERRAIN_INDEX.green, width, height)
    stampCircle(terrain, 40, 38, 2, TERRAIN_INDEX.green, width, height)
    stampCircle(terrain, 66, 20, 3, TERRAIN_INDEX.green, width, height)
    stampCircle(terrain, 66, 28, 3, TERRAIN_INDEX.green, width, height)
  }

  stampCircle(terrain, 38, 11, 3, TERRAIN_INDEX.bunker, width, height)
  stampCircle(terrain, 38, 37, 3, TERRAIN_INDEX.bunker, width, height)

  const pos = RANGE_SLOTS[size]
  return {
    id: 0,
    kind: 'range',
    courseId: null,
    number: 0,
    name: size === 'large' ? 'Grand Driving Range' : 'Driving Range',
    par: 3,
    width,
    height,
    elevation,
    terrain,
    tee: { x: 7, y: 24 },
    pin: { x: size === 'large' ? 66 : 58, y: 24 },
    designed: true,
    buildStage: 'open',
    rating: null,
    playCount: 0,
    bestScore: null,
    mapX: pos.x,
    mapY: pos.y,
  }
}

/** Infer construction stage from what's on the plot */
export function inferBuildStage(hole: Hole): Hole['buildStage'] {
  if (hole.kind === 'range') return hole.rating !== null ? 'open' : 'built'
  if (hole.rating !== null) return 'open'
  let fairway = 0
  let green = 0
  let tee = 0
  for (let i = 0; i < hole.terrain.length; i++) {
    const t = hole.terrain[i]
    if (t === TERRAIN_INDEX.fairway) fairway++
    if (t === TERRAIN_INDEX.green) green++
    if (t === TERRAIN_INDEX.tee) tee++
  }
  if (fairway >= 20 && green >= 12 && tee >= 3) return 'built'
  if (fairway > 0 || green > 0 || tee > 0) return 'terraformed'
  // Any meaningful sculpt vs raw seed
  if (hole.designed) return 'terraformed'
  return 'raw'
}

/** Upgrade an existing range layout into the large footprint. */
export function expandRangeLayout(existing: Hole): Hole {
  const next = createDrivingRange('large')
  return {
    ...next,
    id: existing.id,
    playCount: existing.playCount,
    bestScore: existing.bestScore,
    rating: null,
    designed: true,
    buildStage: 'built',
  }
}

function stampRect(
  terrain: Uint8Array,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  type: number,
  w: number,
  h: number,
) {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      if (!inBounds(x, y, w, h)) continue
      terrain[idx(x, y, w)] = type
    }
  }
}

function stampCircle(
  terrain: Uint8Array,
  cx: number,
  cy: number,
  r: number,
  type: number,
  w: number,
  h: number,
) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, y, w, h)) continue
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        terrain[idx(x, y, w)] = type
      }
    }
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function brushCells(
  cx: number,
  cy: number,
  radius: number,
  w: number,
  h: number,
): Point[] {
  const cells: Point[] = []
  const r = Math.ceil(radius)
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, y, w, h)) continue
      const d = Math.hypot(x - cx, y - cy)
      if (d <= radius) cells.push({ x, y })
    }
  }
  return cells
}

export function sculpt(
  elevation: Float32Array,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  mode: SculptMode,
  w: number,
  h: number,
): number {
  const cells = brushCells(cx, cy, radius, w, h)
  let changed = 0

  if (mode === 'smooth') {
    for (const { x, y } of cells) {
      let sum = 0
      let n = 0
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!inBounds(x + ox, y + oy, w, h)) continue
          sum += elevation[idx(x + ox, y + oy, w)]
          n++
        }
      }
      const i = idx(x, y, w)
      const avg = sum / n
      const falloff = 1 - Math.hypot(x - cx, y - cy) / (radius + 0.001)
      const next = elevation[i] + (avg - elevation[i]) * strength * falloff
      if (Math.abs(next - elevation[i]) > 0.0005) changed++
      elevation[i] = clamp(next, 0, 1)
    }
    return changed
  }

  if (mode === 'flatten') {
    const center = elevation[idx(clamp(cx, 0, w - 1), clamp(cy, 0, h - 1), w)]
    for (const { x, y } of cells) {
      const i = idx(x, y, w)
      const falloff = 1 - Math.hypot(x - cx, y - cy) / (radius + 0.001)
      const next = elevation[i] + (center - elevation[i]) * strength * falloff
      if (Math.abs(next - elevation[i]) > 0.0005) changed++
      elevation[i] = clamp(next, 0, 1)
    }
    return changed
  }

  const dir = mode === 'raise' ? 1 : -1
  for (const { x, y } of cells) {
    const i = idx(x, y, w)
    const falloff = 1 - Math.hypot(x - cx, y - cy) / (radius + 0.001)
    const delta = dir * strength * falloff * 0.12
    const next = clamp(elevation[i] + delta, 0, 1)
    if (Math.abs(next - elevation[i]) > 0.0005) changed++
    elevation[i] = next
  }
  return changed
}

export function paint(
  terrain: Uint8Array,
  cx: number,
  cy: number,
  radius: number,
  type: TerrainType | 'erase',
  w: number,
  h: number,
): number {
  const cells = brushCells(cx, cy, radius, w, h)
  const value = type === 'erase' ? TERRAIN_INDEX.rough : TERRAIN_INDEX[type]
  let changed = 0
  for (const { x, y } of cells) {
    const i = idx(x, y, w)
    if (terrain[i] !== value) {
      terrain[i] = value
      changed++
    }
  }
  return changed
}

/**
 * Dig / fill water features: lowers a basin and paints water (or drains).
 * Pond/lake dig first so the hazard sits in a hollow; stream is a shallow channel.
 */
export function placeWaterFeature(
  elevation: Float32Array,
  terrain: Uint8Array,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  mode: WaterMode,
  w: number,
  h: number,
): { elevChanged: number; terrainChanged: number } {
  const gx = Math.floor(cx)
  const gy = Math.floor(cy)

  if (mode === 'fill') {
    return {
      elevChanged: 0,
      terrainChanged: paint(terrain, gx, gy, radius, 'water', w, h),
    }
  }

  if (mode === 'drain') {
    const cells = brushCells(gx, gy, radius, w, h)
    let terrainChanged = 0
    let elevChanged = 0
    for (const { x, y } of cells) {
      const i = idx(x, y, w)
      if (terrain[i] === TERRAIN_INDEX.water) {
        terrain[i] = TERRAIN_INDEX.rough
        terrainChanged++
      }
      const falloff = 1 - Math.hypot(x - gx, y - gy) / (radius + 0.001)
      const next = clamp(elevation[i] + strength * falloff * 0.05, 0, 1)
      if (Math.abs(next - elevation[i]) > 0.0005) elevChanged++
      elevation[i] = next
    }
    return { elevChanged, terrainChanged }
  }

  const digRadius =
    mode === 'lake' ? radius * 1.15 : mode === 'stream' ? radius * 0.72 : radius
  const digDepth =
    mode === 'lake' ? 0.12 : mode === 'stream' ? 0.055 : 0.09
  const waterRadius =
    mode === 'lake' ? radius * 0.92 : mode === 'stream' ? radius * 0.55 : radius * 0.78

  // Dig the basin / channel
  const digCells = brushCells(gx, gy, digRadius, w, h)
  let elevChanged = 0
  for (const { x, y } of digCells) {
    const i = idx(x, y, w)
    const falloff = 1 - Math.hypot(x - gx, y - gy) / (digRadius + 0.001)
    const next = clamp(elevation[i] - strength * falloff * digDepth, 0, 1)
    if (Math.abs(next - elevation[i]) > 0.0005) elevChanged++
    elevation[i] = next
  }

  // Soft shoreline: water in the core, leave fringe as existing turf
  const waterCells = brushCells(gx, gy, waterRadius, w, h)
  let terrainChanged = 0
  for (const { x, y } of waterCells) {
    const i = idx(x, y, w)
    const d = Math.hypot(x - gx, y - gy)
    // Keep a thin shore ring empty of water for ponds/lakes
    if (mode !== 'stream' && d > waterRadius * 0.88) continue
    if (terrain[i] === TERRAIN_INDEX.tee || terrain[i] === TERRAIN_INDEX.green) continue
    if (terrain[i] !== TERRAIN_INDEX.water) {
      terrain[i] = TERRAIN_INDEX.water
      terrainChanged++
    }
  }

  return { elevChanged, terrainChanged }
}

export function yardage(hole: Hole): number {
  const dx = (hole.pin.x - hole.tee.x) * YARDS_PER_CELL
  const dy = (hole.pin.y - hole.tee.y) * YARDS_PER_CELL
  return Math.round(Math.hypot(dx, dy))
}

export function countTerrain(hole: Hole, type: TerrainType): number {
  const t = TERRAIN_INDEX[type]
  let n = 0
  for (let i = 0; i < hole.terrain.length; i++) {
    if (hole.terrain[i] === t) n++
  }
  return n
}

export function sampleTerrain(hole: Hole, x: number, y: number): TerrainType {
  const gx = clamp(Math.floor(x), 0, hole.width - 1)
  const gy = clamp(Math.floor(y), 0, hole.height - 1)
  return TERRAIN_FROM_INDEX[hole.terrain[idx(gx, gy, hole.width)]] ?? 'rough'
}

export function sampleElevation(hole: Hole, x: number, y: number): number {
  const gx = clamp(x, 0, hole.width - 1)
  const gy = clamp(y, 0, hole.height - 1)
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const x1 = Math.min(x0 + 1, hole.width - 1)
  const y1 = Math.min(y0 + 1, hole.height - 1)
  const tx = gx - x0
  const ty = gy - y0
  const e00 = hole.elevation[idx(x0, y0, hole.width)]
  const e10 = hole.elevation[idx(x1, y0, hole.width)]
  const e01 = hole.elevation[idx(x0, y1, hole.width)]
  const e11 = hole.elevation[idx(x1, y1, hole.width)]
  return e00 * (1 - tx) * (1 - ty) + e10 * tx * (1 - ty) + e01 * (1 - tx) * ty + e11 * tx * ty
}

export function serializeHole(hole: Hole) {
  return {
    ...hole,
    elevation: Array.from(hole.elevation),
    terrain: Array.from(hole.terrain),
  }
}

export function deserializeHole(raw: ReturnType<typeof serializeHole>): Hole {
  const kind = raw.kind ?? (raw.id === 0 ? 'range' : 'hole')
  const hole: Hole = {
    ...raw,
    kind,
    courseId: raw.courseId ?? (kind === 'range' ? null : 'a'),
    number: raw.number ?? (kind === 'range' ? 0 : raw.id),
    mapX: raw.mapX ?? 0,
    mapY: raw.mapY ?? 0,
    elevation: Float32Array.from(raw.elevation),
    terrain: Uint8Array.from(raw.terrain),
    par: raw.par as 3 | 4 | 5,
    buildStage: raw.buildStage ?? 'raw',
  }
  if (!raw.buildStage) hole.buildStage = inferBuildStage(hole)
  return hole
}

/** Soft isometric shade from elevation neighbors */
export function shadeAt(elevation: Float32Array, x: number, y: number, w: number, h: number): number {
  const e = elevation[idx(x, y, w)]
  const er = inBounds(x + 1, y, w, h) ? elevation[idx(x + 1, y, w)] : e
  const ed = inBounds(x, y + 1, w, h) ? elevation[idx(x, y + 1, w)] : e
  const dx = er - e
  const dy = ed - e
  return clamp(0.55 + dx * 2.2 - dy * 1.4, 0.25, 1.15)
}
