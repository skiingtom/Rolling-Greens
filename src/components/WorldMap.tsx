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
  PLAZA_PATH,
  ROAD_PATH,
  fieldPatches,
  holeMapPosition,
  nextBuildTarget,
  parkBushes,
  parkGuests,
  parkPonds,
  parkTrees,
  phaseCopy,
} from '../game/world'
import { StaffPanel } from './StaffPanel'
import { beverageCartsReady, totalStaff } from '../game/staff'

function ParcelThumb({ hole }: { hole: Hole }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    setSrc(holeThumbnail(hole, 180))
  }, [hole])
  if (!src) return <div className="habitat__floor habitat__floor--empty" />
  return <img className="habitat__floor" src={src} alt="" draggable={false} />
}

function stageLabel(hole: Hole): string {
  if (hole.kind === 'range') {
    return hole.rating !== null
      ? `${hole.rating} · ${ratingLabel(hole.rating, 'range')}`
      : 'Open for guests'
  }
  if (hole.rating !== null) return `${hole.rating} · ${ratingLabel(hole.rating, 'hole')}`
  if (hole.buildStage === 'raw') return 'Raw habitat'
  if (hole.buildStage === 'terraformed') return 'Terraforming'
  if (hole.buildStage === 'built') return 'Ready to open'
  return hole.name
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

function plazaPathD(): string {
  const [a, b, c] = PLAZA_PATH
  return `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y}`
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
  const advanceWeek = useGame((s) => s.advanceWeek)
  const setMapFocus = useGame((s) => s.setMapFocus)
  const staff = useGame((s) => s.staff)
  const carts = useGame((s) => s.carts)

  const viewportRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const [cam, setCam] = useState({ x: mapFocusX, y: mapFocusY })
  const [toast, setToast] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1.05)
  const [viewSize, setViewSize] = useState({ w: 1200, h: 600 })
  const [staffOpen, setStaffOpen] = useState(false)
  const crew = totalStaff(staff)
  const drinksOn = beverageCartsReady(staff, carts)

  const patches = useMemo(() => fieldPatches(7), [])
  const trees = useMemo(() => parkTrees(5), [])
  const bushes = useMemo(() => parkBushes(9), [])
  const ponds = useMemo(() => parkPonds(), [])
  const guests = useMemo(() => parkGuests(4), [])
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
    const el = viewportRef.current
    if (!el) return
    const measure = () => setViewSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
    setZoom((z) => Math.max(0.45, Math.min(1.25, z - e.deltaY * 0.001)))
  }

  function claimLand() {
    const result = buildNextHole()
    setToast(result.message)
  }

  function onExpandRange() {
    const result = expandRange()
    setToast(result.message)
  }

  function onCollectFees() {
    const { net, week: nextWeek, summary } = advanceWeek()
    setToast(
      `Week ${nextWeek} · net ${net >= 0 ? '+' : ''}$${net.toLocaleString()} · ${summary}`,
    )
  }

  // Strong isometric park-builder camera (Planet Zoo–like tilt)
  const transform = `translate(${viewSize.w / 2 - cam.x * zoom}px, ${viewSize.h / 2 - cam.y * zoom * 0.78}px) scale(${zoom}) skewX(-22deg) scaleY(0.64)`

  return (
    <main className="world">
      <div className="world__hud zoo-panel" data-ui>
        <div className="world__hud-brand">
          <div className="zoo-badge" aria-hidden>
            RG
          </div>
          <div>
            <h1>{clubName}</h1>
            <p className="world__milestone">{milestoneLabel(count, rangeSize)}</p>
          </div>
        </div>
        <div className="world__progress">
          <div className="world__meter">
            <span>Course</span>
            <strong>{count}/36</strong>
            <div className="world__bar">
              <i style={{ width: `${(count / 36) * 100}%` }} />
            </div>
          </div>
          <div className="world__courses">
            {COURSES.map((c) => {
              const n = courseHoles.filter((h) => h.courseId === c.id).length
              return (
                <span key={c.id} className="zoo-chip">
                  {c.name} <strong>{n}/18</strong>
                </span>
              )
            })}
            <span className="zoo-chip">
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
        <div className="world__clouds" aria-hidden>
          <span className="world__cloud world__cloud--a" />
          <span className="world__cloud world__cloud--b" />
          <span className="world__cloud world__cloud--c" />
        </div>

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

          {ponds.map((p, i) => (
            <div
              key={`pond-${i}`}
              className="world__pond"
              style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
            />
          ))}

          {bushes.map((b, i) => (
            <div
              key={`bush-${i}`}
              className="world__bush"
              style={{
                left: b.x,
                top: b.y,
                transform: `translate(-50%, -70%) scale(${b.scale})`,
              }}
            />
          ))}

          {/* Trees after parcels so canopy overlaps habitat edges */}
          <svg className="world__road" width={WORLD_W} height={WORLD_H}>
            <path d={roadPathD()} className="world__road-shoulder" />
            <path d={roadPathD()} className="world__road-asphalt" />
            <path d={roadPathD()} className="world__road-dash" />
            <path d={plazaPathD()} className="world__plaza" />
          </svg>

          <div
            className="world__clubhouse"
            style={{ left: CLUBHOUSE.x, top: CLUBHOUSE.y, width: CLUBHOUSE.w + 20, height: CLUBHOUSE.h + 20 }}
          >
            <div className="world__clubhouse-shadow" />
            <div className="world__clubhouse-wing world__clubhouse-wing--l" />
            <div className="world__clubhouse-wing world__clubhouse-wing--r" />
            <div className="world__clubhouse-roof" />
            <div className="world__clubhouse-body">
              <span className="world__clubhouse-window" />
              <span className="world__clubhouse-window" />
              <span className="world__clubhouse-door" />
            </div>
            <div className="world__clubhouse-awning" />
            <div className="world__clubhouse-label">Clubhouse</div>
          </div>

          {carts > 0 && (
            <div
              className="world__cart-barn"
              style={{ left: CLUBHOUSE.x + 150, top: CLUBHOUSE.y + 40 }}
              title={`${carts} cart${carts === 1 ? '' : 's'} in fleet`}
            >
              <span className="world__cart-barn-icon" />
              <span>Carts · {carts}</span>
            </div>
          )}

          {drinksOn &&
            Array.from({ length: Math.min(3, staff.beverage) }, (_, i) => (
              <div
                key={`bev-${i}`}
                className="world__bev-cart"
                style={{
                  left: CLUBHOUSE.x + 220 + i * 90,
                  top: CLUBHOUSE.y - 80 - i * 40,
                  animationDelay: `${i * 1.4}s`,
                }}
                title="Beverage cart"
              />
            ))}

          <div className="world__road-sign" style={{ left: CLUBHOUSE.x - 110, top: CLUBHOUSE.y + 130 }}>
            County Rd 7
          </div>

          {range && (
            <button
              type="button"
              data-parcel
              className={`habitat habitat--range${rangeSize === 'large' ? ' habitat--range-large' : ''}`}
              style={{ left: range.mapX, top: range.mapY }}
              onClick={() => openHole(range.id)}
            >
              <div className="habitat__fence" />
              <span className="habitat__post habitat__post--nw" />
              <span className="habitat__post habitat__post--ne" />
              <span className="habitat__post habitat__post--sw" />
              <span className="habitat__post habitat__post--se" />
              <span className="habitat__gate" />
              <ParcelThumb hole={range} />
              <div className="habitat__tag">
                <strong>{range.name}</strong>
                <span>{stageLabel(range)}</span>
              </div>
            </button>
          )}

          {courseHoles.map((hole) => (
            <button
              key={hole.id}
              type="button"
              data-parcel
              className={`habitat habitat--hole habitat--${hole.courseId} habitat--stage-${hole.buildStage}`}
              style={{ left: hole.mapX, top: hole.mapY }}
              onClick={() => openHole(hole.id)}
            >
              <div className="habitat__fence" />
              <span className="habitat__post habitat__post--nw" />
              <span className="habitat__post habitat__post--ne" />
              <span className="habitat__post habitat__post--sw" />
              <span className="habitat__post habitat__post--se" />
              <span className="habitat__gate" />
              <ParcelThumb hole={hole} />
              <div className="habitat__tag">
                <strong>
                  #{hole.number} · Par {hole.par}
                </strong>
                <span>{stageLabel(hole)}</span>
              </div>
            </button>
          ))}

          {buildPos && (
            <button
              type="button"
              data-parcel
              className="habitat habitat--claim"
              style={{ left: buildPos.x, top: buildPos.y }}
              onClick={claimLand}
            >
              <div className="habitat__fence habitat__fence--dashed" />
              <span className="habitat__post habitat__post--nw" />
              <span className="habitat__post habitat__post--ne" />
              <span className="habitat__post habitat__post--sw" />
              <span className="habitat__post habitat__post--se" />
              <div className="habitat__claim">
                <span className="habitat__claim-kicker">New habitat</span>
                <strong>
                  {target?.courseId === 'a' ? 'North' : 'South'} {target?.number}
                </strong>
                <span className="habitat__claim-cost">${cost.toLocaleString()}</span>
                <span className="habitat__claim-note">Claim &amp; terraform</span>
              </div>
            </button>
          )}

          {count < 36 &&
            Array.from({ length: Math.min(4, 36 - count - 1) }, (_, i) => {
              const ghost = nextBuildTarget(count + 1 + i)
              if (!ghost) return null
              const pos = holeMapPosition(ghost.courseId, ghost.number)
              return (
                <div
                  key={`ghost-${ghost.courseId}-${ghost.number}`}
                  className="habitat habitat--ghost"
                  style={{ left: pos.x, top: pos.y }}
                />
              )
            })}

          {guests.map((g, i) => (
            <div
              key={`guest-${i}`}
              className="world__guest"
              style={{
                left: g.x,
                top: g.y,
                ['--guest-hue' as string]: String(g.hue),
                ['--guest-delay' as string]: `${g.delay}s`,
                ['--guest-span' as string]: `${g.span}px`,
                zIndex: 5 + Math.floor(g.y / 40),
              }}
            />
          ))}

          {trees.map((t, i) => (
            <div
              key={`tree-${i}`}
              className={`world__tree world__tree--${t.variant}`}
              style={{
                left: t.x,
                top: t.y,
                transform: `translate(-50%, -88%) scale(${t.scale})`,
                zIndex: 6 + Math.floor(t.y / 40),
              }}
            >
              <i className="world__canopy world__canopy--a" />
              <i className="world__canopy world__canopy--b" />
              <i className="world__canopy world__canopy--c" />
            </div>
          ))}
        </div>
      </div>

      <aside className="world__dock zoo-panel" data-ui>
        <div className="world__dock-copy">
          <h2>{phase.title}</h2>
          <p>{phase.detail}</p>
        </div>
        <div className="world__toolbar">
          <button
            className="zoo-tool"
            type="button"
            data-testid="collect-fees-dock"
            onClick={onCollectFees}
            title={count > 0 ? 'Collect fees' : 'Collect range fees'}
          >
            <span className="zoo-tool__icon zoo-tool__icon--cash" />
            <span>Fees</span>
          </button>
          <button
            className="zoo-tool"
            type="button"
            data-testid="open-staff"
            onClick={() => setStaffOpen(true)}
            title="Hire staff and manage carts"
          >
            <span className="zoo-tool__icon zoo-tool__icon--staff" />
            <span>Staff{crew > 0 ? ` · ${crew}` : ''}</span>
          </button>
          {target && (
            <button className="zoo-tool zoo-tool--accent" type="button" onClick={claimLand}>
              <span className="zoo-tool__icon zoo-tool__icon--dig" />
              <span>Claim</span>
            </button>
          )}
          {rangeSize === 'starter' && (
            <button className="zoo-tool" type="button" onClick={onExpandRange}>
              <span className="zoo-tool__icon zoo-tool__icon--expand" />
              <span>Range</span>
            </button>
          )}
          <button
            className="zoo-tool"
            type="button"
            onClick={() => setZoom((z) => Math.max(0.45, z - 0.1))}
          >
            <span>−</span>
          </button>
          <button
            className="zoo-tool"
            type="button"
            onClick={() => {
              setCam({ x: CLUBHOUSE.x + 40, y: CLUBHOUSE.y })
              setMapFocus(CLUBHOUSE.x + 40, CLUBHOUSE.y)
            }}
          >
            <span className="zoo-tool__icon zoo-tool__icon--home" />
            <span>Home</span>
          </button>
          <button
            className="zoo-tool"
            type="button"
            onClick={() => setZoom((z) => Math.min(1.25, z + 0.1))}
          >
            <span>+</span>
          </button>
        </div>
        <p className="world__hint">
          Drag to explore · ${budget.toLocaleString()} · Rep {reputation}
          {carts > 0 ? ` · ${carts} cart${carts === 1 ? '' : 's'}` : ''}
          {drinksOn ? ' · Drink cart out' : ''}
          {target ? ` · Next plot $${cost.toLocaleString()}` : ''}
          {rangeSize === 'starter' ? ` · Expand range $${RANGE_UPGRADE_COST.toLocaleString()}` : ''}
        </p>
      </aside>

      <StaffPanel open={staffOpen} onClose={() => setStaffOpen(false)} />
      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}
