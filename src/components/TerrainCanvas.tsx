import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { drawHole } from '../game/render'
import type { Hole, Point } from '../game/types'

interface Props {
  hole: Hole
  brushRadius?: number
  showGrid?: boolean
  ball?: Point | null
  trail?: Point[]
  interactive?: boolean
  onPaint?: (x: number, y: number) => void
  onPlace?: (x: number, y: number) => void
  className?: string
}

export function TerrainCanvas({
  hole,
  brushRadius = 2.4,
  showGrid = false,
  ball = null,
  trail,
  interactive = true,
  onPaint,
  onPlace,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const painting = useRef(false)
  const highlight = useRef<Point | null>(null)
  const cellRef = useRef(10)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const availW = wrap.clientWidth
    const availH = wrap.clientHeight || availW * (hole.height / hole.width)
    const cell = Math.max(4, Math.floor(Math.min(availW / hole.width, availH / hole.height)))
    cellRef.current = cell
    canvas.width = hole.width * cell
    canvas.height = hole.height * cell

    drawHole(ctx, hole, {
      cell,
      showGrid,
      ball,
      trail,
      highlight: interactive ? highlight.current : null,
      brushRadius,
    })
  }, [hole, showGrid, ball, trail, brushRadius, interactive])

  useEffect(() => {
    redraw()
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => redraw())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [redraw])

  function toGrid(e: ReactPointerEvent): Point {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const cell = cellRef.current
    const x = ((e.clientX - rect.left) * scaleX) / cell
    const y = ((e.clientY - rect.top) * scaleY) / cell
    return {
      x: Math.max(0, Math.min(hole.width - 0.01, x)),
      y: Math.max(0, Math.min(hole.height - 0.01, y)),
    }
  }

  function handleDown(e: ReactPointerEvent) {
    if (!interactive) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    painting.current = true
    const p = toGrid(e)
    highlight.current = { x: Math.floor(p.x), y: Math.floor(p.y) }
    if (onPlace) onPlace(p.x, p.y)
    else onPaint?.(p.x, p.y)
    redraw()
  }

  function handleMove(e: ReactPointerEvent) {
    if (!interactive) return
    const p = toGrid(e)
    highlight.current = { x: Math.floor(p.x), y: Math.floor(p.y) }
    if (painting.current && onPaint) onPaint(p.x, p.y)
    redraw()
  }

  function handleUp(e: ReactPointerEvent) {
    painting.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  function handleLeave() {
    highlight.current = null
    painting.current = false
    redraw()
  }

  return (
    <div ref={wrapRef} className={className}>
      <canvas
        ref={canvasRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onPointerLeave={handleLeave}
      />
    </div>
  )
}
