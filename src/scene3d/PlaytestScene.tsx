import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { Hole, Point } from '../game/types'
import type { BallState } from '../game/physics'
import { ELEV_SCALE, HOLE_MESH_D, HOLE_MESH_W } from './coords'
import { GolfCartModel, GolferFigure } from './figures'
import { Conifers, type ConiferSpec } from './Conifers'
import { buildHeightmap } from './HoleMesh'
import { PaintedLighting } from './ParkEnvironment'
import { PaintedLook } from './PaintedLook'
import { HAZE, MEADOW_RGB, fbm, mottle } from './terrainColors'

function cellToPos(hole: Hole, cx: number, cy: number, lift = 0.1) {
  const sx = HOLE_MESH_W / (hole.width - 1)
  const sz = HOLE_MESH_D / (hole.height - 1)
  const gx = Math.max(0, Math.min(hole.width - 1, cx))
  const gy = Math.max(0, Math.min(hole.height - 1, cy))
  const ix = Math.floor(gx)
  const iy = Math.floor(gy)
  const elev = hole.elevation[iy * hole.width + ix] ?? 0.4
  return new THREE.Vector3(
    (gx - (hole.width - 1) / 2) * sx,
    elev * ELEV_SCALE + lift,
    (gy - (hole.height - 1) / 2) * sz,
  )
}

function Playfield({
  hole,
  ballRef,
  trailRef,
  aimRef,
  draggingRef,
  useCart,
}: {
  hole: Hole
  ballRef: React.MutableRefObject<BallState | null>
  trailRef: React.MutableRefObject<Point[]>
  aimRef: React.MutableRefObject<Point | null>
  draggingRef: React.MutableRefObject<boolean>
  useCart: boolean
}) {
  const geo = useMemo(() => buildHeightmap(hole, { step: 1, feather: false, worldX: 0, worldZ: 0 }).geo, [hole])
  const surround = useMemo(() => surroundingTrees(hole), [hole])
  const ground = useMemo(() => surroundGround(), [])
  const ballMesh = useRef<THREE.Mesh>(null)
  const golfer = useRef<THREE.Group>(null)
  const cart = useRef<THREE.Group>(null)
  const aimLine = useRef<THREE.Line>(null)
  const trailLine = useRef<THREE.Line>(null)

  const pin = useMemo(() => cellToPos(hole, hole.pin.x, hole.pin.y, 0.05), [hole])
  const tee = useMemo(() => cellToPos(hole, hole.tee.x, hole.tee.y, 0.05), [hole])

  const aimGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3))
    return g
  }, [])
  const trailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(120), 3))
    return g
  }, [])

  useFrame(() => {
    const ball = ballRef.current
    if (!ball || !ballMesh.current) return
    const pos = cellToPos(hole, ball.x, ball.y, 0.12)
    // Arc when moving fast
    const speed = Math.hypot(ball.vx, ball.vy)
    if (ball.moving) pos.y += Math.min(2.2, speed * 1.8)
    ballMesh.current.position.copy(pos)

    if (golfer.current) {
      const stand = cellToPos(hole, ball.x - 0.8, ball.y, 0)
      stand.y = cellToPos(hole, ball.x, ball.y, 0).y
      if (!ball.moving) {
        golfer.current.position.lerp(stand, 0.15)
        golfer.current.lookAt(pos.x + ball.vx * 10, stand.y, pos.z + ball.vy * 10)
      }
      golfer.current.visible = !useCart || speed < 0.02
    }
    if (cart.current) {
      const cpos = cellToPos(hole, ball.x - 2.2, ball.y + 1.4, 0)
      cart.current.position.lerp(cpos, 0.08)
      cart.current.visible = useCart
    }

    // Aim line
    if (aimLine.current) {
      const attr = aimLine.current.geometry.getAttribute('position') as THREE.BufferAttribute
      if (draggingRef.current && aimRef.current && !ball.moving) {
        const aim = aimRef.current
        const target = {
          x: ball.x - (aim.x - ball.x),
          y: ball.y - (aim.y - ball.y),
        }
        const a = cellToPos(hole, ball.x, ball.y, 0.2)
        const b = cellToPos(hole, target.x, target.y, 0.2)
        attr.setXYZ(0, a.x, a.y, a.z)
        attr.setXYZ(1, b.x, b.y, b.z)
        attr.needsUpdate = true
        aimLine.current.visible = true
      } else {
        aimLine.current.visible = false
      }
    }

    // Trail
    if (trailLine.current) {
      const pts = trailRef.current
      const arr = trailLine.current.geometry.getAttribute('position') as THREE.BufferAttribute
      const n = Math.min(40, pts.length)
      for (let i = 0; i < 40; i++) {
        if (i < n) {
          const p = cellToPos(hole, pts[pts.length - n + i].x, pts[pts.length - n + i].y, 0.15)
          arr.setXYZ(i, p.x, p.y, p.z)
        } else {
          arr.setXYZ(i, pos.x, pos.y, pos.z)
        }
      }
      arr.needsUpdate = true
      trailLine.current.visible = n > 1
    }
  })

  return (
    <group>
      <mesh geometry={geo} receiveShadow castShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      <Conifers trees={surround} />

      {/* Flag */}
      <group position={[pin.x, pin.y, pin.z]}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 2.2, 6]} />
          <meshLambertMaterial color="#ece9e1" />
        </mesh>
        <mesh position={[0.35, 1.85, 0]} castShadow>
          <boxGeometry args={[0.7, 0.38, 0.04]} />
          <meshLambertMaterial color="#b8352c" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.16, 14]} />
          <meshBasicMaterial color="#1b2119" />
        </mesh>
      </group>

      {/* Tee marker */}
      <mesh position={[tee.x, tee.y + 0.05, tee.z]}>
        <cylinderGeometry args={[0.2, 0.2, 0.08, 12]} />
        <meshLambertMaterial color="#ece9e1" />
      </mesh>

      <mesh ref={ballMesh} castShadow>
        <sphereGeometry args={[0.1, 14, 12]} />
        <meshLambertMaterial color="#fbfaf6" emissive="#2a2a26" />
      </mesh>

      <group ref={golfer}>
        <GolferFigure hueSeed={4} pose="idle" />
      </group>
      <group ref={cart} scale={0.9}>
        <GolfCartModel />
      </group>

      {/* @ts-expect-error line is valid R3F element */}
      <line ref={aimLine} geometry={aimGeo}>
        <lineBasicMaterial color="#f3eee2" linewidth={2} />
      </line>
      {/* @ts-expect-error line is valid R3F element */}
      <line ref={trailLine} geometry={trailGeo}>
        <lineBasicMaterial color="#f3eee2" transparent opacity={0.6} />
      </line>

      <PaintedLighting extent={45} mapSize={2048} />
      <mesh geometry={ground} receiveShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
    </group>
  )
}

export function PlaytestScene({
  hole,
  ballRef,
  trailRef,
  aimRef,
  draggingRef,
  useCart,
  onPointerAim,
}: {
  hole: Hole
  ballRef: React.MutableRefObject<BallState | null>
  trailRef: React.MutableRefObject<Point[]>
  aimRef: React.MutableRefObject<Point | null>
  draggingRef: React.MutableRefObject<boolean>
  useCart: boolean
  onPointerAim: {
    onDown: (cell: Point) => void
    onMove: (cell: Point) => void
    onUp: () => void
  }
}) {
  const tee = cellToPos(hole, hole.tee.x, hole.tee.y)
  const pin = cellToPos(hole, hole.pin.x, hole.pin.y)
  const mid = tee.clone().lerp(pin, 0.45)

  return (
    <Canvas
      className="playtest__canvas"
      shadows
      dpr={[1, 1.75]}
      onPointerMissed={() => {}}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.05
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
    >
      <color attach="background" args={[HAZE]} />
      <fog attach="fog" args={[HAZE, 60, 140]} />
      <PaintedLook spread={1.6} />
      <PerspectiveCamera makeDefault fov={40} position={[mid.x + 5, 20, mid.z + 15]} />
      <OrbitControls
        target={[mid.x, 1, mid.z]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={8}
        maxDistance={40}
        enablePan={false}
      />
      <Playfield
        hole={hole}
        ballRef={ballRef}
        trailRef={trailRef}
        aimRef={aimRef}
        draggingRef={draggingRef}
        useCart={useCart}
      />
      <AimCatcher hole={hole} {...onPointerAim} />
    </Canvas>
  )
}

function AimCatcher({
  hole,
  onDown,
  onMove,
  onUp,
}: {
  hole: Hole
  onDown: (cell: Point) => void
  onMove: (cell: Point) => void
  onUp: () => void
}) {
  const dragging = useRef(false)
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      onPointerDown={(e) => {
        e.stopPropagation()
        dragging.current = true
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        onDown(worldToCell(hole, e.point))
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        onMove(worldToCell(hole, e.point))
      }}
      onPointerUp={() => {
        dragging.current = false
        onUp()
      }}
    >
      <planeGeometry args={[HOLE_MESH_W * 1.2, HOLE_MESH_D * 1.2]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

function worldToCell(hole: Hole, point: THREE.Vector3): Point {
  const sx = HOLE_MESH_W / (hole.width - 1)
  const sz = HOLE_MESH_D / (hole.height - 1)
  return {
    x: point.x / sx + (hole.width - 1) / 2,
    y: point.z / sz + (hole.height - 1) / 2,
  }
}

/** Ring of spruce around the playtest hole so it sits in a clearing, like the painting */
function surroundingTrees(hole: Hole): ConiferSpec[] {
  const out: ConiferSpec[] = []
  let s = hole.id * 9301 + 49297
  const rand = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  const hw = HOLE_MESH_W / 2
  const hd = HOLE_MESH_D / 2
  for (let i = 0; i < 140; i++) {
    const x = (rand() - 0.5) * (HOLE_MESH_W + 44)
    const z = (rand() - 0.5) * (HOLE_MESH_D + 40)
    const dx = Math.max(0, Math.abs(x) - hw)
    const dz = Math.max(0, Math.abs(z) - hd)
    const out_ = Math.hypot(dx, dz)
    if (out_ < 1.5) continue
    // Thicker stands further out
    if (out_ < 5 && rand() > 0.45) continue
    out.push({ x, z, scale: 0.6 + rand() * 1.1, variant: Math.floor(rand() * 5) })
  }
  return out
}

function surroundGround() {
  const g = new THREE.PlaneGeometry(140, 110, 70, 55)
  g.rotateX(-Math.PI / 2)
  const pos = g.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, -0.2 - fbm(x * 0.04, z * 0.04, 3) * 0.6)
    const [r, gg, b] = mottle(MEADOW_RGB, x, z, 1.6)
    colors[i * 3] = r
    colors[i * 3 + 1] = gg
    colors[i * 3 + 2] = b
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}
