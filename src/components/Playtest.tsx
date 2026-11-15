import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { aimPoint, createBall, stepBall, strike, type BallState } from '../game/physics'
import { drawHole } from '../game/render'
import { useGame } from '../game/store'
import type { Point } from '../game/types'

export function Playtest() {
  const hole = useGame((s) => s.getActiveHole())
  const setScreen = useGame((s) => s.setScreen)
  const recordPlay = useGame((s) => s.recordPlay)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<BallState | null>(null)
  const trailRef = useRef<Point[]>([])
  const aimRef = useRef<Point | null>(null)
  const dragging = useRef(false)
  const cellRef = useRef(10)
  const rafRef = useRef(0)

  const [strokes, setStrokes] = useState(0)
  const strokesRef = useRef(0)
  const isRange = hole?.kind === 'range'
  const [status, setStatus] = useState(
    'Drag from the ball to aim and set power.',
  )
  const [finished, setFinished] = useState(false)
  const [, bump] = useState(0)

  const resetBall = useCallback(() => {
    if (!hole) return
    ballRef.current = createBall(hole)
    trailRef.current = []
    aimRef.current = null
    strokesRef.current = 0
    setStrokes(0)
    setFinished(false)
    setStatus(
      hole.kind === 'range'
        ? 'Pull back from the bay and aim for the distance flag.'
        : 'Drag from the ball to aim and set power.',
    )
    bump((n) => n + 1)
  }, [hole])

  useEffect(() => {
    resetBall()
  }, [resetBall])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !hole || !ballRef.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const availW = wrap.clientWidth
    const availH = wrap.clientHeight
    const cell = Math.max(4, Math.floor(Math.min(availW / hole.width, availH / hole.height)))
    cellRef.current = cell
    canvas.width = hole.width * cell
    canvas.height = hole.height * cell

    const ball = ballRef.current
    drawHole(ctx, hole, {
      cell,
      ball: { x: ball.x, y: ball.y },
      trail: trailRef.current,
    })

    if (dragging.current && aimRef.current && !ball.moving) {
      const ax = ball.x * cell
      const ay = ball.y * cell
      const tx = aimRef.current.x * cell
      const ty = aimRef.current.y * cell
      ctx.strokeStyle = 'rgba(243, 247, 239, 0.65)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 5])
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      // Aim opposite of drag (pull-back)
      const dx = ax - (tx - ax)
      const dy = ay - (ty - ay)
      ctx.lineTo(dx, dy)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(dx, dy, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#e4d3a4'
      ctx.fill()
    }
  }, [hole])

  useEffect(() => {
    const loop = () => {
      const ball = ballRef.current
      if (ball && hole && ball.moving) {
        let next = ball
        for (let i = 0; i < 3; i++) next = stepBall(next, hole, 1)
        trailRef.current = [...trailRef.current.slice(-40), { x: next.x, y: next.y }]
        ballRef.current = next

        if (!next.moving) {
          if (next.sunk) {
            const s = strokesRef.current
            setFinished(true)
            setStatus(
              hole.kind === 'range'
                ? `Stuck the target in ${s} shot${s === 1 ? '' : 's'}.`
                : `In the cup — ${s} stroke${s === 1 ? '' : 's'} (par ${hole.par}).`,
            )
            recordPlay(s)
          } else if (next.water) {
            setStatus('Wet. Ball returned to tee — stroke penalty.')
            ballRef.current = createBall(hole)
            trailRef.current = []
            strokesRef.current += 1
            setStrokes(strokesRef.current)
          } else {
            setStatus('Ball at rest. Aim again.')
          }
        }
      }
      redraw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [hole, redraw, recordPlay])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => redraw())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [redraw])

  function toWorld(e: ReactPointerEvent): Point {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const cell = cellRef.current
    return {
      x: ((e.clientX - rect.left) * scaleX) / cell,
      y: ((e.clientY - rect.top) * scaleY) / cell,
    }
  }

  function onDown(e: ReactPointerEvent) {
    const ball = ballRef.current
    if (!ball || ball.moving || finished) return
    const p = toWorld(e)
    if (Math.hypot(p.x - ball.x, p.y - ball.y) > 3.5) return
    dragging.current = true
    aimRef.current = p
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onMove(e: ReactPointerEvent) {
    if (!dragging.current) return
    aimRef.current = toWorld(e)
  }

  function onUp(e: ReactPointerEvent) {
    if (!dragging.current || !ballRef.current || !aimRef.current) {
      dragging.current = false
      return
    }
    const ball = ballRef.current
    const aim = aimRef.current
    // Pull-back: direction opposite of drag
    const target = {
      x: ball.x - (aim.x - ball.x),
      y: ball.y - (aim.y - ball.y),
    }
    const { angle, power } = aimPoint({ x: ball.x, y: ball.y }, target)
    if (power > 0.4) {
      ballRef.current = strike(ball, angle, power)
      strokesRef.current += 1
      setStrokes(strokesRef.current)
      setStatus('Ball in motion…')
    }
    dragging.current = false
    aimRef.current = null
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  if (!hole) {
    return (
      <main className="course">
        <p>No hole selected.</p>
        <button className="btn btn--ghost" type="button" onClick={() => setScreen('editor')}>
          Back
        </button>
      </main>
    )
  }

  const vsPar = finished && !isRange ? strokes - hole.par : null
  const vsLabel =
    isRange && finished
      ? strokes <= 1
        ? 'Pure strike'
        : strokes <= 3
          ? 'Solid session'
          : 'Keep swinging'
      : vsPar === null
        ? null
        : vsPar <= -2
          ? 'Eagle or better'
          : vsPar === -1
            ? 'Birdie'
            : vsPar === 0
              ? 'Par'
              : vsPar === 1
                ? 'Bogey'
                : `+${vsPar}`

  return (
    <main className="playtest">
      <div className="playtest__hud">
        <div>
          <h1>{hole.name}</h1>
          <div className="playtest__meta">
            <span>{isRange ? 'Practice' : `Par ${hole.par}`}</span>
            <span>
              {isRange ? 'Shots' : 'Strokes'} <strong>{strokes}</strong>
            </span>
          </div>
        </div>
        <div className="topbar__actions">
          <button className="btn btn--ghost" type="button" onClick={resetBall}>
            Reset
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => setScreen('editor')}>
            Editor
          </button>
          <button className="btn btn--solid" type="button" onClick={() => setScreen('course')}>
            Park map
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="playtest__stage">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>

      <p className="playtest__help">{status}</p>

      {finished && (
        <div className="playtest__result">
          <strong>{vsLabel}</strong>
          <span>
            {isRange
              ? `${strokes} shot${strokes === 1 ? '' : 's'} to the flag`
              : `${strokes} strokes on a par ${hole.par}`}
          </span>
          <button className="btn btn--primary" type="button" onClick={resetBall}>
            {isRange ? 'Hit again' : 'Play again'}
          </button>
        </div>
      )}
    </main>
  )
}
