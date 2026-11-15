import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { MapControls, PerspectiveCamera } from '@react-three/drei'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import type { Hole } from '../game/types'
import { nextHoleCost } from '../game/types'
import { holeMapPosition, nextBuildTarget } from '../game/world'
import { beverageCartsReady, type StaffRoster } from '../game/staff'
import { mapToWorld } from './coords'
import { ClaimPlot, HoleMesh } from './HoleMesh'
import { ParkEnvironment } from './ParkEnvironment'
import { HolePlayGroup, PlazaWalkers, RoamingCart } from './PlayAgents'

function FocusRig({ x, z }: { x: number; z: number }) {
  const controls = useThree((s) => s.controls) as MapControlsImpl | null
  const cam = useThree((s) => s.camera)
  const ready = useRef(false)
  useEffect(() => {
    if (!controls) return
    controls.target.set(x, 0, z)
    if (!ready.current) {
      cam.position.set(x + 28, 52, z + 48)
      ready.current = true
    } else {
      cam.position.set(x + 24, 46, z + 40)
    }
    controls.update()
  }, [x, z, controls, cam])
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

  return (
    <Canvas
      className="world__canvas"
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#87c6ef')
      }}
    >
      <PerspectiveCamera
        makeDefault
        fov={42}
        position={[focusWorld.x + 28, 52, focusWorld.z + 48]}
        near={0.5}
        far={600}
      />
      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.15}
        minPolarAngle={0.35}
        minDistance={22}
        maxDistance={180}
        target={[focusWorld.x, 0, focusWorld.z]}
      />
      <FocusRig x={focusWorld.x} z={focusWorld.z} />

      <Suspense fallback={null}>
        <ParkEnvironment cartCount={carts} />

        {holes.map((hole) => (
          <HoleMesh key={hole.id} hole={hole} onSelect={onOpenHole} />
        ))}

        {buildPos && target && (
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
    </Canvas>
  )
}
