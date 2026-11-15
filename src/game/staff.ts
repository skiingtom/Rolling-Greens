export type StaffRole =
  | 'landscaper'
  | 'greenskeeper'
  | 'maintenance'
  | 'cook'
  | 'attendant'
  | 'coach'
  | 'caddie'
  | 'beverage'

export type StaffRoster = Record<StaffRole, number>

export interface StaffRoleDef {
  id: StaffRole
  label: string
  hireCost: number
  wage: number
  max: number
  blurb: string
  /** Minimum open course holes before this role can be hired */
  unlockHoles: number
}

/** Fee guests pay when a caddie is available and assigned */
export const CADDIE_FEE = 55
/** Per-round cart rental fee charged to guests */
export const CART_RENTAL_FEE = 40
/** Cost to buy one cart into the fleet */
export const CART_BUY_COST = 900
/** Max carts in the barn */
export const CART_MAX = 12
/** Average drink spend when a beverage cart stops a group */
export const DRINK_SALE = 18

export const STAFF_ROLES: StaffRoleDef[] = [
  {
    id: 'landscaper',
    label: 'Landscaper',
    hireCost: 420,
    wage: 85,
    max: 6,
    unlockHoles: 0,
    blurb: 'Shapes grounds and cuts earthwork costs while you sculpt.',
  },
  {
    id: 'greenskeeper',
    label: 'Greenskeeper',
    hireCost: 680,
    wage: 120,
    max: 8,
    unlockHoles: 0,
    blurb: 'Keeps greens true — lifts course fees and reputation.',
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    hireCost: 510,
    wage: 95,
    max: 6,
    unlockHoles: 0,
    blurb: 'Cart paths, pumps, and mowers — lowers weekly upkeep.',
  },
  {
    id: 'cook',
    label: 'Cook',
    hireCost: 560,
    wage: 110,
    max: 4,
    unlockHoles: 1,
    blurb: 'Clubhouse kitchen — food & beverage revenue.',
  },
  {
    id: 'attendant',
    label: 'Attendant',
    hireCost: 380,
    wage: 75,
    max: 8,
    unlockHoles: 0,
    blurb: 'Bag drop, cart barn, and guest services at the desk.',
  },
  {
    id: 'coach',
    label: 'Coach',
    hireCost: 720,
    wage: 140,
    max: 4,
    unlockHoles: 0,
    blurb: 'Lessons on the range — practice traffic and tips.',
  },
  {
    id: 'caddie',
    label: 'Caddie',
    hireCost: 340,
    wage: 70,
    max: 10,
    unlockHoles: 1,
    blurb: 'Available for hire on the course — guests pay a caddie fee.',
  },
  {
    id: 'beverage',
    label: 'Beverage cart',
    hireCost: 480,
    wage: 90,
    max: 4,
    unlockHoles: 1,
    blurb: 'Drives the drink cart — sells cold drinks out on the holes.',
  },
]

export function emptyRoster(): StaffRoster {
  return {
    landscaper: 0,
    greenskeeper: 0,
    maintenance: 0,
    cook: 0,
    attendant: 0,
    coach: 0,
    caddie: 0,
    beverage: 0,
  }
}

export function normalizeRoster(raw: Partial<StaffRoster> | null | undefined): StaffRoster {
  const base = emptyRoster()
  if (!raw) return base
  for (const role of STAFF_ROLES) {
    const n = Number(raw[role.id] ?? 0)
    base[role.id] = Math.max(0, Math.min(role.max, Math.floor(Number.isFinite(n) ? n : 0)))
  }
  return base
}

export function staffDef(role: StaffRole): StaffRoleDef {
  return STAFF_ROLES.find((r) => r.id === role)!
}

export function totalStaff(roster: StaffRoster): number {
  return STAFF_ROLES.reduce((sum, r) => sum + roster[r.id], 0)
}

export function weeklyPayroll(roster: StaffRoster): number {
  return STAFF_ROLES.reduce((sum, r) => sum + roster[r.id] * r.wage, 0)
}

/** Discount on land-sculpt strokes from landscapers (0–0.45) */
export function sculptDiscount(roster: StaffRoster): number {
  return Math.min(0.45, roster.landscaper * 0.07)
}

export function hasAvailableCaddie(roster: StaffRoster): boolean {
  return roster.caddie > 0
}

export function cartsAvailable(carts: number): boolean {
  return carts > 0
}

/** Beverage vendors need at least one cart to roam the course */
export function beverageCartsReady(roster: StaffRoster, carts: number): boolean {
  return roster.beverage > 0 && carts > 0
}

export interface StaffWeekContext {
  publishedHoles: number
  rangeOpen: boolean
  rangeLarge: boolean
  playCount: number
  reputation: number
  carts: number
}

export interface StaffWeekResult {
  bonusIncome: number
  upkeep: number
  payroll: number
  repDelta: number
  caddieFees: number
  cartRentals: number
  drinkSales: number
  lines: string[]
}

/**
 * Weekly staff + fleet economic effects after base green fees are calculated.
 */
export function resolveStaffWeek(roster: StaffRoster, ctx: StaffWeekContext): StaffWeekResult {
  const lines: string[] = []
  let bonusIncome = 0
  let repDelta = 0

  const baseUpkeep =
    90 +
    ctx.publishedHoles * 28 +
    (ctx.rangeLarge ? 80 : ctx.rangeOpen ? 40 : 0) +
    ctx.carts * 12
  const maintRelief = Math.min(0.55, roster.maintenance * 0.09)
  const upkeep = Math.round(baseUpkeep * (1 - maintRelief))

  if (roster.landscaper > 0) {
    const n = Math.round(roster.landscaper * (35 + ctx.publishedHoles * 4))
    bonusIncome += n
    lines.push(`Landscapers +$${n}`)
  }
  if (roster.greenskeeper > 0) {
    const n = Math.round(roster.greenskeeper * (55 + ctx.publishedHoles * 8))
    bonusIncome += n
    repDelta += Math.min(3, Math.floor(roster.greenskeeper / 2))
    lines.push(`Greenskeepers +$${n}`)
  }
  if (roster.cook > 0) {
    const covers = 40 + ctx.publishedHoles * 12 + (ctx.rangeOpen ? 25 : 0)
    const n = Math.round(roster.cook * covers * 1.8)
    bonusIncome += n
    lines.push(`Kitchen +$${n}`)
  }
  if (roster.attendant > 0) {
    const barn = ctx.carts > 0 ? ctx.carts * 8 : 0
    const n = Math.round(roster.attendant * (48 + ctx.reputation * 0.6) + barn)
    bonusIncome += n
    lines.push(`Attendants +$${n}`)
  }
  if (roster.coach > 0 && ctx.rangeOpen) {
    const n = Math.round(roster.coach * (70 + (ctx.rangeLarge ? 40 : 15)))
    bonusIncome += n
    repDelta += roster.coach > 1 ? 1 : 0
    lines.push(`Coaches +$${n}`)
  }

  let caddieFees = 0
  if (roster.caddie > 0 && ctx.publishedHoles > 0) {
    const demand = Math.min(
      roster.caddie * 6,
      Math.round(ctx.playCount * 0.45 + ctx.publishedHoles * 2 + ctx.reputation * 0.15),
    )
    caddieFees = demand * CADDIE_FEE
    if (caddieFees > 0) lines.push(`Caddie fees +$${caddieFees}`)
  }

  // Cart rentals — fleet size caps how many groups rent
  let cartRentals = 0
  if (ctx.carts > 0 && ctx.publishedHoles > 0) {
    const attendantBoost = 1 + roster.attendant * 0.08
    const demand = Math.min(
      ctx.carts * 5,
      Math.round(
        (ctx.playCount * 0.55 + ctx.publishedHoles * 3 + ctx.reputation * 0.2) * attendantBoost,
      ),
    )
    cartRentals = demand * CART_RENTAL_FEE
    if (cartRentals > 0) lines.push(`Cart rentals +$${cartRentals}`)
  }

  // Beverage cart girls selling drinks — need staff + a cart to drive
  let drinkSales = 0
  if (beverageCartsReady(roster, ctx.carts) && ctx.publishedHoles > 0) {
    const stops = Math.min(
      roster.beverage * 14,
      Math.round(ctx.publishedHoles * 4 + ctx.playCount * 0.35 + ctx.reputation * 0.25),
    )
    drinkSales = stops * DRINK_SALE
    if (drinkSales > 0) lines.push(`Drink cart +$${drinkSales}`)
    if (roster.beverage >= 2) repDelta += 1
  } else if (roster.beverage > 0 && ctx.carts === 0) {
    lines.push('Drink cart idle — buy a cart for the fleet')
  }

  const payroll = weeklyPayroll(roster)
  if (payroll > 0) lines.push(`Payroll −$${payroll}`)
  if (upkeep > 0) lines.push(`Upkeep −$${upkeep}`)

  return {
    bonusIncome,
    upkeep,
    payroll,
    repDelta,
    caddieFees,
    cartRentals,
    drinkSales,
    lines,
  }
}
