import { useState, type FormEvent } from 'react'
import { useGame } from '../game/store'

export function Landing() {
  const startClub = useGame((s) => s.startClub)
  const started = useGame((s) => s.started)
  const clubName = useGame((s) => s.clubName)
  const setScreen = useGame((s) => s.setScreen)
  const resetClub = useGame((s) => s.resetClub)
  const [name, setName] = useState('')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    startClub(name || 'Rolling Greens GC')
  }

  return (
    <section className="landing">
      <div className="landing__sky" aria-hidden />
      <div className="landing__fairway" aria-hidden />
      <div className="landing__flag" aria-hidden />

      <div className="landing__content">
        <h1 className="landing__brand">Rolling Greens</h1>
        <p className="landing__lede">
          A county road, a clubhouse, and a driving range. Shape the land until you run two
          eighteens — thirty-six holes and a grand range.
        </p>

        {!started ? (
          <form className="landing__form" onSubmit={onSubmit}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name your club"
              maxLength={32}
              aria-label="Club name"
              autoFocus
            />
            <button className="btn btn--primary" type="submit">
              Arrive at the clubhouse
            </button>
          </form>
        ) : (
          <div className="landing__continue">
            <button className="btn btn--primary" type="button" onClick={() => setScreen('course')}>
              Continue {clubName}
            </button>
            <button className="btn btn--ghost" type="button" onClick={resetClub}>
              New club
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
