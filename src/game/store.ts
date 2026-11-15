import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { prizeForRating, rateHole } from './rating'
import {
  createBlankHole,
  createDrivingRange,
  deserializeHole,
  expandRangeLayout,
  inferBuildStage,
  paint,
  sculpt,
  serializeHole,
} from './terrain'
import {
  MAX_HOLES,
  RANGE_UPGRADE_COST,
  SCULPT_COST,
  STARTING_BUDGET,
  TERRAIN_COST,
  nextHoleCost,
  type EditorTool,
  type Hole,
  type PaintTool,
  type RangeSize,
  type Screen,
  type SculptMode,
  type TerrainType,
} from './types'
import { defaultPar, nextBuildTarget } from './world'

interface EditorPrefs {
  tool: EditorTool
  sculptMode: SculptMode
  paintType: PaintTool
  brushRadius: number
  brushStrength: number
}

interface GameStore {
  screen: Screen
  clubName: string
  budget: number
  reputation: number
  week: number
  holes: Hole[]
  rangeSize: RangeSize
  activeHoleId: number | null
  editor: EditorPrefs
  started: boolean
  saveVersion: number
  mapFocusX: number
  mapFocusY: number

  setScreen: (s: Screen) => void
  startClub: (name: string) => void
  openHole: (id: number) => void
  setPar: (par: 3 | 4 | 5) => void
  setHoleName: (name: string) => void
  setEditor: (partial: Partial<EditorPrefs>) => void
  setMapFocus: (x: number, y: number) => void
  applySculpt: (x: number, y: number) => void
  applyPaint: (x: number, y: number) => void
  placeTee: (x: number, y: number) => void
  placePin: (x: number, y: number) => void
  finalizeHole: () => { rating: number; prize: number } | null
  recordPlay: (strokes: number) => void
  buildNextHole: () => { ok: boolean; cost: number; message: string }
  expandRange: () => { ok: boolean; cost: number; message: string }
  advanceWeek: () => { income: number; week: number }
  resetClub: () => void
  getActiveHole: () => Hole | null
  courseHoleCount: () => number
}

const SAVE_VERSION = 4

function starterProperty(): Hole[] {
  return [createDrivingRange('starter')]
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      screen: 'landing',
      clubName: '',
      budget: STARTING_BUDGET,
      reputation: 8,
      week: 1,
      holes: starterProperty(),
      rangeSize: 'starter',
      activeHoleId: null,
      editor: {
        tool: 'paint',
        sculptMode: 'raise',
        paintType: 'fairway',
        brushRadius: 2.4,
        brushStrength: 0.7,
      },
      started: false,
      saveVersion: SAVE_VERSION,
      mapFocusX: 1680,
      mapFocusY: 1280,

      setScreen: (screen) => set({ screen }),
      setMapFocus: (mapFocusX, mapFocusY) => set({ mapFocusX, mapFocusY }),

      startClub: (name) =>
        set({
          clubName: name.trim() || 'Rolling Greens',
          started: true,
          screen: 'course',
          budget: STARTING_BUDGET,
          reputation: 8,
          week: 1,
          holes: starterProperty(),
          rangeSize: 'starter',
          activeHoleId: null,
          saveVersion: SAVE_VERSION,
          mapFocusX: 1680,
          mapFocusY: 1280,
        }),

      openHole: (id) => {
        const hole = get().holes.find((h) => h.id === id)
        const tool =
          hole?.kind === 'hole' && hole.buildStage === 'raw' ? 'sculpt' : get().editor.tool
        set({
          activeHoleId: id,
          screen: 'editor',
          mapFocusX: hole?.mapX ?? get().mapFocusX,
          mapFocusY: hole?.mapY ?? get().mapFocusY,
          editor: { ...get().editor, tool },
        })
      },

      courseHoleCount: () => get().holes.filter((h) => h.kind === 'hole').length,

      setPar: (par) => {
        const { activeHoleId, holes } = get()
        if (activeHoleId === null) return
        const hole = holes.find((h) => h.id === activeHoleId)
        if (!hole || hole.kind === 'range') return
        set({
          holes: holes.map((h) => (h.id === activeHoleId ? { ...h, par } : h)),
        })
      },

      setHoleName: (name) => {
        const { activeHoleId, holes } = get()
        if (activeHoleId === null) return
        set({
          holes: holes.map((h) =>
            h.id === activeHoleId ? { ...h, name: name.slice(0, 28) } : h,
          ),
        })
      },

      setEditor: (partial) =>
        set((s) => ({ editor: { ...s.editor, ...partial } })),

      applySculpt: (x, y) => {
        const { activeHoleId, holes, editor, budget } = get()
        if (activeHoleId === null || budget < SCULPT_COST) return
        const hole = holes.find((h) => h.id === activeHoleId)
        if (!hole) return
        const elevation = new Float32Array(hole.elevation)
        const changed = sculpt(
          elevation,
          x,
          y,
          editor.brushRadius,
          editor.brushStrength,
          editor.sculptMode,
          hole.width,
          hole.height,
        )
        if (!changed) return
        const cost = Math.min(budget, Math.max(SCULPT_COST, Math.ceil(changed * 0.15)))
        set({
          budget: budget - cost,
          holes: holes.map((h) => {
            if (h.id !== activeHoleId) return h
            const next = { ...h, elevation, designed: true }
            next.buildStage = inferBuildStage(next)
            return next
          }),
        })
      },

      applyPaint: (x, y) => {
        const { activeHoleId, holes, editor, budget } = get()
        if (activeHoleId === null) return
        const hole = holes.find((h) => h.id === activeHoleId)
        if (!hole) return
        const paintType = editor.paintType
        const unitCost =
          paintType === 'erase' ? 0 : TERRAIN_COST[paintType as TerrainType]
        if (unitCost > 0 && budget < unitCost) return
        const terrain = new Uint8Array(hole.terrain)
        const changed = paint(
          terrain,
          x,
          y,
          editor.brushRadius,
          paintType,
          hole.width,
          hole.height,
        )
        if (!changed) return
        const cost = Math.min(budget, changed * unitCost)
        set({
          budget: budget - cost,
          holes: holes.map((h) => {
            if (h.id !== activeHoleId) return h
            const next = { ...h, terrain, designed: true }
            next.buildStage = inferBuildStage(next)
            return next
          }),
        })
      },

      placeTee: (x, y) => {
        const { activeHoleId, holes } = get()
        if (activeHoleId === null) return
        const gx = Math.round(x)
        const gy = Math.round(y)
        set({
          holes: holes.map((h) => {
            if (h.id !== activeHoleId) return h
            const terrain = new Uint8Array(h.terrain)
            paint(terrain, gx, gy, 2, 'tee', h.width, h.height)
            const next = { ...h, tee: { x: gx, y: gy }, terrain, designed: true }
            next.buildStage = inferBuildStage(next)
            return next
          }),
        })
      },

      placePin: (x, y) => {
        const { activeHoleId, holes } = get()
        if (activeHoleId === null) return
        const gx = Math.round(x)
        const gy = Math.round(y)
        set({
          holes: holes.map((h) => {
            if (h.id !== activeHoleId) return h
            const next = { ...h, pin: { x: gx, y: gy }, designed: true }
            next.buildStage = inferBuildStage(next)
            return next
          }),
        })
      },

      finalizeHole: () => {
        const { activeHoleId, holes, budget, reputation } = get()
        if (activeHoleId === null) return null
        const hole = holes.find((h) => h.id === activeHoleId)
        if (!hole) return null
        const rating = rateHole(hole)
        const previous = hole.rating ?? 0
        const prize =
          hole.rating === null
            ? prizeForRating(rating, hole.kind)
            : Math.max(
                0,
                prizeForRating(rating, hole.kind) -
                  prizeForRating(previous, hole.kind) / 2,
              )
        const repGain = Math.max(0, Math.round((rating - (hole.rating ?? 30)) / 8))
        set({
          budget: budget + Math.round(prize),
          reputation: Math.min(100, reputation + repGain),
          holes: holes.map((h) =>
            h.id === activeHoleId
              ? { ...h, rating, designed: true, buildStage: 'open' as const }
              : h,
          ),
        })
        return { rating, prize: Math.round(prize) }
      },

      recordPlay: (strokes) => {
        const { activeHoleId, holes, reputation } = get()
        if (activeHoleId === null) return
        const hole = holes.find((h) => h.id === activeHoleId)
        if (!hole) return
        const underPar = hole.kind === 'range' ? strokes <= 3 : strokes <= hole.par
        set({
          reputation: Math.min(100, reputation + (underPar ? 1 : 0)),
          holes: holes.map((h) => {
            if (h.id !== activeHoleId) return h
            const best =
              h.bestScore === null ? strokes : Math.min(h.bestScore, strokes)
            return { ...h, playCount: h.playCount + 1, bestScore: best }
          }),
        })
      },

      buildNextHole: () => {
        const { holes, budget, reputation } = get()
        const courseCount = holes.filter((h) => h.kind === 'hole').length
        if (courseCount >= MAX_HOLES) {
          return { ok: false, cost: 0, message: 'Both eighteens are complete — 36 holes.' }
        }
        const target = nextBuildTarget(courseCount)
        if (!target) {
          return { ok: false, cost: 0, message: 'No more land to claim.' }
        }
        const cost = nextHoleCost(courseCount)
        if (budget < cost) {
          return {
            ok: false,
            cost,
            message: `Need $${cost.toLocaleString()} to shape this land (have $${budget.toLocaleString()}).`,
          }
        }
        // Soft gates at nine / eighteen milestones
        if (courseCount === 9 && reputation < 18) {
          return {
            ok: false,
            cost,
            message: `Publish and play the front nine — need reputation 18 (now ${reputation}).`,
          }
        }
        if (courseCount === 18 && reputation < 28) {
          return {
            ok: false,
            cost,
            message: `Finish establishing North Links — need reputation 28 (now ${reputation}).`,
          }
        }
        if (courseCount === 27 && reputation < 40) {
          return {
            ok: false,
            cost,
            message: `South front nine must settle in — need reputation 40 (now ${reputation}).`,
          }
        }

        const nextId =
          Math.max(0, ...holes.filter((h) => h.kind === 'hole').map((h) => h.id)) + 1
        const hole = createBlankHole(
          nextId,
          target.courseId,
          target.number,
          defaultPar(target.number),
        )
        set({
          budget: budget - cost,
          holes: [...holes, hole],
          activeHoleId: nextId,
          screen: 'editor',
          mapFocusX: hole.mapX,
          mapFocusY: hole.mapY,
        })
        return {
          ok: true,
          cost,
          message: `Claimed raw land for ${hole.name} (−$${cost.toLocaleString()}). Terraform it.`,
        }
      },

      expandRange: () => {
        const { rangeSize, budget, holes, reputation } = get()
        if (rangeSize === 'large') {
          return { ok: false, cost: 0, message: 'The grand range is already open.' }
        }
        const courseCount = holes.filter((h) => h.kind === 'hole').length
        if (courseCount < 18) {
          return {
            ok: false,
            cost: RANGE_UPGRADE_COST,
            message: 'Open a full 18-hole course before expanding the range.',
          }
        }
        if (budget < RANGE_UPGRADE_COST) {
          return {
            ok: false,
            cost: RANGE_UPGRADE_COST,
            message: `Need $${RANGE_UPGRADE_COST.toLocaleString()} for the grand range.`,
          }
        }
        if (reputation < 25) {
          return {
            ok: false,
            cost: RANGE_UPGRADE_COST,
            message: `Need reputation 25 to draw range traffic (now ${reputation}).`,
          }
        }
        const range = holes.find((h) => h.kind === 'range')
        if (!range) {
          return { ok: false, cost: 0, message: 'No range found.' }
        }
        const expanded = expandRangeLayout(range)
        set({
          budget: budget - RANGE_UPGRADE_COST,
          rangeSize: 'large',
          holes: holes.map((h) => (h.kind === 'range' ? expanded : h)),
          mapFocusX: expanded.mapX,
          mapFocusY: expanded.mapY,
        })
        return {
          ok: true,
          cost: RANGE_UPGRADE_COST,
          message: `Grand driving range under construction (−$${RANGE_UPGRADE_COST.toLocaleString()}).`,
        }
      },

      advanceWeek: () => {
        const { week, holes, budget, reputation, rangeSize } = get()
        const range = holes.find((h) => h.kind === 'range')
        const course = holes.filter((h) => h.kind === 'hole')
        const published = course.filter((h) => h.rating !== null)
        const avg =
          published.length === 0
            ? 0
            : published.reduce((s, h) => s + (h.rating ?? 0), 0) / published.length

        const rangeRating = range?.rating ?? 42
        const rangeMult = rangeSize === 'large' ? 2.2 : 1
        const rangeTraffic = Math.round(
          (160 + rangeRating * 10 + (range?.playCount ?? 0) * 5) * rangeMult,
        )
        const north = published.filter((h) => h.courseId === 'a').length
        const south = published.filter((h) => h.courseId === 'b').length
        const courseIncome = Math.round(
          published.length * 200 +
            avg * 12 +
            north * 40 +
            south * 55 +
            reputation * (published.length > 0 ? 9 : 3),
        )
        const income = rangeTraffic + courseIncome
        const nextWeek = week + 1
        set({
          week: nextWeek,
          budget: budget + income,
        })
        return { income, week: nextWeek }
      },

      resetClub: () =>
        set({
          screen: 'landing',
          clubName: '',
          budget: STARTING_BUDGET,
          reputation: 8,
          week: 1,
          holes: starterProperty(),
          rangeSize: 'starter',
          activeHoleId: null,
          started: false,
          saveVersion: SAVE_VERSION,
          mapFocusX: 1680,
          mapFocusY: 1280,
        }),

      getActiveHole: () => {
        const { activeHoleId, holes } = get()
        return holes.find((h) => h.id === activeHoleId) ?? null
      },
    }),
    {
      name: 'rolling-greens-v4',
      partialize: (s) => ({
        clubName: s.clubName,
        budget: s.budget,
        reputation: s.reputation,
        week: s.week,
        holes: s.holes.map(serializeHole),
        rangeSize: s.rangeSize,
        activeHoleId: s.activeHoleId,
        started: s.started,
        editor: s.editor,
        saveVersion: SAVE_VERSION,
        mapFocusX: s.mapFocusX,
        mapFocusY: s.mapFocusY,
        screen: s.started ? (s.screen === 'landing' ? 'course' : s.screen) : 'landing',
      }),
      merge: (persisted, current) => {
        const p = persisted as {
          holes?: unknown[]
          saveVersion?: number
          [key: string]: unknown
        }
        if (!p.saveVersion || p.saveVersion < SAVE_VERSION) {
          return { ...current }
        }
        const holes = (p.holes ?? []).map((raw) =>
          deserializeHole(raw as ReturnType<typeof serializeHole>),
        )
        return {
          ...current,
          ...(p as Partial<GameStore>),
          holes: holes.length ? holes : current.holes,
          saveVersion: SAVE_VERSION,
        }
      },
    },
  ),
)
