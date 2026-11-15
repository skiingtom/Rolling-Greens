import { memo, useMemo } from 'react'
import type { DecorKind } from '../game/decor'
import { Conifers, type ConiferSpec } from './Conifers'

/**
 * Low-poly decoration models in the painted palette. Scale: a golfer is ~1.7 units.
 * Everything sits on y = 0 and faces +Z at rot 0.
 */

const WOOD = '#8a6a48'
const WOOD_DARK = '#5c4530'
const IRON = '#2f3437'
const STONE = '#c9c2b2'
const STONE_DARK = '#a59f92'
const LEAF = '#2c4430'
const LEAF_LIGHT = '#41583a'
const PAPER = '#ece9e1'
const RED = '#b8352c'
const WATER = '#3b5c78'

function Box({
  p,
  s,
  c,
  r,
}: {
  p: [number, number, number]
  s: [number, number, number]
  c: string
  r?: [number, number, number]
}) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

function Cyl({
  p,
  r,
  h,
  c,
  seg = 10,
  rTop,
}: {
  p: [number, number, number]
  r: number
  h: number
  c: string
  seg?: number
  rTop?: number
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, seg]} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

function Blob({ p, r, c, detail = 1 }: { p: [number, number, number]; r: number; c: string; detail?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <icosahedronGeometry args={[r, detail]} />
      <meshLambertMaterial color={c} flatShading />
    </mesh>
  )
}

function Bench() {
  return (
    <group>
      <Box p={[0, 0.45, 0]} s={[1.6, 0.08, 0.45]} c={WOOD} />
      <Box p={[0, 0.8, -0.22]} s={[1.6, 0.36, 0.06]} c={WOOD} r={[-0.15, 0, 0]} />
      {[-0.7, 0.7].map((x) => (
        <Box key={x} p={[x, 0.32, -0.02]} s={[0.07, 0.64, 0.5]} c={IRON} />
      ))}
    </group>
  )
}

function Picnic() {
  return (
    <group>
      <Box p={[0, 0.75, 0]} s={[1.8, 0.08, 0.9]} c={WOOD} />
      {[-0.7, 0.7].map((z) => (
        <Box key={z} p={[0, 0.42, z]} s={[1.8, 0.07, 0.3]} c={WOOD} />
      ))}
      {[-0.7, 0.7].map((x) => (
        <Box key={x} p={[x, 0.38, 0]} s={[0.08, 0.76, 1.6]} c={WOOD_DARK} r={[0, 0, 0]} />
      ))}
    </group>
  )
}

function BallWasher() {
  return (
    <group>
      <Cyl p={[0, 0.5, 0]} r={0.05} h={1} c={IRON} seg={6} />
      <Box p={[0, 1.05, 0]} s={[0.3, 0.3, 0.2]} c="#2f4a35" />
      <Cyl p={[0, 0.03, 0]} r={0.28} h={0.06} c={STONE_DARK} seg={12} />
    </group>
  )
}

function TeeSign() {
  return (
    <group>
      {[-0.3, 0.3].map((x) => (
        <Cyl key={x} p={[x, 0.45, 0]} r={0.04} h={0.9} c={WOOD_DARK} seg={5} />
      ))}
      <Box p={[0, 0.85, 0.03]} s={[0.85, 0.55, 0.06]} c={PAPER} />
      <Box p={[0, 0.98, 0.07]} s={[0.5, 0.08, 0.01]} c="#2f4a35" />
      <Box p={[0, 0.82, 0.07]} s={[0.36, 0.06, 0.01]} c={RED} />
    </group>
  )
}

function Lamp() {
  return (
    <group>
      <Cyl p={[0, 1.3, 0]} r={0.06} h={2.6} c={IRON} seg={6} rTop={0.045} />
      <mesh position={[0, 2.72, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 0.32, 6]} />
        <meshLambertMaterial color="#f5e6b8" emissive="#f2d48a" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, 2.95, 0]} castShadow>
        <coneGeometry args={[0.28, 0.2, 6]} />
        <meshLambertMaterial color={IRON} />
      </mesh>
      <Cyl p={[0, 0.06, 0]} r={0.16} h={0.12} c={IRON} seg={8} />
    </group>
  )
}

function Bin() {
  return (
    <group>
      <Cyl p={[0, 0.4, 0]} r={0.25} h={0.8} c="#3f5530" seg={10} rTop={0.27} />
      <Cyl p={[0, 0.84, 0]} r={0.29} h={0.08} c={IRON} seg={10} />
    </group>
  )
}

const FLOWERS = [RED, PAPER, '#e4c35a', RED, '#c46a8e', PAPER]

function FlowerBed() {
  const dots = useMemo(() => {
    const out: { p: [number, number, number]; c: string }[] = []
    let s = 7
    const rand = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2
      const d = Math.sqrt(rand()) * 1.1
      out.push({ p: [Math.cos(a) * d, 0.22 + rand() * 0.12, Math.sin(a) * d * 0.7], c: FLOWERS[i % FLOWERS.length] })
    }
    return out
  }, [])
  return (
    <group>
      <mesh position={[0, 0.08, 0]} scale={[1, 1, 0.7]} receiveShadow castShadow>
        <cylinderGeometry args={[1.3, 1.4, 0.16, 20]} />
        <meshLambertMaterial color="#4a3a2a" />
      </mesh>
      {dots.map((d, i) => (
        <mesh key={i} position={d.p} castShadow>
          <icosahedronGeometry args={[0.13, 0]} />
          <meshLambertMaterial color={d.c} flatShading />
        </mesh>
      ))}
      <Blob p={[0.2, 0.25, 0]} r={0.35} c={LEAF} />
    </group>
  )
}

function Planter() {
  return (
    <group>
      <Box p={[0, 0.3, 0]} s={[1.1, 0.6, 1.1]} c={STONE} />
      <Box p={[0, 0.62, 0]} s={[1.25, 0.08, 1.25]} c={STONE_DARK} />
      <Blob p={[0, 0.95, 0]} r={0.48} c={LEAF_LIGHT} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.6) * 0.35, 1.18, Math.sin(i * 1.6) * 0.35]}>
          <icosahedronGeometry args={[0.1, 0]} />
          <meshLambertMaterial color={i % 2 ? RED : PAPER} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function Shrub() {
  return (
    <group>
      <Blob p={[0, 0.45, 0]} r={0.6} c={LEAF} />
      <Blob p={[0.35, 0.35, 0.15]} r={0.4} c={LEAF_LIGHT} />
      <Blob p={[-0.3, 0.32, -0.1]} r={0.38} c={LEAF} />
    </group>
  )
}

function Hedge() {
  return (
    <group>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 1.2, 0.9, 6, 3, 2]} />
        <meshLambertMaterial color={LEAF} />
      </mesh>
      {[-1.1, -0.35, 0.4, 1.1].map((x, i) => (
        <Blob key={x} p={[x, 1.2, 0]} r={0.42 + (i % 2) * 0.06} c={i % 2 ? LEAF_LIGHT : LEAF} />
      ))}
    </group>
  )
}

function Birch() {
  return (
    <group>
      {[
        [0, 0, 0.06],
        [0.35, 0.12, -0.1],
      ].map(([x, lean, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, 0, lean]}>
          <Cyl p={[0, 2, 0]} r={0.1} h={4} c={PAPER} seg={7} rTop={0.06} />
          {[0.8, 1.6, 2.5, 3.2].map((y) => (
            <Box key={y} p={[0, y, 0.08]} s={[0.12, 0.05, 0.05]} c="#2a2c2b" />
          ))}
        </group>
      ))}
      <Blob p={[0.15, 4.2, 0]} r={1.1} c="#6f8a4e" />
      <Blob p={[0.6, 3.6, 0.3]} r={0.8} c="#7d9a58" />
      <Blob p={[-0.4, 3.7, -0.2]} r={0.75} c="#5f7a44" />
    </group>
  )
}

function Rocks() {
  return (
    <group>
      <mesh position={[0, 0.35, 0]} scale={[1.2, 0.75, 1]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshLambertMaterial color="#8d9296" flatShading />
      </mesh>
      <mesh position={[0.75, 0.2, 0.3]} rotation={[0.4, 0.7, 0]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.38, 0]} />
        <meshLambertMaterial color="#a2a6a4" flatShading />
      </mesh>
      <mesh position={[-0.6, 0.16, 0.25]} rotation={[0.2, 1.2, 0.3]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.3, 0]} />
        <meshLambertMaterial color="#7b8083" flatShading />
      </mesh>
    </group>
  )
}

function Flagpole() {
  return (
    <group>
      <Cyl p={[0, 0.1, 0]} r={0.35} h={0.2} c={STONE} seg={10} />
      <Cyl p={[0, 2.6, 0]} r={0.05} h={5.2} c={PAPER} seg={6} rTop={0.035} />
      <mesh position={[0.62, 4.75, 0]} rotation={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.2, 0.72, 0.03, 4, 1, 1]} />
        <meshLambertMaterial color={RED} />
      </mesh>
      <mesh position={[0.62, 4.75, 0.02]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.36, 0.36, 0.01]} />
        <meshLambertMaterial color={PAPER} />
      </mesh>
      <mesh position={[0, 5.25, 0]}>
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshLambertMaterial color="#c9a24a" />
      </mesh>
    </group>
  )
}

function Birdbath() {
  return (
    <group>
      <Cyl p={[0, 0.08, 0]} r={0.35} h={0.16} c={STONE_DARK} seg={10} />
      <Cyl p={[0, 0.55, 0]} r={0.12} h={0.8} c={STONE} seg={8} rTop={0.1} />
      <Cyl p={[0, 1.0, 0]} r={0.3} h={0.14} c={STONE} seg={14} rTop={0.6} />
      <Cyl p={[0, 1.06, 0]} r={0.5} h={0.04} c={WATER} seg={14} />
    </group>
  )
}

function Fountain() {
  return (
    <group>
      <Cyl p={[0, 0.25, 0]} r={2.3} h={0.5} c={STONE} seg={24} />
      <Cyl p={[0, 0.48, 0]} r={2.05} h={0.08} c={WATER} seg={24} />
      <Cyl p={[0, 0.9, 0]} r={0.35} h={1} c={STONE_DARK} seg={10} />
      <Cyl p={[0, 1.45, 0]} r={0.55} h={0.18} c={STONE} seg={14} rTop={1.1} />
      <Cyl p={[0, 1.52, 0]} r={0.95} h={0.04} c={WATER} seg={14} />
      <Cyl p={[0, 1.95, 0]} r={0.14} h={0.8} c={STONE_DARK} seg={8} />
      {/* Spout of water */}
      <mesh position={[0, 2.55, 0]}>
        <coneGeometry args={[0.32, 0.6, 10]} />
        <meshLambertMaterial color="#cfdde4" transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

function Gazebo() {
  const posts = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 + Math.PI / 8)
  return (
    <group>
      <Cyl p={[0, 0.15, 0]} r={2.6} h={0.3} c={STONE} seg={8} />
      {posts.map((a) => (
        <Cyl key={a} p={[Math.cos(a) * 2.2, 1.45, Math.sin(a) * 2.2]} r={0.09} h={2.3} c={PAPER} seg={6} />
      ))}
      <Cyl p={[0, 2.65, 0]} r={2.55} h={0.18} c={PAPER} seg={8} />
      <mesh position={[0, 3.45, 0]} rotation={[0, Math.PI / 8, 0]} castShadow>
        <coneGeometry args={[2.9, 1.5, 8]} />
        <meshLambertMaterial color="#6d706a" />
      </mesh>
      <mesh position={[0, 4.3, 0]}>
        <sphereGeometry args={[0.14, 8, 6]} />
        <meshLambertMaterial color="#c9a24a" />
      </mesh>
      {/* Railing */}
      <Cyl p={[0, 0.85, 0]} r={2.25} h={0.06} c={PAPER} seg={8} />
    </group>
  )
}

function Statue() {
  return (
    <group>
      <Box p={[0, 0.5, 0]} s={[1.3, 1, 1.3]} c={STONE} />
      <Box p={[0, 1.05, 0]} s={[1.5, 0.1, 1.5]} c={STONE_DARK} />
      {/* A golfer at the finish of the swing, in weathered bronze */}
      <group position={[0, 1.1, 0]}>
        <Box p={[-0.13, 0.45, 0]} s={[0.16, 0.9, 0.18]} c="#6b6a52" />
        <Box p={[0.13, 0.45, 0.05]} s={[0.16, 0.9, 0.18]} c="#6b6a52" r={[0.15, 0, 0]} />
        <Box p={[0, 1.15, 0]} s={[0.45, 0.6, 0.28]} c="#74735a" r={[0, 0.4, 0]} />
        <mesh position={[0, 1.6, 0]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshLambertMaterial color="#74735a" />
        </mesh>
        <Box p={[-0.15, 1.6, -0.1]} s={[0.07, 0.07, 1.2]} c="#5f5e48" r={[-0.9, 0.6, 0]} />
      </group>
      {/* Plaque */}
      <Box p={[0, 0.55, 0.66]} s={[0.6, 0.3, 0.02]} c="#c9a24a" />
    </group>
  )
}

function ClockTower() {
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[2.6, 0.4, 2.6]} c={STONE_DARK} />
      <Box p={[0, 3.2, 0]} s={[1.9, 5.6, 1.9]} c="#e6dfcf" />
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh position={[0, 5.1, 0.96]}>
            <circleGeometry args={[0.6, 20]} />
            <meshLambertMaterial color={PAPER} />
          </mesh>
          <Box p={[0, 5.25, 0.98]} s={[0.05, 0.4, 0.02]} c={IRON} />
          <Box p={[0.12, 5.1, 0.98]} s={[0.3, 0.05, 0.02]} c={IRON} />
          <Box p={[0, 2.4, 0.96]} s={[0.6, 1.2, 0.04]} c="#5f7480" />
        </group>
      ))}
      <Box p={[0, 6.1, 0]} s={[2.2, 0.2, 2.2]} c="#6d706a" />
      <mesh position={[0, 7.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.6, 1.9, 4]} />
        <meshLambertMaterial color="#3f5530" />
      </mesh>
      <Cyl p={[0, 8.3, 0]} r={0.03} h={0.6} c={IRON} seg={4} />
    </group>
  )
}

function TreeDecor({ kind }: { kind: 'oak' | 'spruce' }) {
  const spec = useMemo<ConiferSpec[]>(
    () => [{ x: 0, z: 0, scale: kind === 'oak' ? 1.3 : 1.2, variant: 1 }],
    [kind],
  )
  return <Conifers trees={spec} broadleafEvery={kind === 'oak' ? 1 : 0} />
}

export const DecorModel = memo(function DecorModel({ kind }: { kind: DecorKind }) {
  switch (kind) {
    case 'bench':
      return <Bench />
    case 'picnic':
      return <Picnic />
    case 'ballwasher':
      return <BallWasher />
    case 'teesign':
      return <TeeSign />
    case 'lamp':
      return <Lamp />
    case 'bin':
      return <Bin />
    case 'flowerbed':
      return <FlowerBed />
    case 'planter':
      return <Planter />
    case 'shrub':
      return <Shrub />
    case 'hedge':
      return <Hedge />
    case 'oak':
    case 'spruce':
      return <TreeDecor kind={kind} />
    case 'birch':
      return <Birch />
    case 'rocks':
      return <Rocks />
    case 'flagpole':
      return <Flagpole />
    case 'birdbath':
      return <Birdbath />
    case 'fountain':
      return <Fountain />
    case 'gazebo':
      return <Gazebo />
    case 'statue':
      return <Statue />
    case 'clocktower':
      return <ClockTower />
  }
})
