import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { DECOR_BY_KIND, type Decoration } from '../game/decor'
import { useGame } from '../game/store'
import { Conifers, type ConiferSpec } from './Conifers'
import { DecorModel } from './DecorModels'

/** Objects flagged with userData.ground are what decorations can be placed on. */
export const GROUND_FLAG = { ground: true }
/** Objects flagged with userData.blocker (buildings) can't have decorations dropped through them. */
export const BLOCKER_FLAG = { blocker: true }

function isBlocked(o: THREE.Object3D | null): boolean {
  for (let n = o; n; n = n.parent) if (n.userData.blocker) return true
  return false
}

const CLICK_SLOP = 6

function nearestDecor(decor: Decoration[], x: number, z: number): Decoration | null {
  let best: Decoration | null = null
  let bestD = Infinity
  for (const d of decor) {
    const dist = Math.hypot(d.x - x, d.z - z)
    if (dist < DECOR_BY_KIND[d.kind].radius + 0.6 && dist < bestD) {
      best = d
      bestD = dist
    }
  }
  return best
}

function blocked(decor: Decoration[], kind: Decoration['kind'], x: number, z: number) {
  const r = DECOR_BY_KIND[kind].radius
  return decor.some((d) => Math.hypot(d.x - x, d.z - z) < (r + DECOR_BY_KIND[d.kind].radius) * 0.6)
}

/** Placed decorations, plus the ghost preview and click handling while decorating. */
export function DecorLayer({ onMessage }: { onMessage?: (msg: string) => void }) {
  const decorations = useGame((s) => s.decorations)
  const mode = useGame((s) => s.decorMode)

  const { trees, oaks, props } = useMemo(() => {
    const trees: ConiferSpec[] = []
    const oaks: ConiferSpec[] = []
    const props: Decoration[] = []
    for (const d of decorations) {
      if (d.kind === 'spruce') trees.push({ x: d.x, y: d.y, z: d.z, scale: 1.2, variant: d.id % 5 })
      else if (d.kind === 'oak') oaks.push({ x: d.x, y: d.y, z: d.z, scale: 1.3, variant: d.id % 5 })
      else props.push(d)
    }
    return { trees, oaks, props }
  }, [decorations])

  return (
    <group>
      <Conifers trees={trees} />
      <Conifers trees={oaks} broadleafEvery={1} />
      {props.map((d) => (
        <group key={d.id} position={[d.x, d.y, d.z]} rotation={[0, d.rot, 0]}>
          <DecorModel kind={d.kind} />
        </group>
      ))}
      {mode && <DecorPlacer onMessage={onMessage} />}
    </group>
  )
}

function DecorPlacer({ onMessage }: { onMessage?: (msg: string) => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const mode = useGame((s) => s.decorMode)!
  const decorations = useGame((s) => s.decorations)
  const budget = useGame((s) => s.budget)

  const ghost = useRef<THREE.Group>(null)
  const hit = useRef<THREE.Vector3 | null>(null)
  const hitBlocked = useRef(false)
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [ghostOk, setGhostOk] = useState(true)
  const grounds = useRef<THREE.Object3D[]>([])
  const groundsAt = useRef(0)
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const down = useRef<{ x: number; y: number } | null>(null)
  const pending = useRef<{ x: number; y: number } | null>(null)

  const tool = mode.tool
  const removing = tool === 'remove'
  const affordable = removing || budget >= DECOR_BY_KIND[tool].cost

  // Raycast the ground once per frame at most, from the latest pointer position
  useFrame(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    const now = performance.now()
    if (now - groundsAt.current > 400) {
      const list: THREE.Object3D[] = []
      scene.traverse((o) => {
        if (o.userData.ground || o.userData.blocker) list.push(o)
      })
      grounds.current = list
      groundsAt.current = now
    }
    const rect = gl.domElement.getBoundingClientRect()
    ndc.set(((p.x - rect.left) / rect.width) * 2 - 1, -((p.y - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const first = ray.intersectObjects(grounds.current, true)[0]
    hit.current = first ? first.point.clone() : null
    hitBlocked.current = !!first && isBlocked(first.object)
    const g = ghost.current
    if (g) {
      g.visible = !!first && !removing
      if (first) g.position.copy(first.point)
    }
    if (first) {
      const { decorations: decor } = useGame.getState()
      if (removing) {
        setHoverId(nearestDecor(decor, first.point.x, first.point.z)?.id ?? null)
      } else {
        setGhostOk(
          affordable && !hitBlocked.current && !blocked(decor, tool, first.point.x, first.point.z),
        )
      }
    }
  })

  useEffect(() => {
    const el = gl.domElement
    const onMove = (e: PointerEvent) => {
      pending.current = { x: e.clientX, y: e.clientY }
    }
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) down.current = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      const d = down.current
      down.current = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > CLICK_SLOP) return
      // Use the point under the release, not a stale hover
      pending.current = { x: e.clientX, y: e.clientY }
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const p = hit.current
          if (!p) return
          const g = useGame.getState()
          const m = g.decorMode
          if (!m) return
          if (hitBlocked.current && m.tool !== 'remove') {
            onMessage?.("Can't build on top of the clubhouse")
            return
          }
          if (m.tool === 'remove') {
            const target = nearestDecor(g.decorations, p.x, p.z)
            if (target) onMessage?.(g.removeDecoration(target.id).message)
            return
          }
          if (blocked(g.decorations, m.tool, p.x, p.z)) {
            onMessage?.('Too close to another decoration')
            return
          }
          const r = g.placeDecoration(p.x, p.y, p.z)
          if (r.message) onMessage?.(r.message)
        }),
      )
    }
    const onLeave = () => {
      hit.current = null
      if (ghost.current) ghost.current.visible = false
      setHoverId(null)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onLeave)
    el.style.cursor = removing ? 'not-allowed' : 'copy'
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
      el.style.cursor = ''
    }
  }, [gl, onMessage, removing])

  const hovered = removing ? decorations.find((d) => d.id === hoverId) : undefined
  const ringR = removing ? 1 : DECOR_BY_KIND[tool].radius + 0.25

  return (
    <group>
      {!removing && (
        <group ref={ghost} visible={false}>
          <group rotation={[0, mode.rot, 0]}>
            <DecorModel kind={tool} />
          </group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={10}>
            <ringGeometry args={[ringR * 0.88, ringR, 40]} />
            <meshBasicMaterial
              color={ghostOk ? '#f3eee2' : '#b0392e'}
              transparent
              opacity={0.85}
              depthTest={false}
            />
          </mesh>
        </group>
      )}
      {hovered && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[hovered.x, hovered.y + 0.08, hovered.z]}
          renderOrder={10}
        >
          <ringGeometry
            args={[DECOR_BY_KIND[hovered.kind].radius + 0.2, DECOR_BY_KIND[hovered.kind].radius + 0.45, 40]}
          />
          <meshBasicMaterial color="#b0392e" transparent opacity={0.9} depthTest={false} />
        </mesh>
      )}
    </group>
  )
}
