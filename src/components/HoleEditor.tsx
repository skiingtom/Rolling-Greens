import { useEffect, useState } from 'react'
import { ratingLabel } from '../game/rating'
import { useGame } from '../game/store'
import { yardage } from '../game/terrain'
import type { BuildStage, EditorTool, PaintTool, SculptMode } from '../game/types'
import { TerrainCanvas } from './TerrainCanvas'

const PAINT_SWATCHES: { type: PaintTool; label: string; color: string }[] = [
  { type: 'fairway', label: 'Fairway', color: '#6eba5c' },
  { type: 'green', label: 'Green', color: '#94d676' },
  { type: 'rough', label: 'Rough', color: '#4a8c48' },
  { type: 'bunker', label: 'Bunker', color: '#e4cc94' },
  { type: 'water', label: 'Water', color: '#489cc4' },
  { type: 'tee', label: 'Tee box', color: '#60a858' },
  { type: 'path', label: 'Cart path', color: '#baa076' },
  { type: 'erase', label: 'Clear to rough', color: '#3a6a38' },
]

const SCULPT_MODES: { mode: SculptMode; label: string }[] = [
  { mode: 'raise', label: 'Raise' },
  { mode: 'lower', label: 'Lower' },
  { mode: 'smooth', label: 'Smooth' },
  { mode: 'flatten', label: 'Flatten' },
]

const HOLE_TOOLS: { tool: EditorTool; label: string; hint: string }[] = [
  {
    tool: 'sculpt',
    label: 'Terraform',
    hint: 'Shape hills, hollows, and slopes on the raw land.',
  },
  {
    tool: 'paint',
    label: 'Build surfaces',
    hint: 'Lay fairway, dig bunkers, plant the green, and cut paths.',
  },
  { tool: 'tee', label: 'Place tee', hint: 'Plant the teeing ground where play begins.' },
  { tool: 'pin', label: 'Place cup', hint: 'Set the hole location on your green.' },
]

const RANGE_TOOLS: { tool: EditorTool; label: string; hint: string }[] = [
  { tool: 'sculpt', label: 'Terraform', hint: 'Shape the range floor and berms.' },
  { tool: 'paint', label: 'Build surfaces', hint: 'Lay landing strips, bays, and targets.' },
  { tool: 'tee', label: 'Place bay', hint: 'Set a practice tee bay.' },
  { tool: 'pin', label: 'Place target', hint: 'Set the main distance flag.' },
]

const STAGE_COPY: Record<BuildStage, { title: string; detail: string }> = {
  raw: {
    title: 'Raw land',
    detail: 'Terraform the acreage, then build fairway, green, and tee from scratch.',
  },
  terraformed: {
    title: 'Terraforming',
    detail: 'Land is moving — keep shaping, then lay turf and hazards.',
  },
  built: {
    title: 'Under construction',
    detail: 'Surfaces are in. Place tee and cup, then open the hole.',
  },
  open: {
    title: 'Open for play',
    detail: 'Guests can play this layout. Keep refining anytime.',
  },
}

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
        <p>No plot selected.</p>
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
  const stage = STAGE_COPY[layout.buildStage]

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
      `Opened · ${result.rating} ${ratingLabel(result.rating, layout.kind)}${result.prize > 0 ? ` · +$${result.prize}` : ''}`,
    )
  }

  return (
    <div className="editor">
      <div className="editor__stage">
        <div className="editor__banner">
          <div>
            <p className="editor__stage-kicker">{stage.title}</p>
            <h1 className="editor__title">{layout.name}</h1>
            <p className="editor__stage-detail">{stage.detail}</p>
          </div>
          <div className="stat-pills">
            <span className="stat-pill">
              <strong>{yardage(layout)}</strong> yds
            </span>
            {!isRange && (
              <span className="stat-pill">
                Par <strong>{layout.par}</strong>
              </span>
            )}
          </div>
        </div>
        <TerrainCanvas
          className="editor__canvas-wrap"
          hole={layout}
          brushRadius={editor.brushRadius}
          showGrid={editor.tool === 'sculpt'}
          onPaint={editor.tool === 'sculpt' || editor.tool === 'paint' ? onStroke : undefined}
          onPlace={editor.tool === 'tee' || editor.tool === 'pin' ? onPlace : undefined}
        />
        <p className="editor__hint">
          {toolMeta?.hint} Construction budget ${budget.toLocaleString()}.
        </p>
      </div>

      <aside className="editor__panel">
        <div className="panel-section">
          <h3>{isRange ? 'Facility' : 'Plot'}</h3>
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
          {layout.rating !== null && (
            <div className="stat-pills">
              <span className="stat-pill">
                Rating <strong>{layout.rating}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="panel-section">
          <h3>Build tools</h3>
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
            <h3>Surfaces</h3>
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
            <h3>Terraform</h3>
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
            {isRange ? 'Open facility' : 'Open hole for play'}
          </button>
          <button className="btn btn--solid" type="button" onClick={() => setScreen('playtest')}>
            {isRange ? 'Test shots' : 'Playtest hole'}
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => setScreen('course')}>
            Back to park
          </button>
        </div>
      </aside>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
