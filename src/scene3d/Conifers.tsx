import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CONIFER_DARK, CONIFER_MID, CONIFER_TIP } from './terrainColors'

export type ConiferSpec = { x: number; z: number; y?: number; scale: number; variant: number }

function paintGeometry(g: THREE.BufferGeometry, color: THREE.Color, jitter: number, seed: number) {
  const n = g.getAttribute('position').count
  const colors = new Float32Array(n * 3)
  const pos = g.getAttribute('position')
  let s = seed
  for (let i = 0; i < n; i++) {
    s = (s * 16807) % 2147483647
    const r = (s / 2147483647 - 0.5) * jitter
    // Tips catch a touch more light than the boughs underneath
    const lift = 1 + Math.max(0, pos.getY(i)) * 0.02
    colors[i * 3] = color.r * (1 + r) * lift
    colors[i * 3 + 1] = color.g * (1 + r) * lift
    colors[i * 3 + 2] = color.b * (1 + r) * lift
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

/** One tall, narrow spruce: stacked ragged cones on a short trunk. Unit height ≈ 1. */
function buildSpruce(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const dark = new THREE.Color(CONIFER_DARK)
  const mid = new THREE.Color(CONIFER_MID)
  const tip = new THREE.Color(CONIFER_TIP)

  const trunk = new THREE.CylinderGeometry(0.018, 0.026, 0.16, 5).toNonIndexed()
  trunk.translate(0, 0.08, 0)
  parts.push(paintGeometry(trunk, new THREE.Color('#2b2219'), 0.1, 3))

  const tiers = 5
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1)
    const radius = 0.2 * (1 - t * 0.72)
    const height = 0.34 * (1 - t * 0.35)
    const y = 0.1 + t * 0.66 + height / 2
    const cone = new THREE.ConeGeometry(radius, height, 7, 1, true).toNonIndexed()
    // Ragged hem: pull alternating rim vertices in and down
    const p = cone.getAttribute('position')
    for (let v = 0; v < p.count; v++) {
      if (p.getY(v) < -height / 2 + 0.001) {
        const ang = Math.atan2(p.getZ(v), p.getX(v))
        const k = 0.82 + 0.18 * Math.abs(Math.sin(ang * 3.5 + i))
        p.setX(v, p.getX(v) * k)
        p.setZ(v, p.getZ(v) * k)
        p.setY(v, p.getY(v) - (1 - k) * 0.12)
      }
    }
    cone.rotateY(i * 0.9)
    cone.translate(0, y, 0)
    const c = dark.clone().lerp(i < 2 ? mid : tip, t * 0.9)
    parts.push(paintGeometry(cone, c, 0.16, 11 + i * 7))
  }
  const merged = mergeGeometries(parts, false)!
  merged.computeVertexNormals()
  return merged
}

/** A rounder broadleaf clump for variety near the clubhouse */
function buildBroadleaf(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const trunk = new THREE.CylinderGeometry(0.03, 0.045, 0.3, 5).toNonIndexed()
  trunk.translate(0, 0.15, 0)
  parts.push(paintGeometry(trunk, new THREE.Color('#33281c'), 0.1, 5))
  const blobs: [number, number, number, number][] = [
    [0, 0.5, 0, 0.27],
    [0.13, 0.42, 0.06, 0.19],
    [-0.12, 0.44, -0.05, 0.2],
    [0.02, 0.66, -0.03, 0.18],
  ]
  blobs.forEach(([x, y, z, r], i) => {
    const g = new THREE.IcosahedronGeometry(r, 1).toNonIndexed()
    g.translate(x, y, z)
    parts.push(paintGeometry(g, new THREE.Color(i === 3 ? '#41583a' : '#2c4430'), 0.18, 17 + i))
  })
  const merged = mergeGeometries(parts, false)!
  merged.computeVertexNormals()
  return merged
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()
const _c = new THREE.Color()

function Forest({
  specs,
  geometry,
  heightFor,
  widthFor,
}: {
  specs: ConiferSpec[]
  geometry: THREE.BufferGeometry
  heightFor: (t: ConiferSpec) => number
  widthFor: (t: ConiferSpec) => number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    specs.forEach((t, i) => {
      const h = heightFor(t)
      const w = widthFor(t)
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (t.variant * 1.7 + i) % (Math.PI * 2))
      _p.set(t.x, t.y ?? 0, t.z)
      _s.set(w, h, w)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
      const tone = 0.86 + ((i * 37) % 23) / 23 * 0.3
      _c.setRGB(tone, tone * (0.98 + (t.variant % 3) * 0.02), tone)
      mesh.setColorAt(i, _c)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [specs, heightFor, widthFor])

  if (specs.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, specs.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  )
}

const spruceHeight = (t: ConiferSpec) => (5.5 + t.scale * 3.2) * (0.9 + (t.variant % 3) * 0.08)
const spruceWidth = (t: ConiferSpec) => spruceHeight(t) * (0.78 + (t.variant % 2) * 0.12)
const leafHeight = (t: ConiferSpec) => 3.2 + t.scale * 1.6
const leafWidth = (t: ConiferSpec) => leafHeight(t) * 1.05

/** Instanced stands of dark spruce (plus a few broadleaf clumps). */
export function Conifers({ trees, broadleafEvery = 0 }: { trees: ConiferSpec[]; broadleafEvery?: number }) {
  const spruceGeo = useMemo(() => buildSpruce(), [])
  const leafGeo = useMemo(() => buildBroadleaf(), [])
  const [spruce, leaf] = useMemo(() => {
    if (!broadleafEvery) return [trees, [] as ConiferSpec[]]
    const a: ConiferSpec[] = []
    const b: ConiferSpec[] = []
    trees.forEach((t, i) => (i % broadleafEvery === 0 ? b : a).push(t))
    return [a, b]
  }, [trees, broadleafEvery])

  return (
    <group>
      <Forest specs={spruce} geometry={spruceGeo} heightFor={spruceHeight} widthFor={spruceWidth} />
      <Forest specs={leaf} geometry={leafGeo} heightFor={leafHeight} widthFor={leafWidth} />
    </group>
  )
}
