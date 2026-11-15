import { shadeAt } from './terrain'
import { TERRAIN_FROM_INDEX, type Hole, type Point } from './types'

const COLORS: Record<string, [number, number, number]> = {
  rough: [62, 110, 58],
  fairway: [88, 158, 78],
  green: [120, 188, 98],
  bunker: [214, 186, 120],
  water: [58, 118, 148],
  tee: [72, 140, 72],
  path: [148, 128, 96],
}

function shadeRgb(rgb: [number, number, number], shade: number): string {
  return `rgb(${Math.round(rgb[0] * shade)},${Math.round(rgb[1] * shade)},${Math.round(rgb[2] * shade)})`
}

export function drawHole(
  ctx: CanvasRenderingContext2D,
  hole: Hole,
  opts: {
    cell: number
    showGrid?: boolean
    ball?: Point | null
    trail?: Point[]
    highlight?: Point | null
    brushRadius?: number
  },
) {
  const { cell } = opts
  const w = hole.width
  const h = hole.height

  ctx.clearRect(0, 0, w * cell, h * cell)

  // Atmospheric base
  const grad = ctx.createLinearGradient(0, 0, 0, h * cell)
  grad.addColorStop(0, '#8fb8a0')
  grad.addColorStop(1, '#5a8a68')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w * cell, h * cell)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = TERRAIN_FROM_INDEX[hole.terrain[y * w + x]] ?? 'rough'
      const shade = shadeAt(hole.elevation, x, y, w, h)
      ctx.fillStyle = shadeRgb(COLORS[t], shade)
      ctx.fillRect(x * cell, y * cell, cell + 0.6, cell + 0.6)
    }
  }

  // Subtle contour lines
  ctx.strokeStyle = 'rgba(20, 40, 28, 0.08)'
  ctx.lineWidth = 1
  for (let level = 0.3; level <= 0.8; level += 0.15) {
    ctx.beginPath()
    let drawing = false
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const e = hole.elevation[y * w + x]
        const crossed =
          (hole.elevation[y * w + (x - 1)] - level) * (e - level) < 0
        if (crossed) {
          if (!drawing) {
            ctx.moveTo(x * cell, y * cell)
            drawing = true
          } else {
            ctx.lineTo(x * cell, y * cell)
          }
        }
      }
    }
    ctx.stroke()
  }

  if (opts.showGrid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let x = 0; x <= w; x++) {
      ctx.beginPath()
      ctx.moveTo(x * cell, 0)
      ctx.lineTo(x * cell, h * cell)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * cell)
      ctx.lineTo(w * cell, y * cell)
      ctx.stroke()
    }
  }

  // Tee box marker
  drawMarker(ctx, hole.tee.x, hole.tee.y, cell, '#f0e6c8', 'T')

  // Flag / pin
  drawFlag(ctx, hole.pin.x, hole.pin.y, cell)

  if (opts.trail && opts.trail.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    opts.trail.forEach((p, i) => {
      const px = p.x * cell
      const py = p.y * cell
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }

  if (opts.ball) {
    const bx = opts.ball.x * cell
    const by = opts.ball.y * cell
    ctx.beginPath()
    ctx.arc(bx, by, Math.max(3.5, cell * 0.35), 0, Math.PI * 2)
    ctx.fillStyle = '#f7f4ee'
    ctx.fill()
    ctx.strokeStyle = 'rgba(30,40,30,0.35)'
    ctx.stroke()
  }

  if (opts.highlight && opts.brushRadius) {
    ctx.beginPath()
    ctx.arc(
      opts.highlight.x * cell + cell / 2,
      opts.highlight.y * cell + cell / 2,
      opts.brushRadius * cell,
      0,
      Math.PI * 2,
    )
    ctx.strokeStyle = 'rgba(255, 248, 220, 0.55)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  color: string,
  label: string,
) {
  const px = x * cell + cell / 2
  const py = y * cell + cell / 2
  ctx.beginPath()
  ctx.arc(px, py, cell * 0.9, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.fillStyle = '#2a3a28'
  ctx.font = `600 ${Math.max(9, cell * 0.7)}px "Plus Jakarta Sans", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, px, py + 0.5)
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  const px = x * cell + cell / 2
  const py = y * cell + cell / 2
  // Cup
  ctx.beginPath()
  ctx.arc(px, py, cell * 0.45, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1a1a'
  ctx.fill()
  // Pole
  ctx.strokeStyle = '#f2e8d5'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(px, py - cell * 3.2)
  ctx.stroke()
  // Flag
  ctx.beginPath()
  ctx.moveTo(px, py - cell * 3.2)
  ctx.lineTo(px + cell * 2.2, py - cell * 2.5)
  ctx.lineTo(px, py - cell * 1.8)
  ctx.closePath()
  ctx.fillStyle = '#c45c26'
  ctx.fill()
}

export function holeThumbnail(hole: Hole, size = 160): string {
  const canvas = document.createElement('canvas')
  const cell = size / Math.max(hole.width, hole.height)
  canvas.width = hole.width * cell
  canvas.height = hole.height * cell
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  drawHole(ctx, hole, { cell })
  return canvas.toDataURL('image/png')
}
