import { useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { Hole } from '../game/types'
import { TERRAIN_FROM_INDEX } from '../game/types'
import { ratingLabel } from '../game/rating'
import { ELEV_SCALE, HOLE_MESH_D, HOLE_MESH_W, mapToWorld } from './coords'
import { terrainColor } from './terrainColors'

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
}: {
  hole: Hole
  selected?: boolean
  onSelect: (id: number) => void
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
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Soft rim so parcels read as playable plots */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <ringGeometry args={[Math.max(HOLE_MESH_W, HOLE_MESH_D) * 0.52, Math.max(HOLE_MESH_W, HOLE_MESH_D) * 0.56, 48]} />
        <meshStandardMaterial
          color={selected ? '#f59e0b' : hole.kind === 'range' ? '#fbbf24' : '#0f766e'}
          transparent
          opacity={selected ? 0.55 : 0.28}
          roughness={1}
        />
      </mesh>

      {hole.buildStage === 'open' || hole.kind === 'range' ? (
        <Flag local={mesh.pinLocal} />
      ) : null}

      <Html position={[0, 2.4, HOLE_MESH_D * 0.55]} center distanceFactor={48} style={{ pointerEvents: 'none' }}>
        <div className="label3d">
          <strong>
            {hole.kind === 'range' ? hole.name : `#${hole.number} · Par ${hole.par}`}
          </strong>
          <span>{stageCopy(hole)}</span>
        </div>
      </Html>
    </group>
  )
}

function Flag({ local }: { local: { x: number; y: number; z: number } }) {
  return (
    <group position={[local.x, local.y, local.z]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 2.2, 6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>
      <mesh position={[0.35, 1.85, 0]} castShadow>
        <boxGeometry args={[0.7, 0.38, 0.04]} />
        <meshStandardMaterial color="#dc2626" roughness={0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.35, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={1} />
      </mesh>
    </group>
  )
}

function buildHeightmap(hole: Hole) {
  const step = hole.width > 60 ? 2 : 1
  const cols = Math.floor((hole.width - 1) / step) + 1
  const rows = Math.floor((hole.height - 1) / step) + 1
  const sx = HOLE_MESH_W / (hole.width - 1)
  const sz = HOLE_MESH_D / (hole.height - 1)

  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const gx = Math.min(hole.width - 1, cx * step)
      const gy = Math.min(hole.height - 1, ry * step)
      const i = gy * hole.width + gx
      const elev = hole.elevation[i]
      const t = hole.terrain[i]
      const isWater = TERRAIN_FROM_INDEX[t] === 'water'
      const y = isWater ? elev * ELEV_SCALE * 0.35 - 0.15 : elev * ELEV_SCALE
      const lx = (gx - (hole.width - 1) / 2) * sx
      const lz = (gy - (hole.height - 1) / 2) * sz
      positions.push(lx, y, lz)

      // Simple slope shade
      const eL = hole.elevation[gy * hole.width + Math.max(0, gx - 1)]
      const eR = hole.elevation[gy * hole.width + Math.min(hole.width - 1, gx + 1)]
      const shade = 0.85 + (eL - eR) * 0.45
      const [r, g, b] = terrainColor(t, Math.max(0.55, Math.min(1.15, shade)))
      colors.push(r, g, b)
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
        <meshStandardMaterial color="#f59e0b" transparent opacity={0.22} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[6.2, 6.6, 32]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.7} />
      </mesh>
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
