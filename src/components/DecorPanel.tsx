import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import {
  DECOR_CATALOG,
  DECOR_MAX,
  DECOR_REFUND,
  decorWeeklyBonus,
  type DecorGroup,
} from '../game/decor'

const GROUPS: DecorGroup[] = ['Amenities', 'Planting', 'Landmarks']
const ROT_STEP = Math.PI / 4

/** Placard for choosing and placing decorations on the 3D grounds. */
export function DecorPanel() {
  const mode = useGame((s) => s.decorMode)
  const decorations = useGame((s) => s.decorations)
  const budget = useGame((s) => s.budget)
  const setDecorMode = useGame((s) => s.setDecorMode)
  const tool = mode?.tool ?? 'bench'
  const [group, setGroup] = useState<DecorGroup>(
    () => DECOR_CATALOG.find((d) => d.kind === tool)?.group ?? 'Amenities',
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
      const m = useGame.getState().decorMode
      if (!m) return
      if (e.key === 'Escape') setDecorMode(null)
      if (e.key === 'r' || e.key === 'R') {
        setDecorMode({ rot: (m.rot + (e.shiftKey ? -ROT_STEP : ROT_STEP)) % (Math.PI * 2) })
      }
      if (e.key === 'x' || e.key === 'Delete') setDecorMode({ tool: 'remove' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setDecorMode])

  if (!mode) return null

  const items = DECOR_CATALOG.filter((d) => d.group === group)
  const removing = tool === 'remove'
  const weekly = decorWeeklyBonus(decorations)
  const deg = Math.round((mode.rot * 180) / Math.PI) % 360

  return (
    <aside className="edit-panel decor-panel zoo-panel" data-ui data-testid="decor-panel">
      <header className="edit-panel__head">
        <div>
          <p className="editor__stage-kicker">Grounds</p>
          <h2 className="edit-panel__title">Decorate</h2>
        </div>
        <button
          className="edit-panel__close"
          type="button"
          onClick={() => setDecorMode(null)}
          aria-label="Close decorating"
          title="Done (Esc)"
        >
          ×
        </button>
      </header>

      <div className="stat-pills">
        <span className="stat-pill">
          <strong>{decorations.length}</strong> / {DECOR_MAX} placed
        </span>
        <span className="stat-pill" title="Grounds appeal adds to weekly fees">
          Appeal <strong>+${weekly.toLocaleString()}</strong>/wk
        </span>
        <span className="stat-pill">
          Budget <strong>${budget.toLocaleString()}</strong>
        </span>
      </div>

      <div className="decor-tabs" role="tablist">
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={group === g}
            className={`decor-tab${group === g ? ' decor-tab--active' : ''}`}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="edit-panel__body">
        <div className="decor-grid">
          {items.map((d) => {
            const active = tool === d.kind
            const tooDear = budget < d.cost
            return (
              <button
                key={d.kind}
                type="button"
                className={`decor-item${active ? ' decor-item--active' : ''}${tooDear ? ' decor-item--dear' : ''}`}
                onClick={() => setDecorMode({ tool: d.kind })}
                title={`${d.name} · $${d.cost.toLocaleString()} · appeal +${d.appeal}`}
              >
                <span className="decor-item__dab" style={{ background: d.swatch }} aria-hidden />
                <span className="decor-item__name">{d.name}</span>
                <span className="decor-item__cost">${d.cost.toLocaleString()}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="edit-panel__actions">
        <div className="edit-panel__row">
          <button
            className="btn btn--ghost"
            type="button"
            disabled={removing}
            onClick={() => setDecorMode({ rot: (mode.rot + ROT_STEP) % (Math.PI * 2) })}
            title="Rotate (R)"
          >
            ↻ Rotate · {deg}°
          </button>
          <button
            className={`btn ${removing ? 'btn--solid' : 'btn--ghost'}`}
            type="button"
            onClick={() =>
              setDecorMode({ tool: removing ? (items[0]?.kind ?? 'bench') : 'remove' })
            }
            title="Remove tool (X)"
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </div>
        <button className="btn btn--primary" type="button" onClick={() => setDecorMode(null)}>
          Done
        </button>
        <p className="edit-panel__controls">
          {removing
            ? `Click a decoration to remove it (${Math.round(DECOR_REFUND * 100)}% refund)`
            : 'Click the ground to place · R rotates · drag to pan · scroll to zoom'}
        </p>
      </div>
    </aside>
  )
}
