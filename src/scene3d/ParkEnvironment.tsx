import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Hole } from '../game/types'
import {
  CLUBHOUSE,
  PLAZA_PATH,
  ROAD_PATH,
  parkBushes,
  parkPonds,
  parkTrees,
} from '../game/world'
import { HOLE_MESH_D, HOLE_MESH_W, MAP_SCALE, PARK_D, PARK_W, mapToWorld } from './coords'
import { Conifers, type ConiferSpec } from './Conifers'
import { BLOCKER_FLAG, GROUND_FLAG } from './DecorLayer'
import { HAZE, MEADOW_RGB, PLAZA, ROAD, WATER, fbm, mottle } from './terrainColors'

/** Sun direction shared by every painted scene: low, from the far side, so shadows rake toward the viewer. */
export const SUN_DIR = new THREE.Vector3(0.62, 0.5, -0.6).normalize()

export function PaintedLighting({
  extent = 120,
  mapSize = 2048,
  center = [0, 0, 0],
  follow = false,
}: {
  extent?: number
  mapSize?: number
  center?: [number, number, number]
  /** Keep the shadow frustum centred on the orbit target as the player pans */
  follow?: boolean
}) {
  const dist = extent * 1.4
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  const [cx, cy, cz] = center

  const place = (x: number, y: number, z: number) => {
    // Snap to a coarse grid so shadows don't shimmer while panning
    const sx = Math.round(x / 4) * 4
    const sz = Math.round(z / 4) * 4
    target.position.set(sx, y, sz)
    target.updateMatrixWorld()
    light.current?.position.set(sx + SUN_DIR.x * dist, y + SUN_DIR.y * dist, sz + SUN_DIR.z * dist)
  }

  useLayoutEffect(() => {
    place(cx, cy, cz)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cx, cy, cz, dist])

  useFrame(({ controls }) => {
    if (!follow) return
    const t = (controls as unknown as { target?: THREE.Vector3 } | null)?.target
    if (t) place(t.x, 0, t.z)
  })

  return (
    <group>
      <primitive object={target} />
      <hemisphereLight args={['#b9c9cf', '#2c3a22', 0.85]} />
      <ambientLight color="#93a39a" intensity={0.22} />
      <directionalLight
        ref={light}
        castShadow
        color="#fff3dc"
        intensity={2.7}
        target={target}
        position={[cx + SUN_DIR.x * dist, cy + SUN_DIR.y * dist, cz + SUN_DIR.z * dist]}
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent * 0.8}
        shadow-camera-bottom={-extent * 0.8}
        shadow-camera-near={1}
        shadow-camera-far={dist * 2.2}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
      />
    </group>
  )
}

function insideAnyHole(x: number, z: number, holes: Hole[], pad: number) {
  for (const h of holes) {
    const c = mapToWorld(h.mapX, h.mapY)
    if (Math.abs(x - c.x) < HOLE_MESH_W / 2 + pad && Math.abs(z - c.z) < HOLE_MESH_D / 2 + pad) {
      return true
    }
  }
  return false
}

export function ParkEnvironment({
  cartCount,
  holes,
  reserved = [],
}: {
  cartCount: number
  holes: Hole[]
  reserved?: { x: number; z: number }[]
}) {
  const club = mapToWorld(CLUBHOUSE.x, CLUBHOUSE.y)
  const roadPts = useMemo(() => smoothPath(ROAD_PATH.map((p) => mapToWorld(p.x, p.y))), [])
  const plazaPts = useMemo(() => smoothPath(PLAZA_PATH.map((p) => mapToWorld(p.x, p.y))), [])
  const ponds = useMemo(() => parkPonds(), [])

  const holeKey = holes.map((h) => `${h.id}:${h.mapX}:${h.mapY}`).join('|')
  const trees = useMemo<ConiferSpec[]>(() => {
    const out: ConiferSpec[] = []
    for (const t of parkTrees(5)) {
      const p = mapToWorld(t.x, t.y)
      if (insideAnyHole(p.x, p.z, holes, 2.5)) continue
      if (reserved.some((r) => Math.abs(p.x - r.x) < 9 && Math.abs(p.z - r.z) < 7)) continue
      if (Math.hypot(p.x - club.x, p.z - club.z) < 14) continue
      if (distToPath(p, roadPts) < 3.4 || distToPath(p, plazaPts) < 2.4) continue
      out.push({ x: p.x, z: p.z, scale: t.scale, variant: t.variant })
      if (out.length >= 420) break
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeKey, roadPts, plazaPts, club.x, club.z, reserved.map((r) => `${r.x},${r.z}`).join()])

  const shrubs = useMemo<ConiferSpec[]>(() => {
    return parkBushes(9)
      .slice(0, 120)
      .map((b) => {
        const p = mapToWorld(b.x, b.y)
        return { x: p.x, z: p.z, scale: b.scale * 0.35, variant: 1 }
      })
      .filter((b) => !insideAnyHole(b.x, b.z, holes, 1) && distToPath(b, roadPts) > 2.6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeKey, roadPts])

  return (
    <group>
      <color attach="background" args={[HAZE]} />
      <fog attach="fog" args={[HAZE, 150, 430]} />
      <PaintedLighting center={[club.x, 0, club.z]} follow />

      <MeadowGround />

      <PathRibbon points={roadPts} width={3.6} color={ROAD} y={0.07} />
      <PathRibbon points={plazaPts} width={2.3} color={PLAZA} y={0.09} />

      {ponds.map((p, i) => {
        const c = mapToWorld(p.x + p.w / 2, p.y + p.h / 2)
        return <Pond key={i} x={c.x} z={c.z} r={Math.max(p.w, p.h) / MAP_SCALE / 1.6} seed={i} />
      })}

      <Conifers trees={trees} broadleafEvery={9} />
      <Conifers trees={shrubs} broadleafEvery={1} />

      <Clubhouse3D x={club.x} z={club.z} cartCount={cartCount} />
    </group>
  )
}

/** Base ground: gently undulating and mottled like loosely laid-in paint. */
function MeadowGround() {
  const geo = useMemo(() => {
    const w = PARK_W + 120
    const d = PARK_D + 120
    const g = new THREE.PlaneGeometry(w, d, 180, 110)
    g.rotateX(-Math.PI / 2)
    const pos = g.getAttribute('position')
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      // Undulate only downward so raised hole parcels always sit on top
      const swell = fbm(x * 0.02 + 5, z * 0.02 - 3, 3)
      pos.setY(i, -0.15 - swell * 0.9)
      const [r, gg, b] = mottle(MEADOW_RGB, x, z, 1.7)
      // Lighter, sunlit crowns on swells
      const k = 0.92 + (1 - swell) * 0.16
      colors[i * 3] = r * k
      colors[i * 3 + 1] = gg * k
      colors[i * 3 + 2] = b * k
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geo} receiveShadow userData={GROUND_FLAG}>
      <meshLambertMaterial vertexColors />
    </mesh>
  )
}

function Pond({ x, z, r, seed }: { x: number; z: number; r: number; seed: number }) {
  const [water, bank] = useMemo(() => {
    const make = (scale: number) => {
      const shape = new THREE.Shape()
      const n = 40
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2
        const k = 0.78 + fbm(Math.cos(a) * 1.4 + seed * 3.1, Math.sin(a) * 1.4 + seed, 2) * 0.5
        const px = Math.cos(a) * r * k * scale * 1.15
        const pz = Math.sin(a) * r * k * scale * 0.85
        if (i === 0) shape.moveTo(px, pz)
        else shape.lineTo(px, pz)
      }
      const g = new THREE.ShapeGeometry(shape)
      g.rotateX(Math.PI / 2)
      return g
    }
    return [make(1), make(1.12)]
  }, [r, seed])
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={bank} position={[0, 0.03, 0]} receiveShadow>
        <meshLambertMaterial color="#3e5631" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={water} position={[0, 0.06, 0]} receiveShadow>
        <meshPhongMaterial
          color={WATER}
          specular="#b8c8d0"
          shininess={40}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function smoothPath(points: { x: number; z: number }[]): { x: number; z: number }[] {
  if (points.length < 3) return points
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p.x, 0, p.z)),
    false,
    'centripetal',
  )
  return curve.getPoints(points.length * 10).map((v) => ({ x: v.x, z: v.z }))
}

function distToPath(p: { x: number; z: number }, path: { x: number; z: number }[]) {
  let best = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2))
    const d = Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t))
    if (d < best) best = d
  }
  return best
}

/** Soft-edged cart path ribbon: a pale core with a slightly darker worn shoulder. */
function PathRibbon({
  points,
  width,
  color,
  y,
}: {
  points: { x: number; z: number }[]
  width: number
  color: string
  y: number
}) {
  const geos = useMemo(() => {
    if (points.length < 2) return null
    const strip = (w: number) => {
      const positions: number[] = []
      const indices: number[] = []
      for (let i = 0; i < points.length; i++) {
        const prev = points[Math.max(0, i - 1)]
        const next = points[Math.min(points.length - 1, i + 1)]
        const dx = next.x - prev.x
        const dz = next.z - prev.z
        const len = Math.hypot(dx, dz) || 1
        const nx = -dz / len
        const nz = dx / len
        // Slight width breathing so the edge reads hand-painted
        const hw = (w / 2) * (0.92 + fbm(points[i].x * 0.15, points[i].z * 0.15, 2) * 0.16)
        positions.push(points[i].x + nx * hw, 0, points[i].z + nz * hw)
        positions.push(points[i].x - nx * hw, 0, points[i].z - nz * hw)
        if (i > 0) {
          const a = (i - 1) * 2
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      g.setIndex(indices)
      g.computeVertexNormals()
      return g
    }
    return { core: strip(width), shoulder: strip(width * 1.22) }
  }, [points, width])

  if (!geos) return null
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geos.shoulder} receiveShadow userData={GROUND_FLAG}>
        <meshLambertMaterial color="#8e9177" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geos.core} position={[0, 0.01, 0]} receiveShadow userData={GROUND_FLAG}>
        <meshLambertMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Clubhouse3D({ x, z, cartCount }: { x: number; z: number; cartCount: number }) {
  const wall = '#e6dfcf'
  const roof = '#6d706a'
  const trim = '#24342a'
  return (
    <group position={[x, 0, z]}>
      <group userData={BLOCKER_FLAG}>
        <mesh position={[0, 1.6, 0.4]} visible={false}>
          <boxGeometry args={[18.5, 3.2, 7.5]} />
          <meshBasicMaterial />
        </mesh>
        {cartCount > 0 && (
          <mesh position={[12, 1.3, 1.5]} visible={false}>
            <boxGeometry args={[5.4, 2.6, 4]} />
            <meshBasicMaterial />
          </mesh>
        )}
      </group>
      {/* Gravel forecourt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 5.8]} receiveShadow userData={GROUND_FLAG}>
        <circleGeometry args={[6.5, 36]} />
        <meshLambertMaterial color={PLAZA} />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 3, 6.5]} />
        <meshLambertMaterial color={wall} />
      </mesh>
      {/* Hipped roof */}
      <mesh position={[0, 3.75, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 1]} castShadow>
        <coneGeometry args={[7.4, 2.6, 4]} />
        <meshLambertMaterial color={roof} />
      </mesh>
      {/* Wings */}
      <mesh position={[-6.8, 1.2, 0.8]} castShadow receiveShadow>
        <boxGeometry args={[4, 2.4, 5]} />
        <meshLambertMaterial color={wall} />
      </mesh>
      <mesh position={[-6.8, 2.75, 0.8]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[3.4, 1.4, 4]} />
        <meshLambertMaterial color={roof} />
      </mesh>
      <mesh position={[6.6, 1.1, 0.6]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 2.2, 4.6]} />
        <meshLambertMaterial color={wall} />
      </mesh>
      <mesh position={[6.6, 2.55, 0.6]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[3.1, 1.3, 4]} />
        <meshLambertMaterial color={roof} />
      </mesh>
      {/* Door + windows */}
      <mesh position={[0, 0.95, 3.28]}>
        <boxGeometry args={[1.2, 1.9, 0.1]} />
        <meshLambertMaterial color={trim} />
      </mesh>
      {[-3.2, -1.7, 1.7, 3.2].map((wx) => (
        <mesh key={wx} position={[wx, 1.7, 3.28]}>
          <boxGeometry args={[0.9, 1.1, 0.08]} />
          <meshLambertMaterial color="#5f7480" emissive="#2a3a44" emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* Deep green awning */}
      <mesh position={[0, 2.25, 3.9]} rotation={[0.25, 0, 0]} castShadow>
        <boxGeometry args={[5, 0.12, 1.5]} />
        <meshLambertMaterial color={trim} />
      </mesh>
      {/* Cart barn */}
      {cartCount > 0 && (
        <group position={[12, 0, 1.5]}>
          <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[5, 2.3, 3.6]} />
            <meshLambertMaterial color="#cfc8b6" />
          </mesh>
          <mesh position={[0, 2.5, 0]} castShadow>
            <boxGeometry args={[5.4, 0.25, 4]} />
            <meshLambertMaterial color={roof} />
          </mesh>
        </group>
      )}
    </group>
  )
}
