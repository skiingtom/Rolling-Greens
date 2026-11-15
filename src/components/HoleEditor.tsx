import { useEffect, useState } from 'react'
import { ratingLabel } from '../game/rating'
import { useGame } from '../game/store'
import { yardage } from '../game/terrain'
import type { EditorTool, PaintTool, SculptMode } from '../game/types'
import { TerrainCanvas } from './TerrainCanvas'

const PAINT_SWATCHES: { type: PaintTool; label: string; color: string }[] = [
  { type: 'fairway', label: 'Fairway', color: '#589e4e' },
  { type: 'green', label: 'Green', color: '#78bc62' },
  { type: 'rough', label: 'Rough', color: '#3e6e3a' },
  { type: 'bunker', label: 'Bunker', color: '#d6ba78' },
  { type: 'water', label: 'Water', color: '#3a7694' },
  { type: 'tee', label: 'Tee', color: '#488c48' },
  { type: 'path', label: 'Path', color: '#948060' },
  { type: 'erase', label: 'Rough reset', color: '#2a4a30' },
]

const SCULPT_MODES: { mode: SculptMode; label: string }[] = [
  { mode: 'raise', label: 'Raise' },
  { mode: 'lower', label: 'Lower' },
  { mode: 'smooth', label: 'Smooth' },
  { mode: 'flatten', label: 'Flatten' },
]

const HOLE_TOOLS: { tool: EditorTool; label: string; hint: string }[] = [
  { tool: 'paint', label: 'Paint', hint: 'Brush terrain types across the hole.' },
  { tool: 'sculpt', label: 'Sculpt', hint: 'Raise, lower, and smooth the land.' },
  { tool: 'tee', label: 'Place tee', hint: 'Click to set the teeing ground.' },
  { tool: 'pin', label: 'Place pin', hint: 'Click to set the cup and flag.' },
]

const RANGE_TOOLS: { tool: EditorTool; label: string; hint: string }[] = [
  { tool: 'paint', label: 'Paint', hint: 'Brush bays, landing strip, and target greens.' },
  { tool: 'sculpt', label: 'Sculpt', hint: 'Shape the range floor and berms.' },
  { tool: 'tee', label: 'Place bay', hint: 'Click to set the practice tee.' },
  { tool: 'pin', label: 'Place target', hint: 'Click to set the main distance flag.' },
]

export function HoleEditor() {
  const hole = useGame((s) => s.getActiveHole())
  const editor = useGame((s) => s.editor)
  const budget = useGame((s) => s.budget)
  const setEditor = useGame((s) => s.setEditor)
  const setPar = useGame((s) => s.setPar)
  const setHoleName = useGame((s) => s.setHoleName)
  const applySculpt = useGame((s) => s.applySculpt)
  const applyPaint = useGame((s) => s.applyPaint)
  const placeTee = useGame((s) => s.placeTee)
  const placePin = useGame((s) => s.placePin)
  const finalizeHole = useGame((s) => s.finalizeHole)
  const setScreen = useGame((s) => s.setScreen)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(t)
  }, [toast])

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

  const layout = hole
  const isRange = layout.kind === 'range'
  const tools = isRange ? RANGE_TOOLS : HOLE_TOOLS
  const toolMeta = tools.find((t) => t.tool === editor.tool)

  function onStroke(x: number, y: number) {
    if (editor.tool === 'sculpt') applySculpt(x, y)
    else if (editor.tool === 'paint') applyPaint(x, y)
  }

  function onPlace(x: number, y: number) {
    if (editor.tool === 'tee') placeTee(x, y)
    else if (editor.tool === 'pin') placePin(x, y)
  }

  function publish() {
    const result = finalizeHole()
    if (!result) return
    setToast(
      `Rated ${result.rating} · ${ratingLabel(result.rating, layout.kind)}${result.prize > 0 ? ` · +$${result.prize}` : ''}`,
    )
  }

  return (
    <div className="editor">
      <div className="editor__stage">
        <TerrainCanvas
          className="editor__canvas-wrap"
          hole={layout}
          brushRadius={editor.brushRadius}
          showGrid={editor.tool === 'sculpt'}
          onPaint={editor.tool === 'sculpt' || editor.tool === 'paint' ? onStroke : undefined}
          onPlace={editor.tool === 'tee' || editor.tool === 'pin' ? onPlace : undefined}
        />
        <p className="editor__hint">{toolMeta?.hint} Budget ${budget.toLocaleString()}.</p>
      </div>

      <aside className="editor__panel">
        <div className="panel-section">
          <h3>{isRange ? 'Range' : 'Hole'}</h3>
          <label htmlFor="hole-name">Name</label>
          <input
            id="hole-name"
            type="text"
            value={layout.name}
            onChange={(e) => setHoleName(e.target.value)}
          />
          {!isRange && (
            <>
              <label htmlFor="hole-par">Par</label>
              <select
                id="hole-par"
                value={layout.par}
                onChange={(e) => setPar(Number(e.target.value) as 3 | 4 | 5)}
              >
                <option value={3}>Par 3</option>
                <option value={4}>Par 4</option>
                <option value={5}>Par 5</option>
              </select>
            </>
          )}
          <div className="stat-pills">
            <span className="stat-pill">
              <strong>{yardage(layout)}</strong> yds to target
            </span>
            {layout.rating !== null && (
              <span className="stat-pill">
                Rating <strong>{layout.rating}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="panel-section">
          <h3>Tools</h3>
          <div className="tool-row">
            {tools.map(({ tool, label }) => (
              <button
                key={tool}
                type="button"
                className={`tool-chip${editor.tool === tool ? ' tool-chip--active' : ''}`}
                onClick={() => setEditor({ tool })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {editor.tool === 'paint' && (
          <div className="panel-section">
            <h3>Terrain</h3>
            <div className="tool-row">
              {PAINT_SWATCHES.map(({ type, label, color }) => (
                <button
                  key={type}
                  type="button"
                  className={`tool-chip tool-chip--swatch${editor.paintType === type ? ' tool-chip--active' : ''}`}
                  style={{ ['--swatch' as string]: color }}
                  onClick={() => setEditor({ paintType: type })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {editor.tool === 'sculpt' && (
          <div className="panel-section">
            <h3>Sculpt</h3>
            <div className="tool-row">
              {SCULPT_MODES.map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  className={`tool-chip${editor.sculptMode === mode ? ' tool-chip--active' : ''}`}
                  onClick={() => setEditor({ sculptMode: mode })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(editor.tool === 'paint' || editor.tool === 'sculpt') && (
          <div className="panel-section">
            <h3>Brush</h3>
            <div className="slider-row">
              <label htmlFor="brush-r">Size · {editor.brushRadius.toFixed(1)}</label>
              <input
                id="brush-r"
                type="range"
                min={1}
                max={6}
                step={0.1}
                value={editor.brushRadius}
                onChange={(e) => setEditor({ brushRadius: Number(e.target.value) })}
              />
            </div>
            {editor.tool === 'sculpt' && (
              <div className="slider-row">
                <label htmlFor="brush-s">Strength · {editor.brushStrength.toFixed(2)}</label>
                <input
                  id="brush-s"
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={editor.brushStrength}
                  onChange={(e) => setEditor({ brushStrength: Number(e.target.value) })}
                />
              </div>
            )}
          </div>
        )}

        <div className="panel-section panel-actions">
          <button className="btn btn--primary" type="button" onClick={publish}>
            {isRange ? 'Open the range' : 'Publish rating'}
          </button>
          <button className="btn btn--solid" type="button" onClick={() => setScreen('playtest')}>
            {isRange ? 'Hit balls' : 'Playtest hole'}
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => setScreen('course')}>
            Back to map
          </button>
        </div>
      </aside>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
