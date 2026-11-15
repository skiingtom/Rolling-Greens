import { useEffect, useState } from 'react'
import { ratingLabel } from '../game/rating'
import { useGame } from '../game/store'
import { yardage } from '../game/terrain'
import type { BuildStage, EditorTool, PaintTool, SculptMode, WaterMode } from '../game/types'
import { TerrainCanvas } from './TerrainCanvas'

const PAINT_SWATCHES: { type: PaintTool; label: string; color: string }[] = [
  { type: 'fairway', label: 'Fairway', color: '#6eba5c' },
  { type: 'green', label: 'Green', color: '#94d676' },
  { type: 'rough', label: 'Rough', color: '#4a8c48' },
  { type: 'bunker', label: 'Bunker', color: '#e4cc94' },
  { type: 'tee', label: 'Tee box', color: '#60a858' },
  { type: 'path', label: 'Cart path', color: '#baa076' },
  { type: 'erase', label: 'Clear to rough', color: '#3a6a38' },
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
  {
    tool: 'sculpt',
    label: 'Land sculpt',
    hint: 'Shape hills, hollows, and slopes on the acreage.',
  },
  {
    tool: 'water',
    label: 'Water',
    hint: 'Add ponds, lakes, and streams — digs a basin as it fills.',
  },
  {
    tool: 'paint',
    label: 'Surfaces',
    hint: 'Lay fairway, dig bunkers, plant the green, and cut paths.',
  },
  { tool: 'tee', label: 'Place tee', hint: 'Plant the teeing ground where play begins.' },
  { tool: 'pin', label: 'Place cup', hint: 'Set the hole location on your green.' },
]

const RANGE_TOOLS: { tool: EditorTool; label: string; hint: string }[] = [
  { tool: 'sculpt', label: 'Land sculpt', hint: 'Shape the range floor and berms.' },
  {
    tool: 'water',
    label: 'Water',
    hint: 'Add ponds and water hazards beside the landing strips.',
  },
  { tool: 'paint', label: 'Surfaces', hint: 'Lay landing strips, bays, and targets.' },
  { tool: 'tee', label: 'Place bay', hint: 'Set a practice tee bay.' },
  { tool: 'pin', label: 'Place target', hint: 'Set the main distance flag.' },
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
  const applyWater = useGame((s) => s.applyWater)
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
  const sculptHint = SCULPT_MODES.find((m) => m.mode === editor.sculptMode)?.hint
  const waterHint = WATER_MODES.find((m) => m.mode === editor.waterMode)?.hint
  const painting =
    editor.tool === 'sculpt' || editor.tool === 'paint' || editor.tool === 'water'

  function onStroke(x: number, y: number) {
    if (editor.tool === 'sculpt') applySculpt(x, y)
    else if (editor.tool === 'water') applyWater(x, y)
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

  function selectTool(tool: EditorTool) {
    const patch: Partial<typeof editor> = { tool }
    if (tool === 'water' && editor.brushRadius < 3) patch.brushRadius = 3.2
    if (tool === 'water' && editor.waterMode === 'lake' && editor.brushRadius < 4) {
      patch.brushRadius = 4.5
    }
    setEditor(patch)
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
          showGrid={editor.tool === 'sculpt' || editor.tool === 'water'}
          onPaint={painting ? onStroke : undefined}
          onPlace={editor.tool === 'tee' || editor.tool === 'pin' ? onPlace : undefined}
        />
        <p className="editor__hint">
          {editor.tool === 'sculpt' && sculptHint
            ? sculptHint
            : editor.tool === 'water' && waterHint
              ? waterHint
              : toolMeta?.hint}{' '}
          Construction budget ${budget.toLocaleString()}.
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
                className={`tool-chip${editor.tool === tool ? ' tool-chip--active' : ''}${tool === 'water' ? ' tool-chip--water' : ''}${tool === 'sculpt' ? ' tool-chip--sculpt' : ''}`}
                onClick={() => selectTool(tool)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {editor.tool === 'sculpt' && (
          <div className="panel-section">
            <h3>Land sculpt</h3>
            <p className="panel-note">Drag on the plot to raise, cut, and blend earth.</p>
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
            <p className="panel-note">
              Ponds and lakes dig a basin as they fill. Streams cut a shallow channel.
            </p>
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
            <p className="panel-note">For water hazards, use the Water tool — it digs as it fills.</p>
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
