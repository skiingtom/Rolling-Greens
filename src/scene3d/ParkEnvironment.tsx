import { useMemo } from 'react'
import * as THREE from 'three'
import { Cloud, Sky } from '@react-three/drei'
import {
  CLUBHOUSE,
  PLAZA_PATH,
  ROAD_PATH,
  parkBushes,
  parkPonds,
  parkTrees,
} from '../game/world'
import { MAP_SCALE, PARK_D, PARK_W, mapToWorld } from './coords'
import { MEADOW, ROAD, WATER } from './terrainColors'

export function ParkEnvironment({ cartCount }: { cartCount: number }) {
  const trees = useMemo(() => parkTrees(5).slice(0, 280), [])
  const bushes = useMemo(() => parkBushes(9).slice(0, 100), [])
  const ponds = useMemo(() => parkPonds(), [])
  const roadPts = useMemo(
    () => ROAD_PATH.map((p) => mapToWorld(p.x, p.y)),
    [],
  )
  const plazaPts = useMemo(
    () => PLAZA_PATH.map((p) => mapToWorld(p.x, p.y)),
    [],
  )
  const club = mapToWorld(CLUBHOUSE.x, CLUBHOUSE.y)

  return (
    <group>
      <Sky
        distance={450000}
        sunPosition={[80, 45, 30]}
        inclination={0.48}
        azimuth={0.22}
        turbidity={3.2}
        rayleigh={1.4}
      />
      <fog attach="fog" args={['#cfe6f4', 120, 420]} />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#dbeafe', '#3f6212', 0.55]} />
      <directionalLight
        castShadow
        intensity={1.35}
        position={[70, 90, 40]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-camera-near={1}
        shadow-camera-far={320}
      />

      {/* Base meadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[PARK_W + 40, PARK_D + 40, 64, 40]} />
        <meshStandardMaterial color={MEADOW} roughness={0.95} metalness={0} />
      </mesh>

      {/* Soft rolling hills via displaced patches */}
      <HillPatches />

      <RoadRibbon points={roadPts} width={3.2} color={ROAD} />
      <RoadRibbon points={plazaPts} width={2.2} color="#8b7355" />

      {ponds.map((p, i) => {
        const c = mapToWorld(p.x + p.w / 2, p.y + p.h / 2)
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[c.x, 0.06, c.z]} receiveShadow>
            <circleGeometry args={[Math.max(p.w, p.h) / MAP_SCALE / 1.6, 28]} />
            <meshStandardMaterial color={WATER} roughness={0.15} metalness={0.25} transparent opacity={0.92} />
          </mesh>
        )
      })}

      {trees.map((t, i) => {
        const p = mapToWorld(t.x, t.y)
        return <Tree key={i} x={p.x} z={p.z} scale={t.scale} variant={t.variant} />
      })}
      {bushes.map((b, i) => {
        const p = mapToWorld(b.x, b.y)
        return (
          <mesh key={`b${i}`} position={[p.x, 0.35 * b.scale, p.z]} castShadow>
            <sphereGeometry args={[0.55 * b.scale, 8, 6]} />
            <meshStandardMaterial color="#3f7a34" roughness={0.9} />
          </mesh>
        )
      })}

      <Clubhouse3D x={club.x} z={club.z} cartCount={cartCount} />

      <Cloud position={[-40, 38, -50]} opacity={0.35} speed={0.15} segments={12} />
      <Cloud position={[55, 42, 20]} opacity={0.28} speed={0.1} segments={10} />
      <Cloud position={[10, 48, -80]} opacity={0.3} speed={0.12} segments={14} />
    </group>
  )
}

function HillPatches() {
  const patches = useMemo(() => {
    const out: { x: number; z: number; r: number; h: number; c: string }[] = []
    let s = 42
    const rand = () => {
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    }
    for (let i = 0; i < 36; i++) {
      out.push({
        x: (rand() - 0.5) * PARK_W * 0.9,
        z: (rand() - 0.5) * PARK_D * 0.9,
        r: 8 + rand() * 18,
        h: 0.4 + rand() * 1.8,
        c: rand() > 0.5 ? '#45853c' : '#3d7a38',
      })
    }
    return out
  }, [])
  return (
    <group>
      {patches.map((p, i) => (
        <mesh key={i} position={[p.x, p.h * 0.35, p.z]} castShadow receiveShadow>
          <sphereGeometry args={[p.r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={p.c} roughness={0.96} />
        </mesh>
      ))}
    </group>
  )
}

function RoadRibbon({
  points,
  width,
  color,
}: {
  points: { x: number; z: number }[]
  width: number
  color: string
}) {
  const geo = useMemo(() => {
    if (points.length < 2) return null
    const shape = new THREE.Shape()
    const hw = width / 2
    // Build a simple extruded strip along polyline
    const left: THREE.Vector2[] = []
    const right: THREE.Vector2[] = []
    for (let i = 0; i < points.length; i++) {
      const prev = points[Math.max(0, i - 1)]
      const next = points[Math.min(points.length - 1, i + 1)]
      const dx = next.x - prev.x
      const dz = next.z - prev.z
      const len = Math.hypot(dx, dz) || 1
      const nx = -dz / len
      const nz = dx / len
      left.push(new THREE.Vector2(points[i].x + nx * hw, points[i].z + nz * hw))
      right.push(new THREE.Vector2(points[i].x - nx * hw, points[i].z - nz * hw))
    }
    shape.moveTo(left[0].x, left[0].y)
    for (let i = 1; i < left.length; i++) shape.lineTo(left[i].x, left[i].y)
    for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i].x, right[i].y)
    shape.closePath()
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    return g
  }, [points, width])

  if (!geo) return null
  return (
    <mesh geometry={geo} position={[0, 0.08, 0]} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  )
}

function Tree({ x, z, scale, variant }: { x: number; z: number; scale: number; variant: number }) {
  const s = 0.7 + scale * 0.55
  const trunkH = 1.4 * s
  const canopy = 1.1 + (variant % 3) * 0.25
  const color = variant % 5 === 0 ? '#2f6b2a' : variant % 5 === 1 ? '#3d8f36' : '#356f30'
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, trunkH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12 * s, 0.18 * s, trunkH, 6]} />
        <meshStandardMaterial color="#5c3a1e" roughness={0.95} />
      </mesh>
      <mesh position={[0, trunkH + canopy * 0.4, 0]} castShadow>
        <sphereGeometry args={[canopy * s * 0.85, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {variant % 2 === 0 && (
        <mesh position={[0.35 * s, trunkH + canopy * 0.15, -0.2 * s]} castShadow>
          <sphereGeometry args={[canopy * s * 0.55, 8, 6]} />
          <meshStandardMaterial color="#2a5c26" roughness={0.92} />
        </mesh>
      )}
    </group>
  )
}

function Clubhouse3D({ x, z, cartCount }: { x: number; z: number; cartCount: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[9, 2.8, 6.5]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.85} />
      </mesh>
      <mesh position={[0, 3.35, 0]} castShadow>
        <coneGeometry args={[6.2, 2.2, 4]} />
        <meshStandardMaterial color="#8b4518" roughness={0.8} />
      </mesh>
      <mesh position={[-3.2, 1.1, 3.4]} castShadow>
        <boxGeometry args={[2.4, 2.2, 1.6]} />
        <meshStandardMaterial color="#d6c4a8" roughness={0.85} />
      </mesh>
      <mesh position={[3.4, 1.0, 3.2]} castShadow>
        <boxGeometry args={[2.8, 2, 1.8]} />
        <meshStandardMaterial color="#d2c0a4" roughness={0.85} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.85, 3.3]}>
        <boxGeometry args={[1.1, 1.7, 0.12]} />
        <meshStandardMaterial color="#5c3d2e" />
      </mesh>
      {/* Windows */}
      {[-2.2, 2.2].map((wx) => (
        <mesh key={wx} position={[wx, 1.5, 3.28]}>
          <boxGeometry args={[1.1, 0.9, 0.08]} />
          <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={0.15} />
        </mesh>
      ))}
      {/* Awning */}
      <mesh position={[0, 1.9, 3.7]} castShadow>
        <boxGeometry args={[4.5, 0.12, 1.4]} />
        <meshStandardMaterial color="#0f766e" />
      </mesh>
      {/* Cart barn */}
      {cartCount > 0 && (
        <group position={[8.5, 0, 2]}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <boxGeometry args={[4.5, 2.2, 3.2]} />
            <meshStandardMaterial color="#64748b" roughness={0.7} />
          </mesh>
          <mesh position={[0, 2.4, 0]}>
            <boxGeometry args={[4.8, 0.25, 3.5]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      )}
    </group>
  )
}
