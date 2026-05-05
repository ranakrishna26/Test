/** Placeholder network model for operator dashboard prototype */

import {
  ALL_SUBSCRIBER_FILTERS,
  type SubscriberGlobalFilters,
} from '../utils/filterPresets'

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

export type SubscriberSegment = 'consumer' | 'enterprise' | 'iot' | 'vip'
export type SubscriberDevice = 'phone' | 'cpe' | 'module'
export type SubscriberTimeHorizon = '1h' | '24h' | '7d' | '30d'

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
  /** Global filter: subscriber type (includes VIP) */
  segment: SubscriberSegment
  /** Global filter: device type */
  device: SubscriberDevice
  /** Metrics visible when selected time range is at least this long (synthetic). */
  timeHorizon: SubscriberTimeHorizon
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

/** ~320 subs per serving cell → ~2.5k total (deterministic, telecom-scale footprint). */
const SUBSCRIBERS_PER_CELL = 320

function mix32(n: number): number {
  let x = n >>> 0
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  return x >>> 0
}

function cellIdSalt(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickSegment(u: number): SubscriberSegment {
  if (u < 0.04) return 'vip'
  if (u < 0.74) return 'consumer'
  if (u < 0.86) return 'enterprise'
  return 'iot'
}

function pickDevice(u: number, segment: SubscriberSegment): SubscriberDevice {
  if (segment === 'iot') return u < 0.85 ? 'module' : 'phone'
  if (segment === 'enterprise') return u < 0.72 ? 'cpe' : 'phone'
  if (u < 0.78) return 'phone'
  if (u < 0.94) return 'cpe'
  return 'module'
}

function pickTimeHorizon(u: number): SubscriberTimeHorizon {
  if (u < 0.12) return '1h'
  if (u < 0.52) return '24h'
  if (u < 0.82) return '7d'
  return '30d'
}

function buildPlaceholderSubscribers(): Subscriber[] {
  const out: Subscriber[] = []
  let seq = 0
  for (const cell of CELLS) {
    for (let slot = 0; slot < SUBSCRIBERS_PER_CELL; slot++) {
      seq++
      const seed = mix32(seq * 2654435761 ^ cellIdSalt(cell.id) ^ slot * 2246822519)
      const u0 = (seed >>> 0) / 2 ** 32
      const u1 = mix32(seed + 1) / 2 ** 32
      const u2 = mix32(seed + 2) / 2 ** 32
      const u3 = mix32(seed + 3) / 2 ** 32
      const u4 = mix32(seed + 4) / 2 ** 32
      const u5 = mix32(seed + 5) / 2 ** 32

      const segment = pickSegment(u0)
      const device = pickDevice(u1, segment)
      const timeHorizon = pickTimeHorizon(u2)

      const dlFactor = 0.48 + u3 * 0.52
      let dlMbps = Math.round(cell.dlMbps * dlFactor * 10) / 10
      if (u4 < 0.08) dlMbps = Math.max(8, Math.round(dlMbps * (0.35 + u5 * 0.45) * 10) / 10)
      const ulMbps = Math.round(cell.ulMbps * (0.42 + u4 * 0.5) * 10) / 10

      const failRoll = mix32(seed + 11) / 2 ** 32
      const setupAccessFailures =
        failRoll < 0.62 ? 0 : failRoll < 0.88 ? 1 + (mix32(seed + 12) % 6) : 7 + (mix32(seed + 13) % 14)

      const dropRoll = mix32(seed + 21) / 2 ** 32
      const callDrops =
        dropRoll < 0.58 ? 0 : dropRoll < 0.9 ? 1 + (mix32(seed + 22) % 4) : 5 + (mix32(seed + 23) % 20)

      const hoBase = cell.hoSuccessPct
      const hoJitter = (mix32(seed + 31) % 700) / 100 - 3.5
      let hoSuccessPct = Math.round((hoBase + hoJitter) * 10) / 10
      hoSuccessPct = Math.max(72, Math.min(99.6, hoSuccessPct))

      const sessions = 6 + (mix32(seed + 41) % 115)

      out.push({
        imsi: `310410******${String(seq).padStart(6, '0')}`,
        cellId: cell.id,
        cellName: cell.name,
        sessions,
        setupAccessFailures,
        callDrops,
        dlMbps,
        ulMbps,
        hoSuccessPct,
        segment,
        device,
        timeHorizon,
      })
    }
  }
  return out
}

/** Subscribers associated with a cell footprint (cell + neighbours); large synthetic population per cell. */
export const SUBSCRIBERS: Subscriber[] = buildPlaceholderSubscribers()

export function subscribersForFootprint(cellId: string): Subscriber[] {
  const footprint = neighborSet(cellId)
  return SUBSCRIBERS.filter((s) => footprint.has(s.cellId))
}

const TIME_RANGE_ORDER: Record<SubscriberTimeHorizon, number> = {
  '1h': 1,
  '24h': 2,
  '7d': 3,
  '30d': 4,
}

function timeRangeCoversSubscriber(selected: string, sub: SubscriberTimeHorizon): boolean {
  const oSel = TIME_RANGE_ORDER[selected as SubscriberTimeHorizon] ?? 2
  const oSub = TIME_RANGE_ORDER[sub]
  return oSel >= oSub
}

/** Same rules as cell table / subscriber drill-down (excludes IMSI search). */
export function applyGlobalSubscriberFilters(
  subs: Subscriber[],
  f: SubscriberGlobalFilters,
): Subscriber[] {
  return subs.filter((s) => {
    if (f.subscriberType !== 'all' && s.segment !== f.subscriberType) return false
    if (f.deviceType !== 'all' && s.device !== f.deviceType) return false
    if (!timeRangeCoversSubscriber(f.timeRange, s.timeHorizon)) return false
    return true
  })
}

/**
 * Cell-table metrics: filtered footprint cohort matches drill-down (global filters only).
 */
export type CellTableMetric = {
  value: number
  affected: number
  total: number
  /** True when footprint has raw subs; total may be 0 if filters exclude everyone. */
  fromAnchors: boolean
}

/** Sum of setup/access failures across filtered footprint subs. */
export function cellTableFailureMetrics(
  c: Cell,
  f: SubscriberGlobalFilters = ALL_SUBSCRIBER_FILTERS,
): CellTableMetric {
  const raw = subscribersForFootprint(c.id)
  if (!raw.length) {
    return {
      value: c.setupAccessFailures,
      affected: 0,
      total: 0,
      fromAnchors: false,
    }
  }
  const subs = applyGlobalSubscriberFilters(raw, f)
  if (!subs.length) {
    return { value: 0, affected: 0, total: 0, fromAnchors: true }
  }
  const value = subs.reduce((a, s) => a + s.setupAccessFailures, 0)
  const affected = subs.filter((s) => s.setupAccessFailures > 0).length
  return { value, affected, total: subs.length, fromAnchors: true }
}

export function cellTableCallDropMetrics(
  c: Cell,
  f: SubscriberGlobalFilters = ALL_SUBSCRIBER_FILTERS,
): CellTableMetric {
  const raw = subscribersForFootprint(c.id)
  if (!raw.length) {
    return { value: c.callDrops, affected: 0, total: 0, fromAnchors: false }
  }
  const subs = applyGlobalSubscriberFilters(raw, f)
  if (!subs.length) {
    return { value: 0, affected: 0, total: 0, fromAnchors: true }
  }
  const value = subs.reduce((a, s) => a + s.callDrops, 0)
  const affected = subs.filter((s) => s.callDrops > 0).length
  return { value, affected, total: subs.length, fromAnchors: true }
}

const PAYLOAD_DL_FRAC = 0.82
const PAYLOAD_UL_FRAC = 0.82

export function cellTablePayloadDlMetrics(
  c: Cell,
  f: SubscriberGlobalFilters = ALL_SUBSCRIBER_FILTERS,
): CellTableMetric {
  const raw = subscribersForFootprint(c.id)
  if (!raw.length) {
    return { value: c.dlMbps, affected: 0, total: 0, fromAnchors: false }
  }
  const subs = applyGlobalSubscriberFilters(raw, f)
  if (!subs.length) {
    return { value: 0, affected: 0, total: 0, fromAnchors: true }
  }
  const value = Math.min(...subs.map((s) => s.dlMbps))
  const threshold = c.dlMbps * PAYLOAD_DL_FRAC
  const affected = subs.filter((s) => s.dlMbps < threshold).length
  return { value, affected, total: subs.length, fromAnchors: true }
}

export function cellTablePayloadUlMetrics(
  c: Cell,
  f: SubscriberGlobalFilters = ALL_SUBSCRIBER_FILTERS,
): CellTableMetric {
  const raw = subscribersForFootprint(c.id)
  if (!raw.length) {
    return { value: c.ulMbps, affected: 0, total: 0, fromAnchors: false }
  }
  const subs = applyGlobalSubscriberFilters(raw, f)
  if (!subs.length) {
    return { value: 0, affected: 0, total: 0, fromAnchors: true }
  }
  const value = Math.min(...subs.map((s) => s.ulMbps))
  const threshold = c.ulMbps * PAYLOAD_UL_FRAC
  const affected = subs.filter((s) => s.ulMbps < threshold).length
  return { value, affected, total: subs.length, fromAnchors: true }
}

export function cellTableHoPctMetrics(
  c: Cell,
  f: SubscriberGlobalFilters = ALL_SUBSCRIBER_FILTERS,
): CellTableMetric {
  const raw = subscribersForFootprint(c.id)
  if (!raw.length) {
    return { value: c.hoSuccessPct, affected: 0, total: 0, fromAnchors: false }
  }
  const subs = applyGlobalSubscriberFilters(raw, f)
  if (!subs.length) {
    return { value: 0, affected: 0, total: 0, fromAnchors: true }
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

export function rankedCells(
  tab: TableTab,
  f: SubscriberGlobalFilters = ALL_SUBSCRIBER_FILTERS,
): Cell[] {
  const list = [...CELLS]
  if (tab === 'failure')
    list.sort((a, b) => {
      const ma = cellTableFailureMetrics(a, f)
      const mb = cellTableFailureMetrics(b, f)
      if (mb.affected !== ma.affected) return mb.affected - ma.affected
      return mb.value - ma.value
    })
  else if (tab === 'callDrop')
    list.sort((a, b) => {
      const ma = cellTableCallDropMetrics(a, f)
      const mb = cellTableCallDropMetrics(b, f)
      if (mb.affected !== ma.affected) return mb.affected - ma.affected
      return mb.value - ma.value
    })
  else if (tab === 'payload')
    list.sort(
      (a, b) =>
        cellTablePayloadDlMetrics(a, f).value - cellTablePayloadDlMetrics(b, f).value,
    )
  else
    list.sort(
      (a, b) => cellTableHoPctMetrics(a, f).value - cellTableHoPctMetrics(b, f).value,
    )
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
export function hoverKpisForCell(
  cellId: string,
  f: SubscriberGlobalFilters = ALL_SUBSCRIBER_FILTERS,
): string {
  const c = CELL_MAP[cellId]
  if (!c) return ''
  const fm = cellTableFailureMetrics(c, f)
  const dlm = cellTablePayloadDlMetrics(c, f)
  const ulm = cellTablePayloadUlMetrics(c, f)
  const hom = cellTableHoPctMetrics(c, f)
  const dl = dlm.fromAnchors ? dlm.value : c.dlMbps
  const ul = ulm.fromAnchors ? ulm.value : c.ulMbps
  const ho = hom.fromAnchors ? hom.value : c.hoSuccessPct
  let s = `DL ${dl} Mbps · UL ${ul} Mbps · HO ${ho.toFixed(1)}%`
  if (fm.fromAnchors) {
    if (fm.total > 0) {
      s += ` · failures with issue / in cohort ${fm.affected}/${fm.total} subs`
    } else {
      s += ' · failures with issue / in cohort 0/0 subs (no match for filters)'
    }
  }
  return s
}

/** Lines for map hover / focus tooltips */
export function mapCellSummaryLines(
  c: Cell,
  f: SubscriberGlobalFilters = ALL_SUBSCRIBER_FILTERS,
): string[] {
  const fm = cellTableFailureMetrics(c, f)
  const dr = cellTableCallDropMetrics(c, f)
  const dlm = cellTablePayloadDlMetrics(c, f)
  const ulm = cellTablePayloadUlMetrics(c, f)
  const hom = cellTableHoPctMetrics(c, f)
  const failShown = fm.fromAnchors ? fm.value : c.setupAccessFailures
  const dropShown = dr.fromAnchors ? dr.value : c.callDrops
  const dlShown = dlm.fromAnchors ? dlm.value : c.dlMbps
  const ulShown = ulm.fromAnchors ? ulm.value : c.ulMbps
  const hoShown = hom.fromAnchors ? hom.value : c.hoSuccessPct
  const lines = [
    `${c.name}`,
    c.id,
    `DL ${dlShown} / UL ${ulShown} Mbps`,
    `HO ${hoShown.toFixed(1)}% · ${c.totalHandovers.toLocaleString()} handovers`,
    `Drops ${dropShown} · Setup/access ${failShown}`,
  ]
  if (fm.fromAnchors) {
    if (fm.total > 0) {
      lines.push(
        `Filtered footprint · failures with issue / in cohort ${fm.affected}/${fm.total} subs`,
        `Drops with issue / in cohort ${dr.affected}/${dr.total} subs`,
      )
    } else {
      lines.push('Filtered footprint · no subscribers match current filters')
    }
  }
  return lines
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

export type { SubscriberGlobalFilters } from '../utils/filterPresets'
