import { useCallback, useEffect, useRef, useState } from 'react'
import { aimPoint, createBall, stepBall, strike, type BallState } from '../game/physics'
import { CADDIE_FEE, CART_RENTAL_FEE, beverageCartsReady } from '../game/staff'
import { useGame } from '../game/store'
import type { Point } from '../game/types'
import { PlaytestScene } from '../scene3d/PlaytestScene'

export function Playtest() {
  const hole = useGame((s) => s.getActiveHole())
  const setScreen = useGame((s) => s.setScreen)
  const closeHole = useGame((s) => s.closeHole)
  const recordPlay = useGame((s) => s.recordPlay)
  const caddiesAvailable = useGame((s) => s.caddiesAvailable)
  const cartsReady = useGame((s) => s.cartsReady)
  const chargeCaddieFee = useGame((s) => s.chargeCaddieFee)
  const chargeCartRental = useGame((s) => s.chargeCartRental)
  const staff = useGame((s) => s.staff)
  const carts = useGame((s) => s.carts)
  const drinksOn = beverageCartsReady(staff, carts)

  const ballRef = useRef<BallState | null>(null)
  const trailRef = useRef<Point[]>([])
  const aimRef = useRef<Point | null>(null)
  const dragging = useRef(false)
  const rafRef = useRef(0)

  const [strokes, setStrokes] = useState(0)
  const strokesRef = useRef(0)
  const isRange = hole?.kind === 'range'
  const [status, setStatus] = useState('Drag near the ball to aim and set power.')
  const [finished, setFinished] = useState(false)
  const [useCaddie, setUseCaddie] = useState(false)
  const [useCart, setUseCart] = useState(false)
  const [extrasNote, setExtrasNote] = useState<string | null>(null)
  const caddieCharged = useRef(false)
  const cartCharged = useRef(false)
  const useCaddieRef = useRef(false)
  useCaddieRef.current = useCaddie

  const resetBall = useCallback(() => {
    if (!hole) return
    ballRef.current = createBall(hole)
    trailRef.current = []
    aimRef.current = null
    strokesRef.current = 0
    caddieCharged.current = false
    cartCharged.current = false
    setStrokes(0)
    setFinished(false)
    setExtrasNote(null)
    setStatus(
      hole.kind === 'range'
        ? 'Pull back from the bay and aim for the distance flag.'
        : 'Drag near the ball to aim and set power.',
    )
  }, [hole])

  useEffect(() => {
    resetBall()
  }, [resetBall])

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
            recordPlay(s, useCaddieRef.current && caddieCharged.current)
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
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [hole, recordPlay])

  function toggleCaddie() {
    if (!caddiesAvailable()) {
      setExtrasNote('Hire a caddie from Staff first.')
      return
    }
    if (useCaddie) {
      setUseCaddie(false)
      setExtrasNote('Walking without a caddie.')
      return
    }
    if (!caddieCharged.current) {
      const result = chargeCaddieFee()
      if (!result.ok) {
        setExtrasNote(result.message)
        return
      }
      caddieCharged.current = true
      setExtrasNote(result.message)
    }
    setUseCaddie(true)
  }

  function toggleCart() {
    if (!cartsReady()) {
      setExtrasNote('Buy a cart for the fleet first (Staff).')
      return
    }
    if (useCart) {
      setUseCart(false)
      setExtrasNote('Walking the hole.')
      return
    }
    if (!cartCharged.current) {
      const result = chargeCartRental()
      if (!result.ok) {
        setExtrasNote(result.message)
        return
      }
      cartCharged.current = true
      setExtrasNote(result.message)
    }
    setUseCart(true)
  }

  function onAimDown(p: Point) {
    const ball = ballRef.current
    if (!ball || ball.moving || finished) return
    if (Math.hypot(p.x - ball.x, p.y - ball.y) > 5) return
    dragging.current = true
    aimRef.current = p
  }

  function onAimMove(p: Point) {
    if (!dragging.current) return
    aimRef.current = p
  }

  function onAimUp() {
    if (!dragging.current || !ballRef.current || !aimRef.current) {
      dragging.current = false
      return
    }
    const ball = ballRef.current
    const aim = aimRef.current
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
  }

  if (!hole) {
    return (
      <main className="course">
        <p>No hole selected.</p>
        <button className="btn btn--ghost" type="button" onClick={() => setScreen('course')}>
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
    <main className="playtest playtest--3d">
      <div className="playtest__hud">
        <div>
          <h1>{hole.name}</h1>
          <div className="playtest__meta">
            <span>{isRange ? 'Practice' : `Par ${hole.par}`}</span>
            <span>
              {isRange ? 'Shots' : 'Strokes'} <strong>{strokes}</strong>
            </span>
            <span className="zoo-chip zoo-chip--live">3D</span>
          </div>
        </div>
        <div className="topbar__actions">
          <button className="btn btn--ghost" type="button" onClick={resetBall}>
            Reset
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => setScreen('course')}>
            Edit hole
          </button>
          <button className="btn btn--solid" type="button" onClick={() => {
              closeHole()
              setScreen('course')
            }}>
            Course
          </button>
        </div>
      </div>

      <div className="playtest__stage playtest__stage--3d">
        <PlaytestScene
          hole={hole}
          ballRef={ballRef}
          trailRef={trailRef}
          aimRef={aimRef}
          draggingRef={dragging}
          useCart={useCart}
          onPointerAim={{ onDown: onAimDown, onMove: onAimMove, onUp: onAimUp }}
        />
      </div>

      <p className="playtest__help">{status}</p>

      {!isRange && (
        <div className="playtest__extras">
          <button
            type="button"
            className={`tool-chip${useCaddie ? ' tool-chip--active' : ''}`}
            onClick={toggleCaddie}
            disabled={!caddiesAvailable() && !useCaddie}
          >
            Caddie · ${CADDIE_FEE}
            {!caddiesAvailable() ? ' (none staffed)' : ''}
          </button>
          <button
            type="button"
            className={`tool-chip${useCart ? ' tool-chip--active' : ''}`}
            onClick={toggleCart}
            disabled={!cartsReady() && !useCart}
          >
            Rent cart · ${CART_RENTAL_FEE}
            {!cartsReady() ? ' (no fleet)' : ''}
          </button>
          {drinksOn && (
            <span className="staff-pill staff-pill--ok">Beverage cart on the course</span>
          )}
          {extrasNote && <span className="playtest__extra-note">{extrasNote}</span>}
        </div>
      )}

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
