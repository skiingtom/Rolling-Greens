import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { holeThumbnail } from '../game/render'
import { ratingLabel } from '../game/rating'
import { useGame } from '../game/store'
import {
  COURSES,
  RANGE_UPGRADE_COST,
  WORLD_H,
  WORLD_W,
  milestoneLabel,
  nextHoleCost,
  type Hole,
} from '../game/types'
import {
  CLUBHOUSE,
  ROAD_PATH,
  fieldPatches,
  holeMapPosition,
  nextBuildTarget,
  phaseCopy,
} from '../game/world'

function ParcelThumb({ hole }: { hole: Hole }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    setSrc(holeThumbnail(hole, 140))
  }, [hole])
  if (!src) return <div className="parcel__thumb parcel__thumb--empty" />
  return <img className="parcel__thumb" src={src} alt="" draggable={false} />
}

function roadPathD(): string {
  const [first, ...rest] = ROAD_PATH
  let d = `M ${first.x} ${first.y}`
  for (let i = 0; i < rest.length; i++) {
    const p = rest[i]
    const prev = i === 0 ? first : rest[i - 1]
    const cx = (prev.x + p.x) / 2
    d += ` Q ${cx} ${prev.y} ${p.x} ${p.y}`
  }
  return d
}

export function WorldMap() {
  const holes = useGame((s) => s.holes)
  const clubName = useGame((s) => s.clubName)
  const budget = useGame((s) => s.budget)
  const reputation = useGame((s) => s.reputation)
  const rangeSize = useGame((s) => s.rangeSize)
  const mapFocusX = useGame((s) => s.mapFocusX)
  const mapFocusY = useGame((s) => s.mapFocusY)
  const openHole = useGame((s) => s.openHole)
  const buildNextHole = useGame((s) => s.buildNextHole)
  const expandRange = useGame((s) => s.expandRange)
  const setMapFocus = useGame((s) => s.setMapFocus)

  const viewportRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const [cam, setCam] = useState({ x: mapFocusX, y: mapFocusY })
  const [toast, setToast] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.72)

  const patches = useMemo(() => fieldPatches(7), [])
  const courseHoles = holes.filter((h) => h.kind === 'hole')
  const range = holes.find((h) => h.kind === 'range')
  const count = courseHoles.length
  const target = nextBuildTarget(count)
  const cost = nextHoleCost(count)
  const phase = phaseCopy(count)
  const buildPos = target ? holeMapPosition(target.courseId, target.number) : null

  useEffect(() => {
    setCam({ x: mapFocusX, y: mapFocusY })
  }, [mapFocusX, mapFocusY])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3400)
    return () => window.clearTimeout(t)
  }, [toast])

  function panBy(dx: number, dy: number) {
    setCam((c) => ({
      x: Math.max(200, Math.min(WORLD_W - 200, c.x - dx / zoom)),
      y: Math.max(200, Math.min(WORLD_H - 200, c.y - dy / zoom)),
    }))
  }

  function onPointerDown(e: ReactPointerEvent) {
    if ((e.target as HTMLElement).closest('[data-parcel], [data-ui]')) return
    dragging.current = true
    last.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!dragging.current) return
    panBy(e.clientX - last.current.x, e.clientY - last.current.y)
    last.current = { x: e.clientX, y: e.clientY }
  }

  function onPointerUp(e: ReactPointerEvent) {
    dragging.current = false
    setMapFocus(cam.x, cam.y)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    setZoom((z) => Math.max(0.4, Math.min(1.15, z - e.deltaY * 0.001)))
  }

  function claimLand() {
    const result = buildNextHole()
    setToast(result.message)
  }

  function onExpandRange() {
    const result = expandRange()
    setToast(result.message)
  }

  const transform = `translate(50%, 50%) translate(${-cam.x * zoom}px, ${-cam.y * zoom}px) scale(${zoom})`

  return (
    <main className="world">
      <div className="world__hud" data-ui>
        <div>
          <h1>{clubName}</h1>
          <p className="world__milestone">{milestoneLabel(count, rangeSize)}</p>
        </div>
        <div className="world__progress">
          <div className="world__meter">
            <span>Holes</span>
            <strong>
              {count}/36
            </strong>
            <div className="world__bar">
              <i style={{ width: `${(count / 36) * 100}%` }} />
            </div>
          </div>
          <div className="world__courses">
            {COURSES.map((c) => {
              const n = courseHoles.filter((h) => h.courseId === c.id).length
              return (
                <span key={c.id}>
                  {c.name} <strong>{n}/18</strong>
                </span>
              )
            })}
            <span>
              Range <strong>{rangeSize === 'large' ? 'Grand' : 'Starter'}</strong>
            </span>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="world__viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div className="world__plane" style={{ width: WORLD_W, height: WORLD_H, transform }}>
          <div className="world__sky-wash" />
          {patches.map((p, i) => (
            <div
              key={i}
              className="world__field"
              style={{
                left: p.x,
                top: p.y,
                width: p.w,
                height: p.h,
                opacity: p.tone,
              }}
            />
          ))}

          <svg className="world__road" width={WORLD_W} height={WORLD_H}>
            <path d={roadPathD()} className="world__road-shoulder" />
            <path d={roadPathD()} className="world__road-asphalt" />
            <path d={roadPathD()} className="world__road-dash" />
          </svg>

          <div
            className="world__clubhouse"
            style={{ left: CLUBHOUSE.x, top: CLUBHOUSE.y, width: CLUBHOUSE.w, height: CLUBHOUSE.h }}
          >
            <div className="world__clubhouse-roof" />
            <div className="world__clubhouse-body">
              <span>Clubhouse</span>
            </div>
            <div className="world__clubhouse-porch" />
          </div>

          <div className="world__road-sign" style={{ left: CLUBHOUSE.x - 90, top: CLUBHOUSE.y + 120 }}>
            County Rd 7
          </div>

          {range && (
            <button
              type="button"
              data-parcel
              className={`parcel parcel--range${rangeSize === 'large' ? ' parcel--range-large' : ''}`}
              style={{ left: range.mapX, top: range.mapY }}
              onClick={() => openHole(range.id)}
            >
              <ParcelThumb hole={range} />
              <div className="parcel__label">
                <strong>{range.name}</strong>
                <span>
                  {range.rating !== null
                    ? `${range.rating} · ${ratingLabel(range.rating, 'range')}`
                    : 'Open bays'}
                </span>
              </div>
            </button>
          )}

          {courseHoles.map((hole) => (
            <button
              key={hole.id}
              type="button"
              data-parcel
              className={`parcel parcel--hole parcel--${hole.courseId}`}
              style={{ left: hole.mapX, top: hole.mapY }}
              onClick={() => openHole(hole.id)}
            >
              <ParcelThumb hole={hole} />
              <div className="parcel__label">
                <strong>
                  #{hole.number} · Par {hole.par}
                </strong>
                <span>
                  {hole.rating !== null
                    ? `${hole.rating} · ${ratingLabel(hole.rating, 'hole')}`
                    : hole.name}
                </span>
              </div>
            </button>
          ))}

          {buildPos && (
            <button
              type="button"
              data-parcel
              className="parcel parcel--claim"
              style={{ left: buildPos.x, top: buildPos.y }}
              onClick={claimLand}
            >
              <div className="parcel__claim-inner">
                <span className="parcel__claim-kicker">Shape land</span>
                <strong>
                  {target?.courseId === 'a' ? 'North' : 'South'} {target?.number}
                </strong>
                <span className="parcel__claim-cost">${cost.toLocaleString()}</span>
              </div>
            </button>
          )}

          {/* Ghost future slots for atmosphere */}
          {count < 36 &&
            Array.from({ length: Math.min(4, 36 - count - 1) }, (_, i) => {
              const ghost = nextBuildTarget(count + 1 + i)
              if (!ghost) return null
              const pos = holeMapPosition(ghost.courseId, ghost.number)
              return (
                <div
                  key={`ghost-${ghost.courseId}-${ghost.number}`}
                  className="parcel parcel--ghost"
                  style={{ left: pos.x, top: pos.y }}
                />
              )
            })}
        </div>
      </div>

      <aside className="world__dock" data-ui>
        <div>
          <h2>{phase.title}</h2>
          <p>{phase.detail}</p>
        </div>
        <div className="world__dock-actions">
          {target && (
            <button className="btn btn--primary" type="button" onClick={claimLand}>
              Claim land · ${cost.toLocaleString()}
            </button>
          )}
          {rangeSize === 'starter' && (
            <button className="btn btn--ghost" type="button" onClick={onExpandRange}>
              Expand range · ${RANGE_UPGRADE_COST.toLocaleString()}
            </button>
          )}
          <div className="world__zoom">
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            >
              −
            </button>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => {
                setCam({ x: CLUBHOUSE.x + 40, y: CLUBHOUSE.y })
                setMapFocus(CLUBHOUSE.x + 40, CLUBHOUSE.y)
              }}
            >
              Clubhouse
            </button>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => setZoom((z) => Math.min(1.15, z + 0.1))}
            >
              +
            </button>
          </div>
          <p className="world__hint">
            Drag to pan the grounds · Budget ${budget.toLocaleString()} · Rep {reputation}
          </p>
        </div>
      </aside>

      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}
