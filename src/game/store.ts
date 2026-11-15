import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { prizeForRating, rateHole } from './rating'
import {
  CADDIE_FEE,
  CART_BUY_COST,
  CART_MAX,
  CART_RENTAL_FEE,
  cartsAvailable,
  emptyRoster,
  hasAvailableCaddie,
  normalizeRoster,
  resolveStaffWeek,
  sculptDiscount,
  staffDef,
  type StaffRole,
  type StaffRoster,
} from './staff'
import {
  createBlankHole,
  createDrivingRange,
  deserializeHole,
  expandRangeLayout,
  inferBuildStage,
  digBunker,
  paint,
  placeWaterFeature,
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
  type WaterMode,
} from './types'
import { defaultPar, nextBuildTarget } from './world'
import {
  DECOR_BY_KIND,
  DECOR_MAX,
  DECOR_REFUND,
  decorWeeklyBonus,
  normalizeDecor,
  type Decoration,
  type DecorModeState,
} from './decor'

interface EditorPrefs {
  tool: EditorTool
  sculptMode: SculptMode
  waterMode: WaterMode
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
  staff: StaffRoster
  /** Golf carts owned for guest rentals / beverage routes */
  carts: number
  /** Benches, plantings and landmarks placed around the grounds */
  decorations: Decoration[]
  /** Active decorating tool (not saved); null when not decorating */
  decorMode: DecorModeState | null

  setScreen: (s: Screen) => void
  startClub: (name: string) => void
  openHole: (id: number) => void
  closeHole: () => void
  setDecorMode: (mode: Partial<DecorModeState> | null) => void
  placeDecoration: (x: number, y: number, z: number) => { ok: boolean; message: string }
  removeDecoration: (id: number) => { ok: boolean; message: string }
  setPar: (par: 3 | 4 | 5) => void
  setHoleName: (name: string) => void
  setEditor: (partial: Partial<EditorPrefs>) => void
  setMapFocus: (x: number, y: number) => void
  applySculpt: (x: number, y: number) => void
  applyPaint: (x: number, y: number) => void
  applyWater: (x: number, y: number) => void
  placeTee: (x: number, y: number) => void
  placePin: (x: number, y: number) => void
  finalizeHole: () => { rating: number; prize: number } | null
  recordPlay: (strokes: number, usedCaddie?: boolean) => void
  hireStaff: (role: StaffRole) => { ok: boolean; message: string }
  fireStaff: (role: StaffRole) => { ok: boolean; message: string }
  buyCart: () => { ok: boolean; message: string }
  sellCart: () => { ok: boolean; message: string }
  buildNextHole: () => { ok: boolean; cost: number; message: string }
  expandRange: () => { ok: boolean; cost: number; message: string }
  advanceWeek: () => {
    income: number
    net: number
    payroll: number
    week: number
    summary: string
  }
  chargeCaddieFee: () => { ok: boolean; fee: number; message: string }
  chargeCartRental: () => { ok: boolean; fee: number; message: string }
  resetClub: () => void
  getActiveHole: () => Hole | null
  courseHoleCount: () => number
  caddiesAvailable: () => boolean
  cartsReady: () => boolean
}

const SAVE_VERSION = 5

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
        tool: 'sculpt',
        sculptMode: 'raise',
        waterMode: 'pond',
        paintType: 'fairway',
        brushRadius: 2.4,
        brushStrength: 0.7,
      },
      started: false,
      saveVersion: SAVE_VERSION,
      mapFocusX: 1840,
      mapFocusY: 1160,
      staff: emptyRoster(),
      carts: 0,
      decorations: [],
      decorMode: null,

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
          mapFocusX: 1840,
          mapFocusY: 1160,
          staff: emptyRoster(),
          carts: 0,
          decorations: [],
          decorMode: null,
        }),

      closeHole: () => set({ activeHoleId: null }),

      setDecorMode: (mode) => {
        if (mode === null) {
          set({ decorMode: null })
          return
        }
        const prev = get().decorMode ?? { tool: 'bench', rot: 0 }
        // Decorating and hole building are separate modes
        set({ decorMode: { ...prev, ...mode }, activeHoleId: null })
      },

      placeDecoration: (x, y, z) => {
        const { decorMode, decorations, budget } = get()
        if (!decorMode || decorMode.tool === 'remove') return { ok: false, message: '' }
        const spec = DECOR_BY_KIND[decorMode.tool]
        if (decorations.length >= DECOR_MAX) {
          return { ok: false, message: `The grounds are full (${DECOR_MAX} decorations)` }
        }
        if (budget < spec.cost) {
          return { ok: false, message: `${spec.name} costs $${spec.cost.toLocaleString()}` }
        }
        const id = decorations.reduce((m, d) => Math.max(m, d.id), 0) + 1
        set({
          budget: budget - spec.cost,
          decorations: [...decorations, { id, kind: spec.kind, x, y, z, rot: decorMode.rot }],
        })
        return { ok: true, message: `${spec.name} placed · −$${spec.cost.toLocaleString()}` }
      },

      removeDecoration: (id) => {
        const { decorations, budget } = get()
        const d = decorations.find((o) => o.id === id)
        if (!d) return { ok: false, message: '' }
        const spec = DECOR_BY_KIND[d.kind]
        const refund = Math.round(spec.cost * DECOR_REFUND)
        set({ budget: budget + refund, decorations: decorations.filter((o) => o.id !== id) })
        return { ok: true, message: `${spec.name} removed · +$${refund.toLocaleString()}` }
      },

      openHole: (id) => {
        const hole = get().holes.find((h) => h.id === id)
        const tool =
          hole?.kind === 'hole' && hole.buildStage === 'raw' ? 'sculpt' : get().editor.tool
        // Editing happens live in the 3D course view — no separate screen
        set({
          decorMode: null,
          activeHoleId: id,
          screen: 'course',
          mapFocusX: hole?.mapX ?? get().mapFocusX,
          mapFocusY: hole?.mapY ?? get().mapFocusY,
          editor: { ...get().editor, tool },
        })
      },

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
        const { activeHoleId, holes, editor, budget, staff } = get()
        if (activeHoleId === null || budget < 1) return
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
        const raw = Math.max(SCULPT_COST, Math.ceil(changed * 0.15))
        const cost = Math.min(
          budget,
          Math.max(1, Math.ceil(raw * (1 - sculptDiscount(staff)))),
        )
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
        // Bunkers are sculpted: new sand sinks into a bowl (Trap depth slider)
        let elevation = hole.elevation
        if (paintType === 'bunker') {
          elevation = new Float32Array(hole.elevation)
          digBunker(
            elevation,
            hole.terrain,
            terrain,
            x,
            y,
            editor.brushRadius,
            0.025 + 0.07 * editor.brushStrength,
            hole.width,
            hole.height,
          )
        }
        const cost = Math.min(budget, changed * unitCost)
        set({
          budget: budget - cost,
          holes: holes.map((h) => {
            if (h.id !== activeHoleId) return h
            const next = { ...h, terrain, elevation, designed: true }
            next.buildStage = inferBuildStage(next)
            return next
          }),
        })
      },

      applyWater: (x, y) => {
        const { activeHoleId, holes, editor, budget } = get()
        if (activeHoleId === null) return
        const hole = holes.find((h) => h.id === activeHoleId)
        if (!hole) return
        const unit = TERRAIN_COST.water
        if (editor.waterMode !== 'drain' && budget < unit) return
        const elevation = new Float32Array(hole.elevation)
        const terrain = new Uint8Array(hole.terrain)
        const radius =
          editor.waterMode === 'lake'
            ? Math.max(editor.brushRadius, editor.brushRadius * 1.35)
            : editor.waterMode === 'stream'
              ? Math.max(1.2, editor.brushRadius * 0.75)
              : editor.brushRadius
        const { elevChanged, terrainChanged } = placeWaterFeature(
          elevation,
          terrain,
          x,
          y,
          radius,
          editor.brushStrength,
          editor.waterMode,
          hole.width,
          hole.height,
        )
        if (!elevChanged && !terrainChanged) return
        const digCost = Math.ceil(elevChanged * 0.2)
        const waterCost =
          editor.waterMode === 'drain' ? 0 : terrainChanged * unit
        const cost = Math.min(budget, digCost + waterCost)
        set({
          budget: budget - cost,
          holes: holes.map((h) => {
            if (h.id !== activeHoleId) return h
            const next = { ...h, elevation, terrain, designed: true }
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

      recordPlay: (strokes, usedCaddie = false) => {
        const { activeHoleId, holes, reputation } = get()
        if (activeHoleId === null) return
        const hole = holes.find((h) => h.id === activeHoleId)
        if (!hole) return
        const underPar = hole.kind === 'range' ? strokes <= 3 : strokes <= hole.par
        const bonus = (underPar ? 1 : 0) + (usedCaddie && underPar ? 1 : 0)
        set({
          reputation: Math.min(100, reputation + bonus),
          holes: holes.map((h) => {
            if (h.id !== activeHoleId) return h
            const best =
              h.bestScore === null ? strokes : Math.min(h.bestScore, strokes)
            return { ...h, playCount: h.playCount + 1, bestScore: best }
          }),
        })
      },

      hireStaff: (role) => {
        const { staff, budget, holes } = get()
        const def = staffDef(role)
        const openHoles = holes.filter((h) => h.kind === 'hole' && h.rating !== null).length
        if (openHoles < def.unlockHoles) {
          return {
            ok: false,
            message: `${def.label}s unlock after ${def.unlockHoles} open hole${def.unlockHoles === 1 ? '' : 's'}.`,
          }
        }
        if (staff[role] >= def.max) {
          return { ok: false, message: `${def.label} roster is full (${def.max}).` }
        }
        if (budget < def.hireCost) {
          return {
            ok: false,
            message: `Need $${def.hireCost.toLocaleString()} to hire a ${def.label.toLowerCase()}.`,
          }
        }
        if (role === 'beverage' && get().carts < 1) {
          return {
            ok: false,
            message: 'Buy at least one cart before hiring a beverage cart driver.',
          }
        }
        set({
          budget: budget - def.hireCost,
          staff: { ...staff, [role]: staff[role] + 1 },
        })
        return {
          ok: true,
          message: `Hired ${def.label.toLowerCase()} (−$${def.hireCost.toLocaleString()}/hire · $${def.wage}/wk).`,
        }
      },

      fireStaff: (role) => {
        const { staff } = get()
        if (staff[role] <= 0) {
          return { ok: false, message: `No ${staffDef(role).label.toLowerCase()}s on payroll.` }
        }
        set({ staff: { ...staff, [role]: staff[role] - 1 } })
        return { ok: true, message: `Let a ${staffDef(role).label.toLowerCase()} go.` }
      },

      buyCart: () => {
        const { carts, budget } = get()
        if (carts >= CART_MAX) {
          return { ok: false, message: `Cart barn full (${CART_MAX}).` }
        }
        if (budget < CART_BUY_COST) {
          return {
            ok: false,
            message: `Need $${CART_BUY_COST.toLocaleString()} for a cart.`,
          }
        }
        set({ budget: budget - CART_BUY_COST, carts: carts + 1 })
        return {
          ok: true,
          message: `Cart added to the fleet (−$${CART_BUY_COST.toLocaleString()}). Guests can rent.`,
        }
      },

      sellCart: () => {
        const { carts, staff, budget } = get()
        if (carts <= 0) return { ok: false, message: 'No carts to sell.' }
        if (carts === 1 && staff.beverage > 0) {
          return {
            ok: false,
            message: 'Keep one cart for beverage routes, or let beverage staff go first.',
          }
        }
        const refund = Math.round(CART_BUY_COST * 0.45)
        set({ carts: carts - 1, budget: budget + refund })
        return { ok: true, message: `Sold a cart (+$${refund.toLocaleString()}).` }
      },

      chargeCaddieFee: () => {
        const { staff, budget } = get()
        if (!hasAvailableCaddie(staff)) {
          return { ok: false, fee: 0, message: 'No caddies on staff — hire one first.' }
        }
        set({ budget: budget + CADDIE_FEE })
        return {
          ok: true,
          fee: CADDIE_FEE,
          message: `Caddie assigned · +$${CADDIE_FEE} fee.`,
        }
      },

      chargeCartRental: () => {
        const { carts, budget } = get()
        if (!cartsAvailable(carts)) {
          return { ok: false, fee: 0, message: 'No carts in the fleet — buy one to rent.' }
        }
        set({ budget: budget + CART_RENTAL_FEE })
        return {
          ok: true,
          fee: CART_RENTAL_FEE,
          message: `Cart rented · +$${CART_RENTAL_FEE}.`,
        }
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
          screen: 'course',
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
        const { week, holes, budget, reputation, rangeSize, staff, carts } = get()
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
        const greensBoost = 1 + staff.greenskeeper * 0.04
        const courseIncome = Math.round(
          (published.length * 200 +
            avg * 12 +
            north * 40 +
            south * 55 +
            reputation * (published.length > 0 ? 9 : 3)) *
            greensBoost,
        )
        const playCount = holes.reduce((s, h) => s + h.playCount, 0)
        const staffWeek = resolveStaffWeek(staff, {
          publishedHoles: published.length,
          rangeOpen: Boolean(range?.rating !== null || range),
          rangeLarge: rangeSize === 'large',
          playCount,
          reputation,
          carts,
        })
        const groundsBonus = decorWeeklyBonus(get().decorations)
        const gross =
          groundsBonus +
          rangeTraffic +
          courseIncome +
          staffWeek.bonusIncome +
          staffWeek.caddieFees +
          staffWeek.cartRentals +
          staffWeek.drinkSales
        const costs = staffWeek.payroll + staffWeek.upkeep
        const net = gross - costs
        const nextWeek = week + 1
        set({
          week: nextWeek,
          budget: budget + net,
          reputation: Math.min(100, Math.max(0, reputation + staffWeek.repDelta)),
        })
        const summary = [
          `Fees +$${(rangeTraffic + courseIncome).toLocaleString()}`,
          ...(groundsBonus > 0 ? [`Grounds +$${groundsBonus.toLocaleString()}`] : []),
          ...staffWeek.lines,
          `Net ${net >= 0 ? '+' : ''}$${net.toLocaleString()}`,
        ].join(' · ')
        return {
          income: gross,
          net,
          payroll: staffWeek.payroll,
          week: nextWeek,
          summary,
        }
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
          mapFocusX: 1840,
          mapFocusY: 1160,
          staff: emptyRoster(),
          carts: 0,
          decorations: [],
          decorMode: null,
        }),

      getActiveHole: () => {
        const { activeHoleId, holes } = get()
        return holes.find((h) => h.id === activeHoleId) ?? null
      },

      courseHoleCount: () => get().holes.filter((h) => h.kind === 'hole').length,

      caddiesAvailable: () => hasAvailableCaddie(get().staff),

      cartsReady: () => cartsAvailable(get().carts),
    }),
    {
      name: 'rolling-greens-v5',
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
        staff: s.staff,
        carts: s.carts,
        decorations: s.decorations,
        screen: s.started ? (s.screen === 'landing' || s.screen === 'editor' ? 'course' : s.screen) : 'landing',
      }),
      merge: (persisted, current) => {
        const p = persisted as {
          holes?: unknown[]
          saveVersion?: number
          staff?: Partial<StaffRoster>
          carts?: number
          editor?: Partial<EditorPrefs>
          [key: string]: unknown
        }
        // Accept v4 saves and inject empty ops; older than 4 resets
        if (!p.saveVersion || p.saveVersion < 4) {
          return { ...current }
        }
        const holes = (p.holes ?? []).map((raw) =>
          deserializeHole(raw as ReturnType<typeof serializeHole>),
        )
        const savedEditor = (p.editor ?? {}) as Partial<EditorPrefs>
        return {
          ...current,
          ...(p as Partial<GameStore>),
          holes: holes.length ? holes : current.holes,
          editor: { ...current.editor, ...savedEditor },
          staff: normalizeRoster(p.staff),
          carts: Math.max(0, Math.min(CART_MAX, Math.floor(Number(p.carts) || 0))),
          decorations: normalizeDecor(p.decorations),
          decorMode: null,
          // The old standalone editor screen now lives inside the course view
          screen: p.screen === 'editor' ? 'course' : (p.screen as Screen | undefined) ?? current.screen,
          saveVersion: SAVE_VERSION,
        }
      },
    },
  ),
)

// Dev-only handle for poking at state from the browser console / tests
if (import.meta.env.DEV) {
  ;(globalThis as unknown as { __rgGame?: typeof useGame }).__rgGame = useGame
}
