import { shadeAt } from './terrain'
import { TERRAIN_FROM_INDEX, type Hole, type Point } from './types'

/** Painted-course palette — muted sage, olive, chalk and slate (matches the 3D view) */
const COLORS: Record<string, [number, number, number]> = {
  rough: [108, 136, 78],
  fairway: [124, 152, 88],
  green: [182, 200, 154],
  bunker: [238, 235, 222],
  water: [44, 70, 96],
  tee: [134, 160, 98],
  path: [206, 202, 190],
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

  // Soft daylight wash
  const grad = ctx.createLinearGradient(0, 0, 0, h * cell)
  grad.addColorStop(0, '#8fa07a')
  grad.addColorStop(1, '#55703d')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w * cell, h * cell)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = TERRAIN_FROM_INDEX[hole.terrain[y * w + x]] ?? 'rough'
      const shade = shadeAt(hole.elevation, x, y, w, h)
      // Slight height extrusion cue — stronger so land sculpt reads clearly
      const lift = hole.elevation[y * w + x]
      if (t === 'water') {
        const depth = 1 - lift
        const rip = 0.88 + 0.12 * Math.sin(x * 0.9 + y * 0.55)
        ctx.fillStyle = shadeRgb(
          COLORS.water,
          (0.72 + depth * 0.35) * rip * (0.94 + shade * 0.08),
        )
      } else {
        // Loose painterly mottling so flat areas read as brushwork, not pixels
        const dab = 0.95 + 0.1 * (Math.sin(x * 0.37 + y * 0.21) * Math.cos(y * 0.29 - x * 0.13))
        ctx.fillStyle = shadeRgb(COLORS[t], shade * (0.86 + lift * 0.28) * dab)
      }
      ctx.fillRect(x * cell, y * cell, cell + 0.7, cell + 0.7)
    }
  }

  // Soft water specular highlights
  ctx.save()
  ctx.globalAlpha = 0.22
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (TERRAIN_FROM_INDEX[hole.terrain[y * w + x]] !== 'water') continue
      if ((x + y) % 5 !== 0) continue
      ctx.fillStyle = '#c9d3d6'
      ctx.fillRect(x * cell + cell * 0.2, y * cell + cell * 0.15, cell * 0.45, cell * 0.25)
    }
  }
  ctx.restore()

  // Soft contour rings
  ctx.strokeStyle = 'rgba(40, 70, 40, 0.1)'
  ctx.lineWidth = 1
  for (let level = 0.28; level <= 0.78; level += 0.14) {
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
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    for (let x = 0; x <= w; x += 4) {
      ctx.beginPath()
      ctx.moveTo(x * cell, 0)
      ctx.lineTo(x * cell, h * cell)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y += 4) {
      ctx.beginPath()
      ctx.moveTo(0, y * cell)
      ctx.lineTo(w * cell, y * cell)
      ctx.stroke()
    }
  }

  // Ghost markers on raw land so you know where to build
  if (hole.buildStage === 'raw' && hole.kind === 'hole') {
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.setLineDash([5, 5])
    ctx.strokeStyle = '#fff8e0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(hole.tee.x * cell + cell / 2, hole.tee.y * cell + cell / 2, cell * 2.2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(hole.pin.x * cell + cell / 2, hole.pin.y * cell + cell / 2, cell * 3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#fff8e0'
    ctx.font = `600 ${Math.max(10, cell)}px "Nunito Sans", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('build tee', hole.tee.x * cell + cell / 2, hole.tee.y * cell - cell)
    ctx.fillText('build green', hole.pin.x * cell + cell / 2, hole.pin.y * cell - cell * 1.2)
    ctx.restore()
  }

  drawMarker(ctx, hole.tee.x, hole.tee.y, cell, '#f4ecd8', 'T')
  drawFlag(ctx, hole.pin.x, hole.pin.y, cell)

  if (opts.trail && opts.trail.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
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
    ctx.fillStyle = '#fbfaf6'
    ctx.fill()
    ctx.strokeStyle = 'rgba(30,40,30,0.3)'
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
    ctx.strokeStyle = 'rgba(255, 248, 220, 0.7)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 4])
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
  ctx.font = `700 ${Math.max(9, cell * 0.7)}px "Nunito Sans", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, px, py + 0.5)
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  const px = x * cell + cell / 2
  const py = y * cell + cell / 2
  ctx.beginPath()
  ctx.arc(px, py, cell * 0.45, 0, Math.PI * 2)
  ctx.fillStyle = '#1a1a1a'
  ctx.fill()
  ctx.strokeStyle = '#f2e8d5'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(px, py - cell * 3.2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(px, py - cell * 3.2)
  ctx.lineTo(px + cell * 2.2, py - cell * 2.5)
  ctx.lineTo(px, py - cell * 1.8)
  ctx.closePath()
  ctx.fillStyle = '#b0392e'
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
