import { useEffect, useState } from 'react'
import { useGame } from '../game/store'

export function TopBar() {
  const clubName = useGame((s) => s.clubName)
  const budget = useGame((s) => s.budget)
  const reputation = useGame((s) => s.reputation)
  const week = useGame((s) => s.week)
  const holes = useGame((s) => s.holes)
  const screen = useGame((s) => s.screen)
  const setScreen = useGame((s) => s.setScreen)
  const advanceWeek = useGame((s) => s.advanceWeek)
  const [toast, setToast] = useState<string | null>(null)

  const hasCourse = holes.some((h) => h.kind === 'hole')

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [toast])

  function onCollect() {
    const { income, week: nextWeek } = advanceWeek()
    setToast(`Week ${nextWeek} · +$${income.toLocaleString()} collected`)
  }

  return (
    <header className="topbar">
      <div>
        <div className="topbar__brand">Rolling Greens</div>
        <div className="topbar__club">{clubName}</div>
      </div>
      <div className="topbar__stats">
        <span>
          Week <strong>{week}</strong>
        </span>
        <span>
          Budget <strong>${budget.toLocaleString()}</strong>
        </span>
        <span>
          Rep <strong>{reputation}</strong>
        </span>
      </div>
      <div className="topbar__actions">
        {screen !== 'course' && (
          <button className="btn btn--ghost" type="button" onClick={() => setScreen('course')}>
            Park map
          </button>
        )}
        {screen === 'course' && (
          <button
            className="btn btn--solid"
            type="button"
            data-testid="collect-fees"
            onClick={onCollect}
          >
            {hasCourse ? 'Collect fees' : 'Collect range fees'}
          </button>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </header>
  )
}
