import { useEffect, useState } from 'react'
import { ratingLabel } from '../game/rating'
import { useGame } from '../game/store'
import { yardage } from '../game/terrain'
import type { BuildStage, EditorTool, PaintTool, SculptMode, WaterMode } from '../game/types'

const PAINT_SWATCHES: { type: PaintTool; label: string; color: string }[] = [
  { type: 'fairway', label: 'Fairway', color: '#7d9a58' },
  { type: 'green', label: 'Green', color: '#b6c89a' },
  { type: 'rough', label: 'Rough', color: '#55703d' },
  { type: 'bunker', label: 'Bunker', color: '#eeebde' },
  { type: 'tee', label: 'Tee box', color: '#86a062' },
  { type: 'path', label: 'Cart path', color: '#cecabe' },
  { type: 'erase', label: 'Clear to rough', color: '#3f5530' },
]

const SCULPT_MODES: { mode: SculptMode; label: string; hint: string }[] = [
  { mode: 'raise', label: 'Raise', hint: 'Push earth up into mounds and ridges.' },
  { mode: 'lower', label: 'Lower', hint: 'Cut hollows, valleys, and drainages.' },
  { mode: 'smooth', label: 'Smooth', hint: 'Blend harsh edges into natural slopes.' },
  { mode: 'flatten', label: 'Flatten', hint: 'Level the brush area to the center height.' },
]

const WATER_MODES: { mode: WaterMode; label: string; hint: string }[] = [
  { mode: 'pond', label: 'Pond', hint: 'Dig a basin and fill it with water.' },
  { mode: 'lake', label: 'Lake', hint: 'Carve a wider, deeper water hazard.' },
  { mode: 'stream', label: 'Stream', hint: 'Cut a shallow channel — drag to shape the creek.' },
  { mode: 'fill', label: 'Fill', hint: 'Paint water without digging.' },
  { mode: 'drain', label: 'Drain', hint: 'Remove water and gently raise the bed.' },
]

const HOLE_TOOLS: { tool: EditorTool; label: string; hint: string }[] = [
  { tool: 'sculpt', label: 'Land sculpt', hint: 'Shape hills, hollows, and slopes on the acreage.' },
  { tool: 'water', label: 'Water', hint: 'Add ponds, lakes, and streams — digs a basin as it fills.' },
  { tool: 'paint', label: 'Surfaces', hint: 'Lay fairway, dig bunkers, plant the green, and cut paths.' },
  { tool: 'tee', label: 'Place tee', hint: 'Click the plot to plant the teeing ground.' },
  { tool: 'pin', label: 'Place cup', hint: 'Click your green to set the hole location.' },
]

const RANGE_TOOLS: { tool: EditorTool; label: string; hint: string }[] = [
  { tool: 'sculpt', label: 'Land sculpt', hint: 'Shape the range floor and berms.' },
  { tool: 'water', label: 'Water', hint: 'Add ponds and water hazards beside the landing strips.' },
  { tool: 'paint', label: 'Surfaces', hint: 'Lay landing strips, bays, and targets.' },
  { tool: 'tee', label: 'Place bay', hint: 'Click to set a practice tee bay.' },
  { tool: 'pin', label: 'Place target', hint: 'Click to set the main distance flag.' },
]

const STAGE_COPY: Record<BuildStage, { title: string; detail: string }> = {
  raw: {
    title: 'Raw land',
    detail: 'Sculpt the acreage, dig water if you want, then build fairway and green.',
  },
  terraformed: {
    title: 'Terraforming',
    detail: 'Land is moving — keep sculpting, add water features, then lay turf.',
  },
  built: {
    title: 'Under construction',
    detail: 'Surfaces are in. Place tee and cup, then open the hole.',
  },
  open: {
    title: 'Open for play',
    detail: 'Guests are playing this layout. Keep refining anytime.',
  },
}

/** Placard for editing the selected hole live in the 3D course view. */
export function HoleEditPanel() {
  const hole = useGame((s) => s.getActiveHole())
  const editor = useGame((s) => s.editor)
  const budget = useGame((s) => s.budget)
  const setEditor = useGame((s) => s.setEditor)
  const setPar = useGame((s) => s.setPar)
  const setHoleName = useGame((s) => s.setHoleName)
  const finalizeHole = useGame((s) => s.finalizeHole)
  const setScreen = useGame((s) => s.setScreen)
  const closeHole = useGame((s) => s.closeHole)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.key === 'Escape' && el?.tagName !== 'INPUT') closeHole()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeHole])

  if (!hole) return null

  const layout = hole
  const isRange = layout.kind === 'range'
  const tools = isRange ? RANGE_TOOLS : HOLE_TOOLS
  const toolMeta = tools.find((t) => t.tool === editor.tool)
  const stage = STAGE_COPY[layout.buildStage]
  const sculptHint = SCULPT_MODES.find((m) => m.mode === editor.sculptMode)?.hint
  const waterHint = WATER_MODES.find((m) => m.mode === editor.waterMode)?.hint
  const painting = editor.tool === 'sculpt' || editor.tool === 'paint' || editor.tool === 'water'
  const hint =
    editor.tool === 'sculpt' && sculptHint
      ? sculptHint
      : editor.tool === 'water' && waterHint
        ? waterHint
        : toolMeta?.hint

  function publish() {
    const result = finalizeHole()
    if (!result) return
    setToast(
      `Opened · ${result.rating} ${ratingLabel(result.rating, layout.kind)}${result.prize > 0 ? ` · +$${result.prize}` : ''}`,
    )
  }

  function selectTool(tool: EditorTool) {
    const patch: Partial<typeof editor> = { tool }
    if (tool === 'water' && editor.brushRadius < 3) patch.brushRadius = 3.2
    if (tool === 'water' && editor.waterMode === 'lake' && editor.brushRadius < 4) {
      patch.brushRadius = 4.5
    }
    setEditor(patch)
  }

  return (
    <aside className="edit-panel zoo-panel" data-ui data-testid="edit-panel">
      <header className="edit-panel__head">
        <div>
          <p className="editor__stage-kicker">{stage.title}</p>
          <h2 className="edit-panel__title">{layout.name}</h2>
        </div>
        <button
          className="edit-panel__close"
          type="button"
          onClick={closeHole}
          aria-label="Close editor"
          title="Done (Esc)"
        >
          ×
        </button>
      </header>

      <div className="stat-pills">
        <span className="stat-pill">
          <strong>{yardage(layout)}</strong> yds
        </span>
        {!isRange && (
          <span className="stat-pill">
            Par <strong>{layout.par}</strong>
          </span>
        )}
        {layout.rating !== null && (
          <span className="stat-pill">
            Rating <strong>{layout.rating}</strong>
          </span>
        )}
        <span className="stat-pill">
          Budget <strong>${budget.toLocaleString()}</strong>
        </span>
      </div>

      <div className="edit-panel__body">
        <div className="panel-section">
          <h3>Build tools</h3>
          <div className="tool-row">
            {tools.map(({ tool, label }) => (
              <button
                key={tool}
                type="button"
                className={`tool-chip${editor.tool === tool ? ' tool-chip--active' : ''}`}
                onClick={() => selectTool(tool)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="panel-note">{hint}</p>
        </div>

        {editor.tool === 'sculpt' && (
          <div className="panel-section">
            <h3>Land sculpt</h3>
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

        {editor.tool === 'water' && (
          <div className="panel-section">
            <h3>Water features</h3>
            <div className="tool-row">
              {WATER_MODES.map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  className={`tool-chip${editor.waterMode === mode ? ' tool-chip--active' : ''}`}
                  onClick={() => {
                    const patch: Partial<typeof editor> = { waterMode: mode }
                    if (mode === 'lake') patch.brushRadius = Math.max(editor.brushRadius, 4.2)
                    if (mode === 'stream') patch.brushRadius = Math.min(editor.brushRadius, 2.4)
                    setEditor(patch)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {painting && (
          <div className="panel-section">
            <h3>Brush</h3>
            <div className="slider-row">
              <label htmlFor="brush-r">Size · {editor.brushRadius.toFixed(1)}</label>
              <input
                id="brush-r"
                type="range"
                min={1}
                max={editor.tool === 'water' ? 9 : 6}
                step={0.1}
                value={editor.brushRadius}
                onChange={(e) => setEditor({ brushRadius: Number(e.target.value) })}
              />
            </div>
            {(editor.tool === 'sculpt' || editor.tool === 'water') && (
              <div className="slider-row">
                <label htmlFor="brush-s">
                  {editor.tool === 'water' ? 'Dig depth' : 'Strength'} ·{' '}
                  {editor.brushStrength.toFixed(2)}
                </label>
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
          <p className="panel-note">{stage.detail}</p>
        </div>
      </div>

      <div className="edit-panel__actions">
        <button className="btn btn--primary" type="button" onClick={publish}>
          {isRange ? 'Open facility' : 'Open hole for play'}
        </button>
        <div className="edit-panel__row">
          <button className="btn btn--solid" type="button" onClick={() => setScreen('playtest')}>
            {isRange ? 'Test shots' : 'Playtest'}
          </button>
          <button className="btn btn--ghost" type="button" onClick={closeHole}>
            Done
          </button>
        </div>
        <p className="edit-panel__controls">
          {painting ? 'Drag on the hole to build' : 'Click the hole to place'} · right-drag to
          orbit · scroll to zoom
        </p>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </aside>
  )
}
