import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MapControls, PerspectiveCamera } from '@react-three/drei'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import type { Hole } from '../game/types'
import { nextHoleCost } from '../game/types'
import { holeMapPosition, nextBuildTarget } from '../game/world'
import { beverageCartsReady, type StaffRoster } from '../game/staff'
import { mapToWorld } from './coords'
import { ClaimPlot, HoleMesh, type EditPhase } from './HoleMesh'
import { useGame } from '../game/store'
import { ParkEnvironment } from './ParkEnvironment'
import { PaintedLook } from './PaintedLook'
import { HolePlayGroup, PlazaWalkers, RoamingCart } from './PlayAgents'

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/** Glides the camera to the focus point; swoops in close while a hole is being built. */
function FocusRig({ x, z, close }: { x: number; z: number; close: boolean }) {
  const controls = useThree((s) => s.controls) as MapControlsImpl | null
  const cam = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const ready = useRef(false)
  const anim = useRef<{
    fromP: THREE.Vector3
    toP: THREE.Vector3
    fromT: THREE.Vector3
    toT: THREE.Vector3
    t: number
  } | null>(null)

  useEffect(() => {
    if (!controls) return
    // Leave room for the edit placard: to the right on wide screens, below on narrow ones
    const wide = size.width > 900
    const aspect = size.width / Math.max(1, size.height)
    // Back off far enough that the whole plot fits across the screen
    const fit = 38 / (2 * Math.tan((19 * Math.PI) / 180) * Math.min(aspect, 1.6))
    const dist = Math.min(130, Math.max(46, fit))
    const toT = close
      ? new THREE.Vector3(x + (wide ? 8 : 0), 0, z + (wide ? -2 : dist * 0.32))
      : new THREE.Vector3(x, 0, z)
    // High aerial vantage, looking steeply down like the painted course study
    const k = dist / 46.8
    const toP = close
      ? new THREE.Vector3(toT.x + 3 * k, 40 * k, toT.z + 24 * k)
      : new THREE.Vector3(x + 7, 52, z + 27)
    if (!ready.current) {
      controls.target.copy(toT)
      cam.position.set(x + 8, 58, z + 30)
      controls.update()
      ready.current = true
      return
    }
    anim.current = { fromP: cam.position.clone(), toP, fromT: controls.target.clone(), toT, t: 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, z, close, controls, cam, size.width > 900])

  useFrame((_, dt) => {
    const a = anim.current
    if (!a || !controls) return
    a.t = Math.min(1, a.t + dt / 0.9)
    const k = easeInOut(a.t)
    cam.position.lerpVectors(a.fromP, a.toP, k)
    controls.target.lerpVectors(a.fromT, a.toT, k)
    controls.update()
    if (a.t >= 1) anim.current = null
  })
  return null
}

/** While building, left-drag/one finger belongs to the brush; orbit and pan move to the other buttons. */
function EditControlsMode({ editing }: { editing: boolean }) {
  const controls = useThree((s) => s.controls) as MapControlsImpl | null
  useEffect(() => {
    if (!controls) return
    const c = controls as unknown as {
      mouseButtons: Record<string, number>
      touches: Record<string, number>
    }
    const prevMouse = { ...c.mouseButtons }
    const prevTouch = { ...c.touches }
    if (editing) {
      c.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }
      c.touches = { ONE: -1, TWO: THREE.TOUCH.DOLLY_PAN }
    }
    return () => {
      c.mouseButtons = prevMouse
      c.touches = prevTouch
    }
  }, [controls, editing])
  return null
}

export function CourseScene({
  holes,
  carts,
  staff,
  focus,
  onOpenHole,
  onClaim,
}: {
  holes: Hole[]
  carts: number
  staff: StaffRoster
  focus: { x: number; y: number }
  onOpenHole: (id: number) => void
  onClaim: () => void
}) {
  const editingId = useGame((s) => s.activeHoleId)
  const editor = useGame((s) => s.editor)
  const lastStroke = useRef(0)
  const brushCells =
    editor.tool === 'tee' || editor.tool === 'pin' ? 0 : editor.brushRadius
  const onEdit = useCallback((phase: EditPhase, cx: number, cy: number) => {
    const g = useGame.getState()
    const tool = g.editor.tool
    if (tool === 'tee' || tool === 'pin') {
      if (phase === 'down') (tool === 'tee' ? g.placeTee : g.placePin)(cx, cy)
      return
    }
    if (phase === 'up') return
    // Keep strokes to ~30 per second so dragging stays smooth
    const now = performance.now()
    if (phase === 'move' && now - lastStroke.current < 33) return
    lastStroke.current = now
    if (tool === 'sculpt') g.applySculpt(cx, cy)
    else if (tool === 'water') g.applyWater(cx, cy)
    else g.applyPaint(cx, cy)
  }, [])
  const edit = useMemo(() => ({ onEdit, brushCells }), [onEdit, brushCells])
  const focusWorld = mapToWorld(focus.x, focus.y)
  const courseHoles = holes.filter((h) => h.kind === 'hole')
  const openPlay = useMemo(() => {
    const open = holes.filter((h) => h.kind === 'range' || h.buildStage === 'open')
    // Cap concurrent play groups for performance
    return open.slice(0, 10)
  }, [holes])
  const drinksOn = beverageCartsReady(staff, carts)
  const count = courseHoles.length
  const target = nextBuildTarget(count)
  const cost = nextHoleCost(count)
  const buildPos = target ? holeMapPosition(target.courseId, target.number) : null
  const reserved = useMemo(
    () => (buildPos ? [mapToWorld(buildPos.x, buildPos.y)] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildPos?.x, buildPos?.y],
  )

  return (
    <Canvas
      className="world__canvas"
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.05
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
    >
      <PerspectiveCamera
        makeDefault
        fov={38}
        position={[focusWorld.x + 8, 58, focusWorld.z + 30]}
        near={0.5}
        far={600}
      />
      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.6}
        minPolarAngle={0.12}
        minDistance={24}
        maxDistance={190}
        target={[focusWorld.x, 0, focusWorld.z]}
      />
      <FocusRig x={focusWorld.x} z={focusWorld.z} close={editingId !== null} />
      <EditControlsMode editing={editingId !== null} />

      <Suspense fallback={null}>
        <ParkEnvironment cartCount={carts} holes={holes} reserved={reserved} />

        {holes.map((hole) => (
          <HoleMesh
            key={hole.id}
            hole={hole}
            onSelect={onOpenHole}
            edit={hole.id === editingId ? edit : undefined}
          />
        ))}

        {buildPos && target && editingId === null && (
          <ClaimPlot
            mapX={buildPos.x}
            mapY={buildPos.y}
            label={`${target.courseId === 'a' ? 'North' : 'South'} ${target.number}`}
            cost={cost}
            onClaim={onClaim}
          />
        )}

        {openPlay.map((hole, i) => (
          <HolePlayGroup
            key={`play-${hole.id}`}
            hole={hole}
            delay={i * 1.4}
            preferCart={carts > 0}
          />
        ))}

        <PlazaWalkers count={10} />

        {carts > 0 &&
          Array.from({ length: Math.min(carts, 4) }, (_, i) => (
            <RoamingCart key={`cart-${i}`} index={i} />
          ))}

        {drinksOn &&
          Array.from({ length: Math.min(staff.beverage, 2) }, (_, i) => (
            <RoamingCart key={`bev-${i}`} index={i + 5} beverage />
          ))}
      </Suspense>

      <PaintedLook />
    </Canvas>
  )
}
