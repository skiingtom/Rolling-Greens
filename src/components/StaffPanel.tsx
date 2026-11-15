import { useMemo, useState } from 'react'
import {
  CART_BUY_COST,
  CART_MAX,
  CART_RENTAL_FEE,
  CADDIE_FEE,
  DRINK_SALE,
  STAFF_ROLES,
  beverageCartsReady,
  totalStaff,
  weeklyPayroll,
  type StaffRole,
} from '../game/staff'
import { useGame } from '../game/store'

interface Props {
  open: boolean
  onClose: () => void
}

export function StaffPanel({ open, onClose }: Props) {
  const staff = useGame((s) => s.staff)
  const carts = useGame((s) => s.carts)
  const budget = useGame((s) => s.budget)
  const holes = useGame((s) => s.holes)
  const hireStaff = useGame((s) => s.hireStaff)
  const fireStaff = useGame((s) => s.fireStaff)
  const buyCart = useGame((s) => s.buyCart)
  const sellCart = useGame((s) => s.sellCart)
  const [note, setNote] = useState<string | null>(null)

  const openHoles = useMemo(
    () => holes.filter((h) => h.kind === 'hole' && h.rating !== null).length,
    [holes],
  )
  const payroll = weeklyPayroll(staff)
  const headcount = totalStaff(staff)
  const drinksReady = beverageCartsReady(staff, carts)

  if (!open) return null

  function flash(message: string) {
    setNote(message)
    window.setTimeout(() => setNote(null), 2800)
  }

  function onHire(role: StaffRole) {
    flash(hireStaff(role).message)
  }

  function onFire(role: StaffRole) {
    flash(fireStaff(role).message)
  }

  return (
    <div className="staff-overlay" data-ui role="dialog" aria-label="Staff and fleet">
      <div className="staff-panel zoo-panel">
        <header className="staff-panel__head">
          <div>
            <p className="staff-panel__kicker">Club operations</p>
            <h2>Staff &amp; fleet</h2>
            <p className="staff-panel__sub">
              Hire the crew, stock the cart barn, and put a drink cart on the holes.
            </p>
          </div>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="staff-panel__stats">
          <span>
            Team <strong>{headcount}</strong>
          </span>
          <span>
            Payroll <strong>${payroll.toLocaleString()}/wk</strong>
          </span>
          <span>
            Carts <strong>{carts}</strong>/{CART_MAX}
          </span>
          <span>
            Budget <strong>${budget.toLocaleString()}</strong>
          </span>
        </div>

        <section className="staff-fleet">
          <div className="staff-fleet__copy">
            <h3>Golf carts</h3>
            <p>
              Guests rent carts for ${CART_RENTAL_FEE} a round. Beverage cart drivers need a cart
              to roam the course and sell drinks (~${DRINK_SALE} a stop).
            </p>
          </div>
          <div className="staff-fleet__actions">
            <button className="btn btn--solid" type="button" onClick={() => flash(buyCart().message)}>
              Buy cart · ${CART_BUY_COST.toLocaleString()}
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => flash(sellCart().message)}>
              Sell cart
            </button>
            <span className={`staff-pill${drinksReady ? ' staff-pill--ok' : ''}`}>
              {drinksReady ? 'Drink cart on course' : carts === 0 ? 'No fleet yet' : 'Hire beverage staff'}
            </span>
          </div>
        </section>

        <ul className="staff-list">
          {STAFF_ROLES.map((role) => {
            const count = staff[role.id]
            const locked = openHoles < role.unlockHoles
            const full = count >= role.max
            return (
              <li key={role.id} className={`staff-card${locked ? ' staff-card--locked' : ''}`}>
                <div className="staff-card__main">
                  <div className="staff-card__title">
                    <strong>{role.label}</strong>
                    <span>
                      {count}/{role.max}
                    </span>
                  </div>
                  <p>{role.blurb}</p>
                  <div className="staff-card__meta">
                    <span>Hire ${role.hireCost.toLocaleString()}</span>
                    <span>${role.wage}/wk</span>
                    {role.id === 'caddie' && <span>Guest fee ${CADDIE_FEE}</span>}
                    {role.id === 'beverage' && <span>Needs a cart</span>}
                    {locked && (
                      <span>
                        Unlocks at {role.unlockHoles} open hole{role.unlockHoles === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="staff-card__actions">
                  <button
                    className="btn btn--ghost"
                    type="button"
                    disabled={count <= 0}
                    onClick={() => onFire(role.id)}
                  >
                    Fire
                  </button>
                  <button
                    className="btn btn--primary"
                    type="button"
                    disabled={locked || full || budget < role.hireCost}
                    onClick={() => onHire(role.id)}
                  >
                    Hire
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

        {note && <div className="toast">{note}</div>}
      </div>
    </div>
  )
}
