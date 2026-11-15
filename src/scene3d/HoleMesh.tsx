import { useMemo } from 'react'
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

export function HoleMesh({
  hole,
  selected,
  onSelect,
  hideLabel = false,
}: {
  hole: Hole
  selected?: boolean
  onSelect: (id: number) => void
  hideLabel?: boolean
}) {
  const { x, z } = mapToWorld(hole.mapX, hole.mapY)
  const mesh = useMemo(() => buildHeightmap(hole), [hole])

  return (
    <group position={[x, 0, z]}>
      <mesh
        geometry={mesh.geo}
        receiveShadow
        castShadow
        onClick={(e) => {
          e.stopPropagation()
          onSelect(hole.id)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <meshLambertMaterial vertexColors />
      </mesh>

      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[Math.max(HOLE_MESH_W, HOLE_MESH_D) * 0.52, Math.max(HOLE_MESH_W, HOLE_MESH_D) * 0.55, 48]} />
          <meshBasicMaterial color="#efe6cf" transparent opacity={0.5} />
        </mesh>
      )}

      {hole.buildStage === 'open' || hole.kind === 'range' ? (
        <Flag local={mesh.pinLocal} />
      ) : null}

      {!hideLabel && (
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
