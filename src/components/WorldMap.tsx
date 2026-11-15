import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import {
  COURSES,
  RANGE_UPGRADE_COST,
  milestoneLabel,
  nextHoleCost,
} from '../game/types'
import { CLUBHOUSE, nextBuildTarget, phaseCopy } from '../game/world'
import { StaffPanel } from './StaffPanel'
import { beverageCartsReady, totalStaff } from '../game/staff'
import { CourseScene } from '../scene3d/CourseScene'

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

  const [toast, setToast] = useState<string | null>(null)
  const [staffOpen, setStaffOpen] = useState(false)
  const [focus, setFocus] = useState({ x: mapFocusX, y: mapFocusY })
  const crew = totalStaff(staff)
  const drinksOn = beverageCartsReady(staff, carts)

  const courseHoles = holes.filter((h) => h.kind === 'hole')
  const count = courseHoles.length
  const target = nextBuildTarget(count)
  const cost = nextHoleCost(count)
  const phase = phaseCopy(count)

  useEffect(() => {
    setFocus({ x: mapFocusX, y: mapFocusY })
  }, [mapFocusX, mapFocusY])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3400)
    return () => window.clearTimeout(t)
  }, [toast])

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

  function goHome() {
    const next = { x: CLUBHOUSE.x + 40, y: CLUBHOUSE.y }
    setFocus(next)
    setMapFocus(next.x, next.y)
  }

  return (
    <main className="world world--3d">
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
            <span className="zoo-chip zoo-chip--live">3D Live Play</span>
          </div>
        </div>
      </div>

      <div className="world__viewport world__viewport--3d">
        <CourseScene
          holes={holes}
          carts={carts}
          staff={staff}
          focus={focus}
          onOpenHole={openHole}
          onClaim={claimLand}
        />
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
          <button className="zoo-tool" type="button" onClick={goHome}>
            <span className="zoo-tool__icon zoo-tool__icon--home" />
            <span>Home</span>
          </button>
        </div>
        <p className="world__hint">
          Drag to orbit · scroll to zoom · click a hole to edit · ${budget.toLocaleString()} · Rep{' '}
          {reputation}
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
