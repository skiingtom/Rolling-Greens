import { HoleEditor } from './components/HoleEditor'
import { Landing } from './components/Landing'
import { Playtest } from './components/Playtest'
import { TopBar } from './components/TopBar'
import { WorldMap } from './components/WorldMap'
import { useGame } from './game/store'

export default function App() {
  const screen = useGame((s) => s.screen)
  const started = useGame((s) => s.started)

  return (
    <div className="app-shell">
      {started && screen !== 'landing' && <TopBar />}
      {screen === 'landing' && <Landing />}
      {screen === 'course' && <WorldMap />}
      {screen === 'editor' && <HoleEditor />}
      {screen === 'playtest' && <Playtest />}
    </div>
  )
}
