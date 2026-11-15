import { useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { CART_BODY, CART_ROOF, PANTS, SHIRTS, SKINS } from './terrainColors'

export type FigurePose = 'idle' | 'walk' | 'swing' | 'seated'

export function GolferFigure({
  hueSeed = 0,
  pose = 'idle',
  swingT = 0,
  poseRef: externalPose,
  swingTRef: externalSwing,
}: {
  hueSeed?: number
  pose?: FigurePose
  swingT?: number
  poseRef?: MutableRefObject<FigurePose>
  swingTRef?: MutableRefObject<number>
}) {
  const group = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Mesh>(null)
  const legR = useRef<THREE.Mesh>(null)

  const skin = SKINS[hueSeed % SKINS.length]
  const shirt = SHIRTS[hueSeed % SHIRTS.length]
  const pants = PANTS[hueSeed % PANTS.length]
  const cap = hueSeed % 3 === 0 ? '#ece9e1' : hueSeed % 3 === 1 ? '#3a3f44' : '#c9c1ad'

  useFrame(({ clock }) => {
    if (!group.current) return
    const p = externalPose?.current ?? pose
    if (p === 'walk') {
      const swing = Math.sin(clock.elapsedTime * 8 + hueSeed) * 0.55
      if (legL.current) legL.current.rotation.x = swing
      if (legR.current) legR.current.rotation.x = -swing
      if (arm.current) {
        arm.current.rotation.x = -swing * 0.6
        arm.current.rotation.z = 0.1
      }
      group.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 8 + hueSeed)) * 0.04
    } else if (p === 'swing') {
      const t = Math.max(0, Math.min(1, externalSwing?.current ?? swingT))
      if (arm.current) {
        const angle = t < 0.35 ? -1.15 * (t / 0.35) : t < 0.5 ? -1.15 + 2.5 * ((t - 0.35) / 0.15) : 1.35
        arm.current.rotation.z = angle
        arm.current.rotation.x = t < 0.5 ? -0.25 : 0.45
      }
      if (legL.current) legL.current.rotation.x = 0.12
      if (legR.current) legR.current.rotation.x = -0.18
      group.current.position.y = 0
    } else if (p === 'seated') {
      if (legL.current) legL.current.rotation.x = Math.PI / 2.2
      if (legR.current) legR.current.rotation.x = Math.PI / 2.2
      if (arm.current) {
        arm.current.rotation.z = 0.25
        arm.current.rotation.x = 0.15
      }
      group.current.position.y = 0.55
    } else {
      if (legL.current) legL.current.rotation.x = 0
      if (legR.current) legR.current.rotation.x = 0
      if (arm.current) {
        arm.current.rotation.z = 0.12
        arm.current.rotation.x = 0
      }
      group.current.position.y = 0
    }
  })

  return (
    <group ref={group}>
      <mesh ref={legL} position={[-0.12, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.45, 4, 8]} />
        <meshLambertMaterial color={pants} />
      </mesh>
      <mesh ref={legR} position={[0.12, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.45, 4, 8]} />
        <meshLambertMaterial color={pants} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.45, 4, 8]} />
        <meshLambertMaterial color={shirt} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshLambertMaterial color={skin} />
      </mesh>
      <mesh position={[0, 1.68, 0.02]} castShadow>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshLambertMaterial color={cap} />
      </mesh>
      <mesh position={[0, 1.62, 0.16]}>
        <boxGeometry args={[0.22, 0.04, 0.14]} />
        <meshLambertMaterial color={cap} />
      </mesh>
      <group ref={arm} position={[0.2, 1.2, 0]}>
        <mesh position={[0.05, -0.25, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.35, 4, 6]} />
          <meshLambertMaterial color={skin} />
        </mesh>
        <mesh position={[0.08, -0.7, 0.05]} rotation={[0.2, 0, 0.1]} castShadow>
          <cylinderGeometry args={[0.03, 0.025, 1.15, 6]} />
          <meshLambertMaterial color="#8d9296" />
        </mesh>
        <mesh position={[0.1, -1.28, 0.12]} rotation={[0.4, 0.2, 0]} castShadow>
          <boxGeometry args={[0.22, 0.08, 0.35]} />
          <meshLambertMaterial color="#b9bcbe" />
        </mesh>
      </group>
      <mesh position={[-0.22, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.32, 4, 6]} />
        <meshLambertMaterial color={skin} />
      </mesh>
    </group>
  )
}

export function GolfCartModel({ beverage = false }: { beverage?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.6, 0.55, 2.4]} />
        <meshLambertMaterial color={beverage ? '#c9a24a' : CART_BODY} />
      </mesh>
      <mesh position={[0, 0.95, 0.15]} castShadow>
        <boxGeometry args={[1.45, 0.35, 0.9]} />
        <meshLambertMaterial color="#2a2c2b" />
      </mesh>
      <mesh position={[0, 1.85, -0.1]} castShadow>
        <boxGeometry args={[1.7, 0.08, 2.2]} />
        <meshLambertMaterial color={beverage ? '#ece4cc' : CART_ROOF} />
      </mesh>
      {[
        [-0.7, 1.3, -0.9],
        [0.7, 1.3, -0.9],
        [-0.7, 1.3, 0.85],
        [0.7, 1.3, 0.85],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <cylinderGeometry args={[0.04, 0.04, 1.1, 6]} />
          <meshLambertMaterial color="#8d9296" />
        </mesh>
      ))}
      {[
        [-0.85, 0.28, 0.85],
        [0.85, 0.28, 0.85],
        [-0.85, 0.28, -0.95],
        [0.85, 0.28, -0.95],
      ].map((p, i) => (
        <mesh key={`w${i}`} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.18, 12]} />
          <meshLambertMaterial color="#1c1d1c" />
        </mesh>
      ))}
      {beverage ? (
        <mesh position={[0, 1.05, -0.95]} castShadow>
          <boxGeometry args={[1.1, 0.7, 0.55]} />
          <meshLambertMaterial color="#ece4cc" />
        </mesh>
      ) : (
        <mesh position={[0.45, 1.15, -0.95]} castShadow>
          <boxGeometry args={[0.35, 0.7, 0.45]} />
          <meshLambertMaterial color="#3d4146" />
        </mesh>
      )}
    </group>
  )
}

export function GolfBallMesh() {
  return (
    <mesh castShadow>
      <sphereGeometry args={[0.07, 12, 10]} />
      <meshLambertMaterial color="#f2f0ea" />
    </mesh>
  )
}
