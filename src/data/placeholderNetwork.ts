/** Placeholder network model for operator dashboard prototype */

export type TableTab = 'failure' | 'callDrop' | 'payload' | 'handover'

export interface Cell {
  id: string
  name: string
  setupAccessFailures: number
  callDrops: number
  dlMbps: number
  ulMbps: number
  totalHandovers: number
  hoSuccessPct: number
  mapX: number
  mapY: number
  neighborIds: string[]
}

export interface Subscriber {
  imsi: string
  /** Primary / anchor cell for display */
  cellId: string
  cellName: string
  sessions: number
  setupAccessFailures: number
  callDrops: number
  dlMbps: number
  ulMbps: number
  hoSuccessPct: number
}

export interface SessionRow {
  id: string
  signalQuality: number
  throughputMbps: number
  ulMbps: number
  connectivity: string
  packetLossPct: number
  cellId: string
  cellName: string
  /** Count of setup/access failures attributed to this session (placeholder) */
  setupAccessFailures: number
  /** 1 if session ended in drop-like outcome */
  callDrops: number
  handoverAttempted: boolean
  handoverSuccess: boolean
}

export const CELLS: Cell[] = [
  {
    id: 'NR-1021',
    name: 'Alpha-21',
    setupAccessFailures: 42,
    callDrops: 128,
    dlMbps: 38,
    ulMbps: 9.2,
    totalHandovers: 2100,
    hoSuccessPct: 91.2,
    mapX: 22,
    mapY: 32,
    neighborIds: ['NR-4103', 'NR-8842'],
  },
  {
    id: 'NR-4103',
    name: 'Delta-09',
    setupAccessFailures: 31,
    callDrops: 96,
    dlMbps: 44,
    ulMbps: 11.0,
    totalHandovers: 1840,
    hoSuccessPct: 88.4,
    mapX: 58,
    mapY: 38,
    neighborIds: ['NR-1021', 'NR-6002', 'NR-5520'],
  },
  {
    id: 'NR-8842',
    name: 'Beta-14',
    setupAccessFailures: 18,
    callDrops: 54,
    dlMbps: 62,
    ulMbps: 14.5,
    totalHandovers: 1200,
    hoSuccessPct: 95.1,
    mapX: 40,
    mapY: 58,
    neighborIds: ['NR-1021', 'NR-9934'],
  },
  {
    id: 'NR-5520',
    name: 'Gamma-07',
    setupAccessFailures: 12,
    callDrops: 41,
    dlMbps: 71,
    ulMbps: 16.2,
    totalHandovers: 980,
    hoSuccessPct: 96.8,
    mapX: 72,
    mapY: 62,
    neighborIds: ['NR-4103', 'NR-7710'],
  },
  {
    id: 'NR-6002',
    name: 'Theta-08',
    setupAccessFailures: 26,
    callDrops: 72,
    dlMbps: 33,
    ulMbps: 7.8,
    totalHandovers: 1500,
    hoSuccessPct: 89.0,
    mapX: 78,
    mapY: 22,
    neighborIds: ['NR-4103'],
  },
  {
    id: 'NR-9934',
    name: 'Zeta-12',
    setupAccessFailures: 9,
    callDrops: 22,
    dlMbps: 88,
    ulMbps: 19.0,
    totalHandovers: 760,
    hoSuccessPct: 97.9,
    mapX: 28,
    mapY: 72,
    neighborIds: ['NR-8842'],
  },
  {
    id: 'NR-7710',
    name: 'Eta-45',
    setupAccessFailures: 5,
    callDrops: 14,
    dlMbps: 102,
    ulMbps: 22.0,
    totalHandovers: 540,
    hoSuccessPct: 98.6,
    mapX: 55,
    mapY: 82,
    neighborIds: ['NR-5520'],
  },
  {
    id: 'NR-2201',
    name: 'Epsilon-33',
    setupAccessFailures: 15,
    callDrops: 38,
    dlMbps: 55,
    ulMbps: 12.0,
    totalHandovers: 890,
    hoSuccessPct: 94.0,
    mapX: 12,
    mapY: 48,
    neighborIds: ['NR-1021'],
  },
]

const CELL_MAP = Object.fromEntries(CELLS.map((c) => [c.id, c])) as Record<string, Cell>

export function cellById(id: string): Cell | undefined {
  return CELL_MAP[id]
}

export function neighborSet(cellId: string): Set<string> {
  const c = CELL_MAP[cellId]
  if (!c) return new Set()
  return new Set([cellId, ...c.neighborIds])
}

/** Subscribers associated with a cell footprint (cell + neighbors) */
export const SUBSCRIBERS: Subscriber[] = [
  {
    imsi: '310410******891',
    cellId: 'NR-1021',
    cellName: 'Alpha-21',
    sessions: 48,
    setupAccessFailures: 14,
    callDrops: 22,
    dlMbps: 28,
    ulMbps: 6.1,
    hoSuccessPct: 82.0,
  },
  {
    imsi: '310410******902',
    cellId: 'NR-4103',
    cellName: 'Delta-09',
    sessions: 36,
    setupAccessFailures: 11,
    callDrops: 19,
    dlMbps: 31,
    ulMbps: 7.2,
    hoSuccessPct: 84.5,
  },
  {
    imsi: '310410******915',
    cellId: 'NR-1021',
    cellName: 'Alpha-21',
    sessions: 52,
    setupAccessFailures: 9,
    callDrops: 31,
    dlMbps: 22,
    ulMbps: 5.0,
    hoSuccessPct: 79.2,
  },
  {
    imsi: '310410******928',
    cellId: 'NR-8842',
    cellName: 'Beta-14',
    sessions: 24,
    setupAccessFailures: 6,
    callDrops: 8,
    dlMbps: 58,
    ulMbps: 13.0,
    hoSuccessPct: 93.0,
  },
  {
    imsi: '310410******934',
    cellId: 'NR-4103',
    cellName: 'Delta-09',
    sessions: 41,
    setupAccessFailures: 18,
    callDrops: 12,
    dlMbps: 40,
    ulMbps: 9.5,
    hoSuccessPct: 86.0,
  },
  {
    imsi: '310410******941',
    cellId: 'NR-6002',
    cellName: 'Theta-08',
    sessions: 19,
    setupAccessFailures: 7,
    callDrops: 15,
    dlMbps: 26,
    ulMbps: 6.8,
    hoSuccessPct: 87.5,
  },
]

export function subscribersForFootprint(cellId: string): Subscriber[] {
  const footprint = neighborSet(cellId)
  return SUBSCRIBERS.filter((s) => footprint.has(s.cellId))
}

/** Subscribers whose primary anchor cell is this cell (excludes neighbour-only rows). */
export function subscribersOnCell(cellId: string): Subscriber[] {
  return SUBSCRIBERS.filter((s) => s.cellId === cellId)
}

/**
 * Cell-table headline + subscriber ratio, all from the same source when anchor
 * subscribers exist on that cell; otherwise headline uses RAN (Cell) totals
 * and no ratio is shown.
 */
export type CellTableMetric = {
  value: number
  affected: number
  total: number
  /** When true, `value` is derived from anchor subscribers (matches x/y). */
  fromAnchors: boolean
}

/** Sum of setup/access failures across anchor subscribers; ratio = subs with any failures. */
export function cellTableFailureMetrics(c: Cell): CellTableMetric {
  const subs = subscribersOnCell(c.id)
  if (!subs.length) {
    return {
      value: c.setupAccessFailures,
      affected: 0,
      total: 0,
      fromAnchors: false,
    }
  }
  const value = subs.reduce((a, s) => a + s.setupAccessFailures, 0)
  const affected = subs.filter((s) => s.setupAccessFailures > 0).length
  return { value, affected, total: subs.length, fromAnchors: true }
}

/** Sum of call drops across anchor subscribers; ratio = subs with any drops. */
export function cellTableCallDropMetrics(c: Cell): CellTableMetric {
  const subs = subscribersOnCell(c.id)
  if (!subs.length) {
    return { value: c.callDrops, affected: 0, total: 0, fromAnchors: false }
  }
  const value = subs.reduce((a, s) => a + s.callDrops, 0)
  const affected = subs.filter((s) => s.callDrops > 0).length
  return { value, affected, total: subs.length, fromAnchors: true }
}

/** Worst DL among anchors vs RAN headline; ratio = subs below fraction of cell DL. */
const PAYLOAD_DL_FRAC = 0.82
const PAYLOAD_UL_FRAC = 0.82

export function cellTablePayloadDlMetrics(c: Cell): CellTableMetric {
  const subs = subscribersOnCell(c.id)
  if (!subs.length) {
    return { value: c.dlMbps, affected: 0, total: 0, fromAnchors: false }
  }
  const value = Math.min(...subs.map((s) => s.dlMbps))
  const threshold = c.dlMbps * PAYLOAD_DL_FRAC
  const affected = subs.filter((s) => s.dlMbps < threshold).length
  return { value, affected, total: subs.length, fromAnchors: true }
}

export function cellTablePayloadUlMetrics(c: Cell): CellTableMetric {
  const subs = subscribersOnCell(c.id)
  if (!subs.length) {
    return { value: c.ulMbps, affected: 0, total: 0, fromAnchors: false }
  }
  const value = Math.min(...subs.map((s) => s.ulMbps))
  const threshold = c.ulMbps * PAYLOAD_UL_FRAC
  const affected = subs.filter((s) => s.ulMbps < threshold).length
  return { value, affected, total: subs.length, fromAnchors: true }
}

/** Worst HO% among anchors; ratio = subs below cell HO minus margin (capped). */
export function cellTableHoPctMetrics(c: Cell): CellTableMetric {
  const subs = subscribersOnCell(c.id)
  if (!subs.length) {
    return { value: c.hoSuccessPct, affected: 0, total: 0, fromAnchors: false }
  }
  const value = Math.min(...subs.map((s) => s.hoSuccessPct))
  const bar = Math.min(92.5, c.hoSuccessPct - 0.5)
  const affected = subs.filter((s) => s.hoSuccessPct < bar).length
  return { value, affected, total: subs.length, fromAnchors: true }
}

function sessionsForImsi(imsi: string): SessionRow[] {
  const base = imsi.slice(-3)
  const n = parseInt(base, 10) || 0
  const cells = ['NR-1021', 'NR-4103', 'NR-8842', 'NR-6002']
  return Array.from({ length: 12 }, (_, i) => {
    const cid = cells[(i + n) % cells.length]
    const cell = CELL_MAP[cid]
    const hoAtt = i % 3 !== 0
    const hoOk = hoAtt && i % 5 !== 0
    const accessFail = i % 4 === 0 ? 2 : i % 7 === 0 ? 1 : 0
    const drop = i % 6 === 0 || i % 9 === 0 ? 1 : 0
    const dl = 12 + (i * 7) % 55
    return {
      id: `SES-${imsi.slice(-4)}-${1000 + i}`,
      signalQuality: 3.2 + (i % 4) * 0.4 - (i % 7 === 0 ? 1.1 : 0),
      throughputMbps: dl,
      ulMbps: Math.round(dl * 0.22 * 10) / 10,
      connectivity: i % 5 === 0 ? 'Intermittent' : i % 5 === 2 ? 'Degraded' : 'Stable',
      packetLossPct: 0.2 + (i % 6) * 0.35 + (i % 4 === 0 ? 1.2 : 0),
      cellId: cid,
      cellName: cell?.name ?? cid,
      setupAccessFailures: accessFail,
      callDrops: drop,
      handoverAttempted: hoAtt,
      handoverSuccess: hoOk,
    }
  })
}

export function getSessions(imsi: string): SessionRow[] {
  return sessionsForImsi(imsi)
}

export function subscriberFootprint(imsi: string): {
  direct: Set<string>
  all: Set<string>
} {
  const sessions = sessionsForImsi(imsi)
  const direct = new Set(sessions.map((s) => s.cellId))
  const all = new Set<string>()
  direct.forEach((id) => neighborSet(id).forEach((x) => all.add(x)))
  return { direct, all }
}

export function cellsForSubscriber(imsi: string): Set<string> {
  return subscriberFootprint(imsi).all
}

export function rankedCells(tab: TableTab): Cell[] {
  const list = [...CELLS]
  if (tab === 'failure')
    list.sort(
      (a, b) => cellTableFailureMetrics(b).value - cellTableFailureMetrics(a).value,
    )
  else if (tab === 'callDrop')
    list.sort((a, b) => cellTableCallDropMetrics(b).value - cellTableCallDropMetrics(a).value)
  else if (tab === 'payload')
    list.sort(
      (a, b) => cellTablePayloadDlMetrics(a).value - cellTablePayloadDlMetrics(b).value,
    )
  else list.sort((a, b) => cellTableHoPctMetrics(a).value - cellTableHoPctMetrics(b).value)
  return list
}

export function sortSubscribersByTab(rows: Subscriber[], tab: TableTab): Subscriber[] {
  const copy = [...rows]
  if (tab === 'failure') copy.sort((a, b) => b.setupAccessFailures - a.setupAccessFailures)
  else if (tab === 'callDrop') copy.sort((a, b) => b.callDrops - a.callDrops)
  else if (tab === 'payload') copy.sort((a, b) => a.dlMbps - b.dlMbps)
  else copy.sort((a, b) => a.hoSuccessPct - b.hoSuccessPct)
  return copy
}

export function tabHeadlineLabel(tab: TableTab): string {
  if (tab === 'failure') return 'Setup / access failures'
  if (tab === 'callDrop') return 'Call drops'
  if (tab === 'payload') return 'DL Mbps'
  return 'HO success %'
}

export function headlineMetric(sub: Subscriber, tab: TableTab): string {
  if (tab === 'failure') return String(sub.setupAccessFailures)
  if (tab === 'callDrop') return String(sub.callDrops)
  if (tab === 'payload') return `${sub.dlMbps} / ${sub.ulMbps}`
  return `${sub.hoSuccessPct.toFixed(1)}%`
}

/** KPI snapshot for map hover (state 3) */
export function hoverKpisForCell(cellId: string): string {
  const c = CELL_MAP[cellId]
  if (!c) return ''
  const dlm = cellTablePayloadDlMetrics(c)
  const ulm = cellTablePayloadUlMetrics(c)
  const hom = cellTableHoPctMetrics(c)
  const dl = dlm.fromAnchors ? dlm.value : c.dlMbps
  const ul = ulm.fromAnchors ? ulm.value : c.ulMbps
  const ho = hom.fromAnchors ? hom.value : c.hoSuccessPct
  return `DL ${dl} Mbps · UL ${ul} Mbps · HO ${ho.toFixed(1)}%`
}

/** Lines for map hover / focus tooltips */
export function mapCellSummaryLines(c: Cell): string[] {
  const f = cellTableFailureMetrics(c)
  const dr = cellTableCallDropMetrics(c)
  const dlm = cellTablePayloadDlMetrics(c)
  const ulm = cellTablePayloadUlMetrics(c)
  const hom = cellTableHoPctMetrics(c)
  const failShown = f.fromAnchors ? f.value : c.setupAccessFailures
  const dropShown = dr.fromAnchors ? dr.value : c.callDrops
  const dlShown = dlm.fromAnchors ? dlm.value : c.dlMbps
  const ulShown = ulm.fromAnchors ? ulm.value : c.ulMbps
  const hoShown = hom.fromAnchors ? hom.value : c.hoSuccessPct
  return [
    `${c.name}`,
    c.id,
    `DL ${dlShown} / UL ${ulShown} Mbps`,
    `HO ${hoShown.toFixed(1)}% · ${c.totalHandovers.toLocaleString()} handovers`,
    `Drops ${dropShown} · Setup/access ${failShown}`,
  ]
}

export type ComparePeriodOption = '1h' | '24h' | '7d' | '30d' | 'custom'

export function globalTimeRangeLabel(range: string): string {
  switch (range) {
    case '1h':
      return 'Last 1 hour'
    case '24h':
      return 'Last 24 hours'
    case '7d':
      return 'Last 7 days'
    case '30d':
      return 'Last 30 days'
    default:
      return range
  }
}

export function comparePeriodBLabel(
  option: ComparePeriodOption,
  customStart: string,
  customEnd: string,
): string {
  if (option === 'custom' && customStart && customEnd) {
    return `${customStart} → ${customEnd}`
  }
  if (option === 'custom') return 'Custom range'
  return globalTimeRangeLabel(option)
}

function customSpanDays(start: string, end: string): number {
  if (!start || !end) return 7
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 7
  return Math.max(1, (b - a) / 86400000)
}

/** Relative width vs ~24h baseline for synthetic period B adjustment */
function compareWindowWeight(
  option: ComparePeriodOption,
  customStart: string,
  customEnd: string,
): number {
  switch (option) {
    case '1h':
      return 0.22
    case '24h':
      return 0.55
    case '7d':
      return 1.0
    case '30d':
      return 1.28
    case 'custom':
      return Math.min(1.45, 0.35 + customSpanDays(customStart, customEnd) / 10)
    default:
      return 0.55
  }
}

export function comparisonKpiFromTab(tab: TableTab): {
  label: string
  format: (v: number) => string
} {
  if (tab === 'failure')
    return { label: 'Setup / access failures', format: (v) => String(Math.round(v)) }
  if (tab === 'callDrop') return { label: 'Call drops', format: (v) => String(Math.round(v)) }
  if (tab === 'payload')
    return { label: 'Avg DL throughput (Mbps)', format: (v) => v.toFixed(1) }
  return { label: 'HO success %', format: (v) => `${v.toFixed(1)}%` }
}

export function aggregateKpiFromSessions(
  sessions: SessionRow[],
  tab: TableTab,
): number {
  if (!sessions.length) return 0
  if (tab === 'failure') {
    return sessions.reduce((a, s) => a + s.setupAccessFailures, 0)
  }
  if (tab === 'callDrop') {
    return sessions.reduce((a, s) => a + s.callDrops, 0)
  }
  if (tab === 'payload') {
    return sessions.reduce((a, s) => a + s.throughputMbps, 0) / sessions.length
  }
  const attempted = sessions.filter((s) => s.handoverAttempted).length
  if (!attempted) return 0
  const ok = sessions.filter((s) => s.handoverAttempted && s.handoverSuccess).length
  return (100 * ok) / attempted
}

export function computePeriodBKpiValue(
  valueA: number,
  tab: TableTab,
  option: ComparePeriodOption,
  customStart: string,
  customEnd: string,
): number {
  const w = compareWindowWeight(option, customStart, customEnd)
  const base = w / 0.55
  if (tab === 'handover') {
    const delta = (base - 1) * 7
    return Math.min(100, Math.max(0, valueA - delta))
  }
  if (tab === 'payload') {
    return Math.max(0, valueA * (1 + (base - 1) * 0.22))
  }
  return Math.max(0, Math.round(valueA * base))
}
