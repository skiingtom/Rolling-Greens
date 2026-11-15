import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { Hole, Point } from '../game/types'
import type { BallState } from '../game/physics'
import { ELEV_SCALE, HOLE_MESH_D, HOLE_MESH_W } from './coords'
import { GolfCartModel, GolferFigure } from './figures'
import { TERRAIN_FROM_INDEX } from '../game/types'
import { terrainColor } from './terrainColors'

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

function buildGeo(hole: Hole) {
  const step = 1
  const cols = Math.floor((hole.width - 1) / step) + 1
  const rows = Math.floor((hole.height - 1) / step) + 1
  const sx = HOLE_MESH_W / (hole.width - 1)
  const sz = HOLE_MESH_D / (hole.height - 1)
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const gx = Math.min(hole.width - 1, cx * step)
      const gy = Math.min(hole.height - 1, ry * step)
      const i = gy * hole.width + gx
      const elev = hole.elevation[i]
      const t = hole.terrain[i]
      const isWater = TERRAIN_FROM_INDEX[t] === 'water'
      const y = isWater ? elev * ELEV_SCALE * 0.35 - 0.12 : elev * ELEV_SCALE
      positions.push((gx - (hole.width - 1) / 2) * sx, y, (gy - (hole.height - 1) / 2) * sz)
      const eL = hole.elevation[gy * hole.width + Math.max(0, gx - 1)]
      const eR = hole.elevation[gy * hole.width + Math.min(hole.width - 1, gx + 1)]
      const shade = 0.85 + (eL - eR) * 0.4
      const [r, g, b] = terrainColor(t, Math.max(0.55, Math.min(1.15, shade)))
      colors.push(r, g, b)
    }
  }
  for (let ry = 0; ry < rows - 1; ry++) {
    for (let cx = 0; cx < cols - 1; cx++) {
      const a = ry * cols + cx
      const b = a + 1
      const c = a + cols
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
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
  const geo = useMemo(() => buildGeo(hole), [hole])
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
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>

      {/* Flag */}
      <group position={[pin.x, pin.y, pin.z]}>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 2.2, 6]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[0.35, 1.85, 0]}>
          <boxGeometry args={[0.7, 0.38, 0.04]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
      </group>

      {/* Tee marker */}
      <mesh position={[tee.x, tee.y + 0.05, tee.z]}>
        <cylinderGeometry args={[0.2, 0.2, 0.08, 12]} />
        <meshStandardMaterial color="#86efac" />
      </mesh>

      <mesh ref={ballMesh} castShadow>
        <sphereGeometry args={[0.1, 14, 12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.25} />
      </mesh>

      <group ref={golfer}>
        <GolferFigure hueSeed={4} pose="idle" />
      </group>
      <group ref={cart} scale={0.9}>
        <GolfCartModel />
      </group>

      {/* @ts-expect-error line is valid R3F element */}
      <line ref={aimLine} geometry={aimGeo}>
        <lineBasicMaterial color="#fef3c7" linewidth={2} />
      </line>
      {/* @ts-expect-error line is valid R3F element */}
      <line ref={trailLine} geometry={trailGeo}>
        <lineBasicMaterial color="#e2e8f0" transparent opacity={0.55} />
      </line>

      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#dbeafe', '#3f6212', 0.5]} />
      <directionalLight
        castShadow
        intensity={1.3}
        position={[20, 30, 12]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#3d7a38" roughness={1} />
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
      onCreated={({ gl }) => gl.setClearColor('#7ebce8')}
    >
      <PerspectiveCamera makeDefault fov={40} position={[mid.x + 8, 14, mid.z + 16]} />
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
