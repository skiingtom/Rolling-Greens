import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { useGame } from '../game/store'
import { CLUBHOUSE } from '../game/world'
import { mapToWorld } from './coords'
import { HoleMesh } from './HoleMesh'
import { PaintedLook } from './PaintedLook'
import { DecorLayer } from './DecorLayer'
import { ParkEnvironment } from './ParkEnvironment'
import { HolePlayGroup, PlazaWalkers, RoamingCart } from './PlayAgents'

/** Camera that drifts slowly across the grounds, high overhead. */
function DriftCamera({ x, z }: { x: number; z: number }) {
  const cam = useRef<THREE.PerspectiveCamera>(null)
  useFrame(({ clock }) => {
    const c = cam.current
    if (!c) return
    const t = clock.elapsedTime * 0.035
    const px = x + Math.sin(t) * 16
    const pz = z + Math.cos(t * 0.8) * 6
    c.position.set(px + 6, 58, pz + 30)
    c.lookAt(px, 0, pz - 2)
  })
  return <PerspectiveCamera ref={cam} makeDefault fov={38} position={[x + 6, 58, z + 30]} far={500} />
}

export function LandingBackdrop() {
  const allHoles = useGame((s) => s.holes)
  // The visitor's own club (or the starter range) painted behind the title card
  const holes = useMemo(() => allHoles, [allHoles])
  const playing = useMemo(
    () => holes.filter((h) => h.kind === 'range' || h.buildStage === 'open').slice(0, 6),
    [holes],
  )
  const club = mapToWorld(CLUBHOUSE.x, CLUBHOUSE.y)
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.05
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
      style={{ pointerEvents: 'none' }}
    >
      <DriftCamera x={club.x + 8} z={club.z - 6} />
      <ParkEnvironment cartCount={2} holes={holes} />
      {holes.map((h) => (
        <HoleMesh key={h.id} hole={h} onSelect={() => {}} hideLabel />
      ))}
      {playing.map((h, i) => (
        <HolePlayGroup key={`p${h.id}`} hole={h} delay={i} preferCart />
      ))}
      <DecorLayer />
      <PlazaWalkers count={12} />
      <RoamingCart index={0} />
      <RoamingCart index={1} />
      <PaintedLook />
    </Canvas>
  )
}
