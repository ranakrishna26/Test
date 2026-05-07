/** Placeholder network model for operator dashboard prototype */

import {
  ALL_SUBSCRIBER_FILTERS,
  type SubscriberGlobalFilters,
} from '../utils/filterPresets'

export type TableTab = 'failure' | 'callDrop' | 'payload' | 'handover'

export interface Cell {
  id: string
  name: string
  siteCode: string
  sector: string
  azimuthDeg: number
  pci: number
  nrArfcn: number
  band: string
  bandwidthMhz: number
  tac: number
  antennaHeightM: number
  electricalTiltDeg: number
  vendor: string
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
export type SubscriberTimeHorizon = '15m' | '1h' | '24h' | '7d' | '30d'

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

export const VIP_HIGHWAY_IMSI = '310410******777777'

export const CELLS: Cell[] = [
  {
    id: 'NR-1021',
    name: 'LDN-Paddington-GW',
    setupAccessFailures: 42,
    callDrops: 128,
    dlMbps: 38,
    ulMbps: 9.2,
    totalHandovers: 2100,
    hoSuccessPct: 91.2,
    siteCode: 'LDN001',
    sector: 'S1',
    azimuthDeg: 70,
    pci: 101,
    nrArfcn: 636666,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41021,
    antennaHeightM: 28,
    electricalTiltDeg: 6,
    vendor: 'Nokia',
    mapX: 24,
    mapY: 46,
    neighborIds: ['NR-4103', 'NR-2201', 'NR-4478'],
  },
  {
    id: 'NR-4103',
    name: 'LDN-MarbleArch-A40',
    setupAccessFailures: 31,
    callDrops: 96,
    dlMbps: 44,
    ulMbps: 11.0,
    totalHandovers: 1840,
    hoSuccessPct: 88.4,
    siteCode: 'LDN002',
    sector: 'S2',
    azimuthDeg: 92,
    pci: 123,
    nrArfcn: 636834,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41022,
    antennaHeightM: 31,
    electricalTiltDeg: 5,
    vendor: 'Ericsson',
    mapX: 38,
    mapY: 46,
    neighborIds: ['NR-1021', 'NR-6002', 'NR-8842'],
  },
  {
    id: 'NR-8842',
    name: 'LDN-OxfordCircus-Central',
    setupAccessFailures: 18,
    callDrops: 54,
    dlMbps: 62,
    ulMbps: 14.5,
    totalHandovers: 1200,
    hoSuccessPct: 95.1,
    siteCode: 'LDN003',
    sector: 'S1',
    azimuthDeg: 108,
    pci: 147,
    nrArfcn: 637002,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41023,
    antennaHeightM: 30,
    electricalTiltDeg: 6,
    vendor: 'Nokia',
    mapX: 56,
    mapY: 47,
    neighborIds: ['NR-4103', 'NR-5520', 'NR-9934', 'NR-3305', 'NR-6612'],
  },
  {
    id: 'NR-5520',
    name: 'LDN-BondStreet-West',
    setupAccessFailures: 12,
    callDrops: 41,
    dlMbps: 71,
    ulMbps: 16.2,
    totalHandovers: 980,
    hoSuccessPct: 96.8,
    siteCode: 'LDN004',
    sector: 'S3',
    azimuthDeg: 122,
    pci: 165,
    nrArfcn: 637170,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41024,
    antennaHeightM: 27,
    electricalTiltDeg: 4,
    vendor: 'Samsung',
    mapX: 68,
    mapY: 40,
    neighborIds: ['NR-8842', 'NR-6002', 'NR-7710', 'NR-3305'],
  },
  {
    id: 'NR-6002',
    name: 'LDN-RegentStreet-North',
    setupAccessFailures: 26,
    callDrops: 72,
    dlMbps: 33,
    ulMbps: 7.8,
    totalHandovers: 1500,
    hoSuccessPct: 89.0,
    siteCode: 'LDN005',
    sector: 'S2',
    azimuthDeg: 188,
    pci: 182,
    nrArfcn: 635910,
    band: 'n78',
    bandwidthMhz: 80,
    tac: 41025,
    antennaHeightM: 34,
    electricalTiltDeg: 7,
    vendor: 'Ericsson',
    mapX: 48,
    mapY: 34,
    neighborIds: ['NR-4103', 'NR-2201', 'NR-5520'],
  },
  {
    id: 'NR-9934',
    name: 'LDN-Soho-Core',
    setupAccessFailures: 9,
    callDrops: 22,
    dlMbps: 88,
    ulMbps: 19.0,
    totalHandovers: 760,
    hoSuccessPct: 97.9,
    siteCode: 'LDN006',
    sector: 'S1',
    azimuthDeg: 135,
    pci: 207,
    nrArfcn: 637338,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41026,
    antennaHeightM: 29,
    electricalTiltDeg: 5,
    vendor: 'Nokia',
    mapX: 76,
    mapY: 45,
    neighborIds: ['NR-8842', 'NR-7710', 'NR-5588', 'NR-7744'],
  },
  {
    id: 'NR-7710',
    name: 'LDN-Mayfair-East',
    setupAccessFailures: 5,
    callDrops: 14,
    dlMbps: 102,
    ulMbps: 22.0,
    totalHandovers: 540,
    hoSuccessPct: 98.6,
    siteCode: 'LDN007',
    sector: 'S3',
    azimuthDeg: 154,
    pci: 229,
    nrArfcn: 637506,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41027,
    antennaHeightM: 26,
    electricalTiltDeg: 4,
    vendor: 'Ericsson',
    mapX: 83,
    mapY: 30,
    neighborIds: ['NR-5520', 'NR-9934', 'NR-5588'],
  },
  {
    id: 'NR-2201',
    name: 'LDN-Marylebone-Exchange',
    setupAccessFailures: 15,
    callDrops: 38,
    dlMbps: 55,
    ulMbps: 12.0,
    totalHandovers: 890,
    hoSuccessPct: 94.0,
    siteCode: 'LDN008',
    sector: 'S2',
    azimuthDeg: 246,
    pci: 244,
    nrArfcn: 635742,
    band: 'n78',
    bandwidthMhz: 80,
    tac: 41028,
    antennaHeightM: 33,
    electricalTiltDeg: 7,
    vendor: 'Nokia',
    mapX: 30,
    mapY: 32,
    neighborIds: ['NR-1021', 'NR-6002', 'NR-4478'],
  },
  {
    id: 'NR-3305',
    name: 'LDN-Fitzrovia-Central',
    setupAccessFailures: 21,
    callDrops: 66,
    dlMbps: 57,
    ulMbps: 12.8,
    totalHandovers: 1330,
    hoSuccessPct: 90.7,
    siteCode: 'LDN009',
    sector: 'S1',
    azimuthDeg: 116,
    pci: 267,
    nrArfcn: 637086,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41029,
    antennaHeightM: 25,
    electricalTiltDeg: 5,
    vendor: 'Ericsson',
    mapX: 65,
    mapY: 48,
    neighborIds: ['NR-8842', 'NR-5520', 'NR-9934', 'NR-6612'],
  },
  {
    id: 'NR-4478',
    name: 'LDN-EdgwareRoad-South',
    setupAccessFailures: 19,
    callDrops: 49,
    dlMbps: 52,
    ulMbps: 11.6,
    totalHandovers: 1180,
    hoSuccessPct: 92.3,
    siteCode: 'LDN010',
    sector: 'S3',
    azimuthDeg: 258,
    pci: 283,
    nrArfcn: 635574,
    band: 'n78',
    bandwidthMhz: 80,
    tac: 41030,
    antennaHeightM: 32,
    electricalTiltDeg: 8,
    vendor: 'Samsung',
    mapX: 15,
    mapY: 44,
    neighborIds: ['NR-1021', 'NR-2201'],
  },
  {
    id: 'NR-5588',
    name: 'LDN-Holborn-Link',
    setupAccessFailures: 24,
    callDrops: 71,
    dlMbps: 47,
    ulMbps: 10.8,
    totalHandovers: 1410,
    hoSuccessPct: 89.8,
    siteCode: 'LDN011',
    sector: 'S2',
    azimuthDeg: 142,
    pci: 301,
    nrArfcn: 637674,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41031,
    antennaHeightM: 28,
    electricalTiltDeg: 5,
    vendor: 'Nokia',
    mapX: 88,
    mapY: 41,
    neighborIds: ['NR-9934', 'NR-7710', 'NR-7744', 'NR-9093'],
  },
  {
    id: 'NR-6612',
    name: 'LDN-Farringdon-East',
    setupAccessFailures: 16,
    callDrops: 44,
    dlMbps: 61,
    ulMbps: 13.4,
    totalHandovers: 1240,
    hoSuccessPct: 93.4,
    siteCode: 'LDN012',
    sector: 'S1',
    azimuthDeg: 128,
    pci: 326,
    nrArfcn: 637254,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41032,
    antennaHeightM: 27,
    electricalTiltDeg: 6,
    vendor: 'Ericsson',
    mapX: 58,
    mapY: 43,
    neighborIds: ['NR-8842', 'NR-3305', 'NR-5520', 'NR-7744'],
  },
  {
    id: 'NR-7744',
    name: 'LDN-Barbican-South',
    setupAccessFailures: 20,
    callDrops: 58,
    dlMbps: 53,
    ulMbps: 11.9,
    totalHandovers: 1370,
    hoSuccessPct: 91.1,
    siteCode: 'LDN013',
    sector: 'S3',
    azimuthDeg: 164,
    pci: 349,
    nrArfcn: 637842,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41033,
    antennaHeightM: 24,
    electricalTiltDeg: 4,
    vendor: 'Nokia',
    mapX: 79,
    mapY: 44,
    neighborIds: ['NR-9934', 'NR-5588', 'NR-6612', 'NR-9093'],
  },
  {
    id: 'NR-8851',
    name: 'LDN-EustonRoad-West',
    setupAccessFailures: 14,
    callDrops: 36,
    dlMbps: 64,
    ulMbps: 14.0,
    totalHandovers: 1120,
    hoSuccessPct: 94.1,
    siteCode: 'LDN014',
    sector: 'S2',
    azimuthDeg: 232,
    pci: 371,
    nrArfcn: 635406,
    band: 'n78',
    bandwidthMhz: 80,
    tac: 41034,
    antennaHeightM: 35,
    electricalTiltDeg: 8,
    vendor: 'Ericsson',
    mapX: 33,
    mapY: 42,
    neighborIds: ['NR-2201', 'NR-4103', 'NR-6002', 'NR-4478'],
  },
  {
    id: 'NR-9093',
    name: 'LDN-LiverpoolStreet-North',
    setupAccessFailures: 23,
    callDrops: 63,
    dlMbps: 50,
    ulMbps: 10.9,
    totalHandovers: 1450,
    hoSuccessPct: 90.2,
    siteCode: 'LDN015',
    sector: 'S1',
    azimuthDeg: 176,
    pci: 395,
    nrArfcn: 638010,
    band: 'n78',
    bandwidthMhz: 100,
    tac: 41035,
    antennaHeightM: 26,
    electricalTiltDeg: 5,
    vendor: 'Samsung',
    mapX: 86,
    mapY: 38,
    neighborIds: ['NR-7744', 'NR-5588', 'NR-7710'],
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
  if (u < 0.06) return '15m'
  if (u < 0.2) return '1h'
  if (u < 0.58) return '24h'
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
      let timeHorizon = pickTimeHorizon(u2)
      if (segment === 'vip') {
        const ut = mix32(seed + 6) / 2 ** 32
        if (ut < 0.14) timeHorizon = '15m'
        else if (ut < 0.54) timeHorizon = '24h'
        else if (ut < 0.82) timeHorizon = '7d'
        else if (ut < 0.94) timeHorizon = '30d'
        else timeHorizon = '1h'
      }

      const dlFactor = 0.48 + u3 * 0.52
      let dlMbps = Math.round(cell.dlMbps * dlFactor * 10) / 10
      if (u4 < 0.08) dlMbps = Math.max(8, Math.round(dlMbps * (0.35 + u5 * 0.45) * 10) / 10)
      const ulMbps = Math.round(cell.ulMbps * (0.42 + u4 * 0.5) * 10) / 10

      const failRoll = mix32(seed + 11) / 2 ** 32
      let setupAccessFailures =
        failRoll < 0.62 ? 0 : failRoll < 0.88 ? 1 + (mix32(seed + 12) % 6) : 7 + (mix32(seed + 13) % 14)

      const dropRoll = mix32(seed + 21) / 2 ** 32
      let callDrops =
        dropRoll < 0.58 ? 0 : dropRoll < 0.9 ? 1 + (mix32(seed + 22) % 4) : 5 + (mix32(seed + 23) % 20)

      if (segment === 'vip') {
        const v = mix32(seed ^ 0x85ebca6b) / 2 ** 32
        if (v < 0.4) {
          setupAccessFailures = 0
          callDrops = mix32(seed + 50) / 2 ** 32 < 0.9 ? 0 : 1
        } else if (v < 0.65) {
          setupAccessFailures = 1 + (mix32(seed + 51) % 3)
          callDrops =
            mix32(seed + 52) / 2 ** 32 < 0.4 ? 0 : 1 + (mix32(seed + 53) % 3)
        } else if (v < 0.85) {
          setupAccessFailures = 3 + (mix32(seed + 54) % 7)
          callDrops = 1 + (mix32(seed + 55) % 6)
        } else {
          setupAccessFailures = 8 + (mix32(seed + 56) % 10)
          callDrops = 2 + (mix32(seed + 57) % 10)
        }
      }

      const hoBase = cell.hoSuccessPct
      const hoJitter = (mix32(seed + 31) % 700) / 100 - 3.5
      let hoSuccessPct = Math.round((hoBase + hoJitter) * 10) / 10
      hoSuccessPct = Math.max(72, Math.min(99.6, hoSuccessPct))
      if (segment === 'vip' && mix32(seed + 62) / 2 ** 32 < 0.28) {
        hoSuccessPct = Math.min(hoSuccessPct, Math.max(72, hoBase - 5 - (mix32(seed + 63) % 10)))
      }

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
  const vipAnchor = CELL_MAP['NR-1021']
  if (out.length > 0 && vipAnchor) {
    out[0] = {
      imsi: VIP_HIGHWAY_IMSI,
      cellId: vipAnchor.id,
      cellName: vipAnchor.name,
      sessions: 18,
      setupAccessFailures: 6,
      callDrops: 3,
      dlMbps: 49,
      ulMbps: 12.6,
      hoSuccessPct: 88.9,
      segment: 'vip',
      device: 'phone',
      timeHorizon: '15m',
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
  '15m': 1,
  '1h': 2,
  '24h': 3,
  '7d': 4,
  '30d': 5,
}

function timeRangeCoversSubscriber(selected: string, sub: SubscriberTimeHorizon): boolean {
  const oSel = TIME_RANGE_ORDER[selected as SubscriberTimeHorizon] ?? 3
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
  if (imsi === VIP_HIGHWAY_IMSI) {
    const path = [
      { cellId: 'NR-4478', phase: 'approach' },
      { cellId: 'NR-2201', phase: 'approach' },
      { cellId: 'NR-1021', phase: 'merge' },
      { cellId: 'NR-1021', phase: 'highway' },
      { cellId: 'NR-4103', phase: 'handover' },
      { cellId: 'NR-4103', phase: 'highway' },
      { cellId: 'NR-8842', phase: 'handover' },
      { cellId: 'NR-8842', phase: 'highway' },
      { cellId: 'NR-6612', phase: 'handover' },
      { cellId: 'NR-6612', phase: 'highway' },
      { cellId: 'NR-3305', phase: 'handover' },
      { cellId: 'NR-3305', phase: 'highway' },
      { cellId: 'NR-6612', phase: 'handover' },
      { cellId: 'NR-8842', phase: 'recover' },
      { cellId: 'NR-4103', phase: 'recover' },
      { cellId: 'NR-1021', phase: 'exit' },
      { cellId: 'NR-2201', phase: 'exit' },
      { cellId: 'NR-4478', phase: 'exit' },
    ] as const

    return path.map((step, i) => {
      const cell = CELL_MAP[step.cellId]
      const handoverAttempted = i > 0 && path[i - 1].cellId !== step.cellId
      const stressed = step.phase === 'handover' || step.phase === 'merge'
      const recovering = step.phase === 'recover' || step.phase === 'exit'
      const handoverSuccess = handoverAttempted ? i % 6 !== 0 : true
      const setupAccessFailures = stressed ? (handoverSuccess ? 1 : 3) : recovering ? 0 : 0
      const callDrops = stressed ? (handoverSuccess ? 0 : 1) : 0
      const throughputMbps = stressed
        ? 18 + (i % 3) * 4
        : recovering
          ? 36 + (i % 4) * 5
          : 44 + (i % 5) * 6
      const signalQuality = stressed
        ? 2.4 + (i % 2) * 0.3
        : recovering
          ? 3.1 + (i % 3) * 0.25
          : 3.7 + (i % 3) * 0.28
      const packetLossPct = stressed ? 2.2 + (i % 3) * 0.55 : recovering ? 0.9 : 0.45

      return {
        id: `SES-VIP-${1000 + i}`,
        signalQuality,
        throughputMbps,
        ulMbps: Math.round(throughputMbps * 0.24 * 10) / 10,
        connectivity: stressed ? 'Intermittent' : recovering ? 'Degraded' : 'Stable',
        packetLossPct,
        cellId: step.cellId,
        cellName: cell?.name ?? step.cellId,
        setupAccessFailures,
        callDrops,
        handoverAttempted,
        handoverSuccess,
      }
    })
  }

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
  const dr = cellTableCallDropMetrics(c, f)
  const dlm = cellTablePayloadDlMetrics(c, f)
  const ulm = cellTablePayloadUlMetrics(c, f)
  const hom = cellTableHoPctMetrics(c, f)
  const dl = dlm.fromAnchors ? dlm.value : c.dlMbps
  const ul = ulm.fromAnchors ? ulm.value : c.ulMbps
  const ho = hom.fromAnchors ? hom.value : c.hoSuccessPct
  let s = `DL ${dl} Mbps · UL ${ul} Mbps · HO ${ho.toFixed(1)}%`
  if (fm.fromAnchors) {
    if (fm.total > 0) {
      s += ` · failures ${fm.affected}/${fm.total} subs · ${Math.round(fm.value).toLocaleString()} failure events`
    } else {
      s += ' · footprint failures 0/0 subs (no match for filters)'
    }
    if (dr.total > 0) {
      s += ` · drops ${dr.affected}/${dr.total} subs · ${Math.round(dr.value).toLocaleString()} drop events`
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
    `Drops (RAN cell) ${dropShown} · Setup/access (RAN cell) ${failShown}`,
  ]
  if (fm.fromAnchors) {
    if (fm.total > 0) {
      lines.push(
        `Footprint · failures ${fm.affected}/${fm.total} subs · ${Math.round(fm.value).toLocaleString()} failure events`,
        `Footprint · drops ${dr.affected}/${dr.total} subs · ${Math.round(dr.value).toLocaleString()} drop events`,
      )
    } else {
      lines.push('Footprint · no subscribers match current filters')
    }
  }
  return lines
}

export type ComparePeriodOption = '15m' | '1h' | '24h' | '7d' | '30d' | 'custom'

export function globalTimeRangeLabel(range: string): string {
  switch (range) {
    case '15m':
      return 'Last 15 minutes'
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
    case '15m':
      return 0.12
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
