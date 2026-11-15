import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { Hole } from '../game/types'
import { TERRAIN_FROM_INDEX } from '../game/types'
import { ratingLabel } from '../game/rating'
import { ELEV_SCALE, HOLE_MESH_D, HOLE_MESH_W, mapToWorld } from './coords'
import { COLLAR_RGB, MEADOW_RGB, mottle, terrainColor } from './terrainColors'

function stageCopy(hole: Hole): string {
  if (hole.kind === 'range') {
    return hole.rating !== null
      ? `${hole.rating} · ${ratingLabel(hole.rating, 'range')}`
      : 'Open for guests'
  }
  if (hole.rating !== null) return `${hole.rating} · ${ratingLabel(hole.rating, 'hole')}`
  if (hole.buildStage === 'raw') return 'Raw land'
  if (hole.buildStage === 'terraformed') return 'Terraforming'
  if (hole.buildStage === 'built') return 'Ready to open'
  return hole.name
}

export type EditPhase = 'down' | 'move' | 'up'

export interface HoleEditHandlers {
  /** Brush stroke or placement at a fractional grid cell */
  onEdit: (phase: EditPhase, cellX: number, cellY: number) => void
  /** Brush radius in grid cells; 0 shows a placement pin instead of a ring */
  brushCells: number
}

export function HoleMesh({
  hole,
  selected,
  onSelect,
  hideLabel = false,
  edit,
}: {
  hole: Hole
  selected?: boolean
  onSelect: (id: number) => void
  hideLabel?: boolean
  /** When set, this hole is being built live: drag to sculpt/paint, click to place */
  edit?: HoleEditHandlers
}) {
  const { x, z } = mapToWorld(hole.mapX, hole.mapY)
  // Build at full resolution while editing so the brush lands precisely
  const editing = !!edit
  const mesh = useMemo(() => buildHeightmap(hole, editing ? { step: 1 } : {}), [hole, editing])
  useEffect(() => () => mesh.geo.dispose(), [mesh])

  const stroking = useRef(false)
  const cursor = useRef<THREE.Group>(null)
  const sx = HOLE_MESH_W / (hole.width - 1)
  const sz = HOLE_MESH_D / (hole.height - 1)

  const toCell = (p: THREE.Vector3) => ({
    cx: Math.max(0, Math.min(hole.width - 1, (p.x - x) / sx + (hole.width - 1) / 2)),
    cy: Math.max(0, Math.min(hole.height - 1, (p.z - z) / sz + (hole.height - 1) / 2)),
  })

  const moveCursor = (p: THREE.Vector3 | null) => {
    const c = cursor.current
    if (!c) return
    c.visible = !!p
    if (p) c.position.set(p.x - x, p.y + 0.12, p.z - z)
  }

  const ringR = edit ? Math.max(0.4, edit.brushCells * sx) : 1

  return (
    <group position={[x, 0, z]}>
      <mesh
        geometry={mesh.geo}
        receiveShadow
        castShadow
        onClick={(e) => {
          e.stopPropagation()
          if (!edit) onSelect(hole.id)
        }}
        onPointerDown={(e) => {
          if (!edit || e.button !== 0) return
          e.stopPropagation()
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          stroking.current = true
          const { cx, cy } = toCell(e.point)
          edit.onEdit('down', cx, cy)
        }}
        onPointerMove={(e) => {
          if (!edit) return
          e.stopPropagation()
          moveCursor(e.point)
          if (stroking.current) {
            const { cx, cy } = toCell(e.point)
            edit.onEdit('move', cx, cy)
          }
        }}
        onPointerUp={(e) => {
          if (!edit || !stroking.current) return
          stroking.current = false
          ;(e.target as Element).releasePointerCapture?.(e.pointerId)
          const { cx, cy } = toCell(e.point)
          edit.onEdit('up', cx, cy)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = edit ? 'crosshair' : 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
          moveCursor(null)
        }}
      >
        <meshLambertMaterial vertexColors />
      </mesh>

      {edit && (
        <group ref={cursor} visible={false}>
          {edit.brushCells > 0 ? (
            <>
              <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
                <ringGeometry args={[ringR * 0.86, ringR, 48]} />
                <meshBasicMaterial color="#f3eee2" transparent opacity={0.85} depthTest={false} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
                <circleGeometry args={[ringR * 0.86, 48]} />
                <meshBasicMaterial color="#f3eee2" transparent opacity={0.12} depthTest={false} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 0.5, 0]} renderOrder={10}>
              <coneGeometry args={[0.35, 1, 10]} />
              <meshBasicMaterial color="#b0392e" transparent opacity={0.8} depthTest={false} />
            </mesh>
          )}
        </group>
      )}

      {/* Chalk survey line around the plot being built */}
      {(selected || edit) && <PlotOutline />}

      {hole.buildStage === 'open' || hole.kind === 'range' || edit ? (
        <Flag local={mesh.pinLocal} />
      ) : null}
      {edit && <TeeMarker local={mesh.teeLocal} />}

      {!hideLabel && !edit && (
        <Html position={[0, 2.4, HOLE_MESH_D * 0.55]} center distanceFactor={48} style={{ pointerEvents: 'none' }}>
          <div className="label3d">
            <strong>
              {hole.kind === 'range' ? hole.name : `#${hole.number} · Par ${hole.par}`}
            </strong>
            <span>{stageCopy(hole)}</span>
          </div>
        </Html>
      )}
    </group>
  )
}

function PlotOutline() {
  const w = HOLE_MESH_W + 0.6
  const d = HOLE_MESH_D + 0.6
  const t = 0.16
  const strips: [number, number, number, number][] = [
    [0, -d / 2, w, t],
    [0, d / 2, w, t],
    [-w / 2, 0, t, d],
    [w / 2, 0, t, d],
  ]
  return (
    <group position={[0, 0.06, 0]}>
      {strips.map(([sx, sz, sw, sd], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[sx, 0, sz]}>
          <planeGeometry args={[sw, sd]} />
          <meshBasicMaterial color="#efe6cf" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function TeeMarker({ local }: { local: { x: number; y: number; z: number } }) {
  return (
    <group position={[local.x, local.y, local.z]}>
      {[-0.45, 0.45].map((ox) => (
        <mesh key={ox} position={[ox, 0.16, 0]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshLambertMaterial color="#ece9e1" />
        </mesh>
      ))}
    </group>
  )
}

function Flag({ local }: { local: { x: number; y: number; z: number } }) {
  return (
    <group position={[local.x, local.y, local.z]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 2.4, 6]} />
        <meshLambertMaterial color="#ece9e1" />
      </mesh>
      <mesh position={[0.32, 2.12, 0]} rotation={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.62, 0.36, 0.03]} />
        <meshLambertMaterial color="#b8352c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.22, 14]} />
        <meshBasicMaterial color="#1b2119" />
      </mesh>
    </group>
  )
}

export function buildHeightmap(
  hole: Hole,
  opts: { step?: number; feather?: boolean; worldX?: number; worldZ?: number } = {},
) {
  const step = opts.step ?? (hole.width > 60 ? 2 : 1)
  const doFeather = opts.feather ?? true
  const cols = Math.floor((hole.width - 1) / step) + 1
  const rows = Math.floor((hole.height - 1) / step) + 1
  const sx = HOLE_MESH_W / (hole.width - 1)
  const sz = HOLE_MESH_D / (hole.height - 1)
  const origin = opts.worldX !== undefined
    ? { x: opts.worldX, z: opts.worldZ ?? 0 }
    : mapToWorld(hole.mapX, hole.mapY)
  const W = hole.width
  const H = hole.height
  const terrAt = (x: number, y: number) =>
    TERRAIN_FROM_INDEX[hole.terrain[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))]]

  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const gx = Math.min(W - 1, cx * step)
      const gy = Math.min(H - 1, ry * step)
      const i = gy * W + gx
      const elev = hole.elevation[i]
      const t = hole.terrain[i]
      const kind = TERRAIN_FROM_INDEX[t]
      const isWater = kind === 'water'
      let y = isWater ? elev * ELEV_SCALE * 0.35 - 0.15 : elev * ELEV_SCALE
      // Feather the parcel edge down into the surrounding meadow
      const edge = Math.min(gx, gy, W - 1 - gx, H - 1 - gy)
      const featherCells = Math.max(3, Math.min(W, H) * 0.14)
      const feather = doFeather ? Math.min(1, edge / featherCells) : 1
      y = -0.25 + (y + 0.25) * (feather * feather * (3 - 2 * feather))
      const lx = (gx - (W - 1) / 2) * sx
      const lz = (gy - (H - 1) / 2) * sz
      positions.push(lx, y, lz)

      // Soft slope light — catches the low sun on the far side of rises
      const eL = hole.elevation[gy * W + Math.max(0, gx - 1)]
      const eR = hole.elevation[gy * W + Math.min(W - 1, gx + 1)]
      const eU = hole.elevation[Math.max(0, gy - 1) * W + gx]
      const eD = hole.elevation[Math.min(H - 1, gy + 1) * W + gx]
      const shade = Math.max(0.7, Math.min(1.18, 0.96 + (eL - eR) * 0.5 + (eU - eD) * 0.4))

      let base: [number, number, number]
      if (kind !== 'green' && kind !== 'water' && kind !== 'bunker' && hasNeighbor(terrAt, gx, gy, 'green', 1)) {
        base = COLLAR_RGB
      } else if (kind === 'rough' && hasNeighbor(terrAt, gx, gy, 'bunker', 1)) {
        base = [COLLAR_RGB[0] * 1.1, COLLAR_RGB[1] * 1.1, COLLAR_RGB[2] * 1.1]
      } else {
        base = terrainColor(t, 1)
      }
      // At the feathered rim, ease the colour back to plain meadow
      if (feather < 1 && !isWater) {
        const k = 1 - feather
        base = [
          base[0] + (MEADOW_RGB[0] - base[0]) * k,
          base[1] + (MEADOW_RGB[1] - base[1]) * k,
          base[2] + (MEADOW_RGB[2] - base[2]) * k,
        ]
      }
      const amt = kind === 'bunker' ? 0.25 : kind === 'green' ? 0.55 : kind === 'water' ? 0.4 : 1
      const [r, g, b] = mottle(base, origin.x + lx, origin.z + lz, amt)
      // Greens glow a little, like the pale highlight in the painting
      const glow = kind === 'green' ? 1.04 : 1
      colors.push(r * shade * glow, g * shade * glow, b * shade * glow)
    }
  }

  for (let ry = 0; ry < rows - 1; ry++) {
    for (let cx = 0; cx < cols - 1; cx++) {
      const a = ry * cols + cx
      const b = a + 1
      const c = a + cols
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  const pinLocal = {
    x: (hole.pin.x - (hole.width - 1) / 2) * sx,
    y: hole.elevation[hole.pin.y * hole.width + hole.pin.x] * ELEV_SCALE + 0.05,
    z: (hole.pin.y - (hole.height - 1) / 2) * sz,
  }

  const teeLocal = {
    x: (hole.tee.x - (hole.width - 1) / 2) * sx,
    y: hole.elevation[hole.tee.y * hole.width + hole.tee.x] * ELEV_SCALE + 0.05,
    z: (hole.tee.y - (hole.height - 1) / 2) * sz,
  }

  return { geo, pinLocal, teeLocal }
}

function hasNeighbor(
  terrAt: (x: number, y: number) => string | undefined,
  x: number,
  y: number,
  kind: string,
  r: number,
) {
  for (let oy = -r; oy <= r; oy++) {
    for (let ox = -r; ox <= r; ox++) {
      if ((ox || oy) && terrAt(x + ox, y + oy) === kind) return true
    }
  }
  return false
}

export function sampleHoleSurface(
  hole: Hole,
  cellX: number,
  cellY: number,
): { x: number; y: number; z: number } {
  const sx = HOLE_MESH_W / (hole.width - 1)
  const sz = HOLE_MESH_D / (hole.height - 1)
  const gx = Math.max(0, Math.min(hole.width - 1, Math.round(cellX)))
  const gy = Math.max(0, Math.min(hole.height - 1, Math.round(cellY)))
  const elev = hole.elevation[gy * hole.width + gx]
  return {
    x: (gx - (hole.width - 1) / 2) * sx,
    y: elev * ELEV_SCALE + 0.08,
    z: (gy - (hole.height - 1) / 2) * sz,
  }
}

export function ClaimPlot({
  mapX,
  mapY,
  label,
  cost,
  onClaim,
}: {
  mapX: number
  mapY: number
  label: string
  cost: number
  onClaim: () => void
}) {
  const { x, z } = mapToWorld(mapX, mapY)
  return (
    <group position={[x, 0.05, z]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onClaim()
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <planeGeometry args={[14, 10]} />
        <meshBasicMaterial color="#e8dcb4" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[6.2, 6.45, 40]} />
        <meshBasicMaterial color="#efe6cf" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* Survey stakes with red ribbons at each corner */}
      {[
        [-7, -5],
        [7, -5],
        [-7, 5],
        [7, 5],
      ].map(([sx, sz]) => (
        <group key={`${sx},${sz}`} position={[sx, 0, sz]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 1, 5]} />
            <meshLambertMaterial color="#d9cfb8" />
          </mesh>
          <mesh position={[0.12, 0.92, 0]} castShadow>
            <boxGeometry args={[0.24, 0.1, 0.02]} />
            <meshLambertMaterial color="#b8352c" />
          </mesh>
        </group>
      ))}
      <Html center distanceFactor={42} position={[0, 1.8, 0]} style={{ pointerEvents: 'none' }}>
        <div className="label3d label3d--claim">
          <span>New plot</span>
          <strong>{label}</strong>
          <em>${cost.toLocaleString()}</em>
        </div>
      </Html>
    </group>
  )
}
