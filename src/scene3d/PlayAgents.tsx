import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Hole } from '../game/types'
import { CLUBHOUSE, ROAD_PATH } from '../game/world'
import { mapToWorld } from './coords'
import { sampleHoleSurface } from './HoleMesh'
import { GolfCartModel, GolferFigure, type FigurePose } from './figures'

type Phase =
  | 'arrive'
  | 'walk_to_tee'
  | 'address'
  | 'swing'
  | 'flight'
  | 'to_ball'
  | 'putt_address'
  | 'putt'
  | 'putt_flight'
  | 'celebrate'
  | 'leave'

interface AgentState {
  phase: Phase
  t: number
  stroke: number
  ballPos: THREE.Vector3
  ballVel: THREE.Vector3
  golferPos: THREE.Vector3
  cartPos: THREE.Vector3
  facing: number
  inCart: boolean
  showBall: boolean
  useCart: boolean
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function faceToward(from: THREE.Vector3, to: THREE.Vector3) {
  return Math.atan2(to.x - from.x, to.z - from.z)
}

function makeShots(hole: Hole) {
  const tee = { x: hole.tee.x, y: hole.tee.y }
  const pin = { x: hole.pin.x, y: hole.pin.y }
  const mid = {
    x: lerp(tee.x, pin.x, 0.55) + (hole.id % 5) - 2,
    y: lerp(tee.y, pin.y, 0.5) + ((hole.id * 3) % 7) - 3,
  }
  const approach = {
    x: lerp(tee.x, pin.x, 0.82),
    y: lerp(tee.y, pin.y, 0.8),
  }
  if (hole.kind === 'range') {
    return [tee, { x: tee.x + 28 + (hole.id % 4) * 3, y: tee.y + ((hole.id % 3) - 1) * 4 }]
  }
  if (hole.par <= 3) return [tee, approach, pin]
  if (hole.par === 4) return [tee, mid, approach, pin]
  return [tee, mid, { x: lerp(mid.x, pin.x, 0.5), y: lerp(mid.y, pin.y, 0.45) }, approach, pin]
}

export function HolePlayGroup({
  hole,
  delay = 0,
  preferCart = true,
}: {
  hole: Hole
  delay?: number
  preferCart?: boolean
}) {
  const origin = useMemo(() => mapToWorld(hole.mapX, hole.mapY), [hole.mapX, hole.mapY])
  const shots = useMemo(() => makeShots(hole), [hole])
  const state = useRef<AgentState | null>(null)
  const poseRef = useRef<FigurePose>('idle')
  const swingTRef = useRef(0)

  const golferRef = useRef<THREE.Group>(null)
  const cartRef = useRef<THREE.Group>(null)
  const ballRef = useRef<THREE.Mesh>(null)

  useFrame((_, dt) => {
    const capped = Math.min(dt, 0.05)
    if (!state.current) {
      const teeLocal = sampleHoleSurface(hole, shots[0].x, shots[0].y)
      const start = new THREE.Vector3(teeLocal.x - 4, 0, teeLocal.z + 3)
      state.current = {
        phase: 'arrive',
        t: -delay,
        stroke: 0,
        ballPos: new THREE.Vector3(teeLocal.x, teeLocal.y, teeLocal.z),
        ballVel: new THREE.Vector3(),
        golferPos: start.clone(),
        cartPos: start.clone().add(new THREE.Vector3(-1.5, 0, 1.2)),
        facing: 0,
        inCart: preferCart && hole.kind !== 'range',
        showBall: true,
        useCart: preferCart && hole.kind !== 'range',
      }
    }

    const s = state.current
    s.t += capped

    const worldOf = (local: THREE.Vector3) =>
      new THREE.Vector3(origin.x + local.x, local.y, origin.z + local.z)

    const moveToward = (target: THREE.Vector3, speed: number) => {
      const delta = target.clone().sub(s.golferPos)
      const dist = delta.length()
      if (dist < 0.15) {
        s.golferPos.copy(target)
        poseRef.current = 'idle'
        return true
      }
      delta.normalize().multiplyScalar(speed * capped)
      s.golferPos.add(delta)
      s.facing = faceToward(s.golferPos, target)
      poseRef.current = 'walk'
      return false
    }

    const currentShot = shots[Math.min(s.stroke, shots.length - 1)]
    const nextShot = shots[Math.min(s.stroke + 1, shots.length - 1)]
    const ballLocal = sampleHoleSurface(hole, currentShot.x, currentShot.y)
    const nextLocal = sampleHoleSurface(hole, nextShot.x, nextShot.y)

    if (s.t < 0) return

    switch (s.phase) {
      case 'arrive': {
        s.inCart = s.useCart
        const gate = new THREE.Vector3(ballLocal.x - 2.5, 0, ballLocal.z + 2)
        if (s.inCart) {
          poseRef.current = 'seated'
          const d = gate.clone().sub(s.cartPos)
          if (d.length() < 0.2) {
            s.phase = 'walk_to_tee'
            s.inCart = false
            s.t = 0
          } else {
            d.normalize().multiplyScalar(5.5 * capped)
            s.cartPos.add(d)
            s.golferPos.copy(s.cartPos).add(new THREE.Vector3(0, 0, 0.1))
            s.facing = faceToward(s.cartPos, gate)
          }
        } else if (moveToward(gate, 2.2)) {
          s.phase = 'walk_to_tee'
          s.t = 0
        }
        break
      }
      case 'walk_to_tee': {
        const stand = new THREE.Vector3(ballLocal.x - 0.55, 0, ballLocal.z)
        if (moveToward(stand, 2.4)) {
          s.facing = faceToward(s.golferPos, new THREE.Vector3(nextLocal.x, 0, nextLocal.z))
          s.phase = s.stroke >= shots.length - 2 && hole.kind !== 'range' ? 'putt_address' : 'address'
          s.t = 0
          s.ballPos.set(ballLocal.x, ballLocal.y, ballLocal.z)
          s.showBall = true
        }
        break
      }
      case 'address':
      case 'putt_address': {
        poseRef.current = 'idle'
        swingTRef.current = 0
        if (s.t > 0.7) {
          s.phase = s.phase === 'putt_address' ? 'putt' : 'swing'
          s.t = 0
        }
        break
      }
      case 'swing':
      case 'putt': {
        poseRef.current = 'swing'
        swingTRef.current = Math.min(1, s.t / 0.55)
        if (s.t > 0.55) {
          const start = new THREE.Vector3(ballLocal.x, ballLocal.y + 0.1, ballLocal.z)
          const end = new THREE.Vector3(nextLocal.x, nextLocal.y + 0.1, nextLocal.z)
          s.ballPos.copy(start)
          const flight = end.clone().sub(start)
          const dur = s.phase === 'putt' ? 1.1 : 1.6 + flight.length() * 0.04
          s.ballVel.set(
            flight.x / dur,
            s.phase === 'putt' ? 0.4 : 3.2 + flight.length() * 0.08,
            flight.z / dur,
          )
          s.phase = s.phase === 'putt' ? 'putt_flight' : 'flight'
          s.t = 0
          poseRef.current = 'idle'
        }
        break
      }
      case 'flight':
      case 'putt_flight': {
        poseRef.current = 'idle'
        s.ballPos.addScaledVector(s.ballVel, capped)
        s.ballVel.y -= (s.phase === 'putt_flight' ? 4 : 7.5) * capped
        if (s.ballPos.y < nextLocal.y) {
          s.ballPos.set(nextLocal.x, nextLocal.y, nextLocal.z)
          s.stroke += 1
          if (hole.kind === 'range' || s.stroke >= shots.length - 1) {
            s.phase = 'celebrate'
          } else {
            s.phase = 'to_ball'
          }
          s.t = 0
        }
        break
      }
      case 'to_ball': {
        const stand = new THREE.Vector3(nextLocal.x - 0.55, 0, nextLocal.z)
        const dist = stand.distanceTo(s.golferPos)
        if (s.useCart && dist > 4.5) {
          s.inCart = true
          poseRef.current = 'seated'
          const d = stand.clone().sub(s.cartPos)
          if (d.length() < 0.35) {
            s.inCart = false
            s.golferPos.copy(stand)
            s.phase = s.stroke >= shots.length - 2 ? 'putt_address' : 'address'
            s.t = 0
          } else {
            d.normalize().multiplyScalar(6 * capped)
            s.cartPos.add(d)
            s.golferPos.copy(s.cartPos)
            s.facing = faceToward(s.cartPos, stand)
          }
        } else if (moveToward(stand, 2.6)) {
          s.facing = faceToward(s.golferPos, new THREE.Vector3(nextLocal.x, 0, nextLocal.z))
          s.phase = s.stroke >= shots.length - 2 ? 'putt_address' : 'address'
          s.t = 0
        }
        if (!s.inCart && s.useCart) {
          const follow = s.golferPos.clone().add(new THREE.Vector3(-1.8, 0, 1.4))
          s.cartPos.lerp(follow, 1 - Math.pow(0.02, capped))
        }
        break
      }
      case 'celebrate': {
        poseRef.current = 'idle'
        s.showBall = hole.kind === 'range'
        if (s.t > 2.2) {
          if (hole.kind === 'range') {
            s.stroke = 0
            s.phase = 'walk_to_tee'
            const tee = sampleHoleSurface(hole, shots[0].x, shots[0].y)
            s.ballPos.set(tee.x, tee.y, tee.z)
            s.showBall = true
            s.t = 0
          } else {
            s.phase = 'leave'
            s.t = 0
            s.inCart = s.useCart
          }
        }
        break
      }
      case 'leave': {
        const exit = new THREE.Vector3(ballLocal.x - 6, 0, ballLocal.z + 5)
        if (s.inCart) {
          poseRef.current = 'seated'
          const d = exit.clone().sub(s.cartPos)
          if (d.length() < 0.3 || s.t > 4) {
            s.stroke = 0
            s.phase = 'arrive'
            s.t = -1.5
            const tee = sampleHoleSurface(hole, shots[0].x, shots[0].y)
            s.ballPos.set(tee.x, tee.y, tee.z)
            s.golferPos.set(tee.x - 5, 0, tee.z + 4)
            s.cartPos.copy(s.golferPos).add(new THREE.Vector3(-1.5, 0, 1.2))
            s.showBall = true
          } else {
            d.normalize().multiplyScalar(5.5 * capped)
            s.cartPos.add(d)
            s.golferPos.copy(s.cartPos)
            s.facing = faceToward(s.cartPos, exit)
          }
        } else if (moveToward(exit, 2.3) || s.t > 5) {
          s.stroke = 0
          s.phase = 'arrive'
          s.t = -2
          const tee = sampleHoleSurface(hole, shots[0].x, shots[0].y)
          s.ballPos.set(tee.x, tee.y, tee.z)
          s.showBall = true
        }
        break
      }
    }

    if (golferRef.current) {
      const w = worldOf(s.golferPos)
      golferRef.current.position.set(w.x, w.y, w.z)
      golferRef.current.rotation.y = s.facing
      golferRef.current.visible = !s.inCart
    }
    if (cartRef.current) {
      const w = worldOf(s.cartPos)
      cartRef.current.position.set(w.x, w.y, w.z)
      cartRef.current.rotation.y = s.facing
      cartRef.current.visible = s.useCart
    }
    if (ballRef.current) {
      const w = worldOf(s.ballPos)
      ballRef.current.position.set(w.x, w.y, w.z)
      ballRef.current.visible = s.showBall
    }
  })

  return (
    <group>
      <group ref={golferRef}>
        <GolferFigure hueSeed={hole.id + 2} poseRef={poseRef} swingTRef={swingTRef} />
      </group>
      {preferCart && hole.kind !== 'range' && (
        <group ref={cartRef}>
          <GolfCartModel />
        </group>
      )}
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>
    </group>
  )
}

export function RoamingCart({
  index,
  beverage = false,
}: {
  index: number
  beverage?: boolean
}) {
  const ref = useRef<THREE.Group>(null)
  const path = useMemo(() => {
    const base = ROAD_PATH.map((p) => mapToWorld(p.x, p.y))
    if (beverage) {
      const club = mapToWorld(CLUBHOUSE.x, CLUBHOUSE.y)
      return [
        ...base.slice(2, 6),
        club,
        mapToWorld(CLUBHOUSE.x + 280, CLUBHOUSE.y - 160),
        ...base.slice(4, 7),
      ]
    }
    return base
  }, [beverage])

  useFrame(({ clock }) => {
    if (!ref.current || path.length < 2) return
    const speed = beverage ? 0.035 : 0.028
    const t = (clock.elapsedTime * speed + index * 0.17) % 1
    const f = t * (path.length - 1)
    const i = Math.floor(f)
    const frac = f - i
    const a = path[i]
    const b = path[Math.min(i + 1, path.length - 1)]
    const x = lerp(a.x, b.x, frac)
    const z = lerp(a.z, b.z, frac)
    ref.current.position.set(x, 0, z)
    ref.current.rotation.y = Math.atan2(b.x - a.x, b.z - a.z)
  })

  return (
    <group ref={ref}>
      <GolfCartModel beverage={beverage} />
      {!beverage && (
        <group position={[0, 0, 0.15]}>
          <GolferFigure hueSeed={index + 9} pose="seated" />
        </group>
      )}
    </group>
  )
}

export function PlazaWalkers({ count = 8 }: { count?: number }) {
  const walkers = useMemo(() => {
    const club = mapToWorld(CLUBHOUSE.x, CLUBHOUSE.y)
    return Array.from({ length: count }, (_, i) => ({
      seed: i * 13 + 1,
      radius: 4 + (i % 4) * 2.5,
      speed: 0.25 + (i % 5) * 0.05,
      offset: i * 0.9,
      center: {
        x: club.x + ((i % 3) - 1) * 6,
        z: club.z + 6 + (i % 2) * 3,
      },
    }))
  }, [count])

  return (
    <group>
      {walkers.map((w) => (
        <PlazaWalker key={w.seed} {...w} />
      ))}
    </group>
  )
}

function PlazaWalker({
  seed,
  radius,
  speed,
  offset,
  center,
}: {
  seed: number
  radius: number
  speed: number
  offset: number
  center: { x: number; z: number }
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const a = clock.elapsedTime * speed + offset
    const x = center.x + Math.cos(a) * radius
    const z = center.z + Math.sin(a) * radius * 0.65
    ref.current.position.set(x, 0, z)
    ref.current.rotation.y = a + Math.PI / 2
  })
  return (
    <group ref={ref}>
      <GolferFigure hueSeed={seed} pose="walk" />
    </group>
  )
}
