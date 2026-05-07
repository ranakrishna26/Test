import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl, { type GeoJSONSource } from 'mapbox-gl'
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import { ALL_SUBSCRIBER_FILTERS } from '../../utils/filterPresets'
import {
  CELLS,
  SUBSCRIBERS,
  VIP_HIGHWAY_IMSI,
  applyGlobalSubscriberFilters,
  cellById,
  mapCellSummaryLines,
  neighborSet,
  subscribersForFootprint,
  subscriberFootprint,
  type Cell,
  type SessionRow,
  type SubscriberGlobalFilters,
  type TableTab,
} from '../../data/placeholderNetwork'

type MapMode = 'all' | 'cellFocus' | 'subscriberFocus'

type Props = {
  mode: MapMode
  selectedCellId: string | null
  subscriberImsi: string | null
  activeTab: TableTab
  sessions: SessionRow[]
  selectedSessionId?: string | null
  onSessionSelect?: (sessionId: string) => void
  sessionTableCellFilter?: string | null
  showHoverKpis: boolean
  embed?: 'full' | 'compact'
  subscriberGlobalFilters?: SubscriberGlobalFilters
  onCellSelect?: (cellId: string) => void
  onMapBackgroundClick?: () => void
}

const MAPBOX_FALLBACK_STYLE = 'mapbox://styles/mapbox/dark-v11'

const CELL_SOURCE = 'cell-wedges'
const PIXEL_SOURCE = 'subscriber-pixels'
const CELL_FILL_LAYER = 'cell-wedges-fill'
const CELL_LINE_LAYER = 'cell-wedges-line'
const PIXEL_A_LAYER = 'subscriber-pixels-a'
const PIXEL_B_LAYER = 'subscriber-pixels-b'

const MAP_BOUNDS = {
  west: -0.255,
  east: -0.08,
  south: 51.48,
  north: 51.54,
}

const MAPBOX_FALLBACK_ACCESS_TOKEN = ''

const CELL_WEDGE_OUTER_DEG = 0.0021
const CELL_WEDGE_INNER_DEG = 0.000325
const CELL_WEDGE_SPREAD_DEG = 42
const VIP_HIGHWAY_ROUTE_MAIN: [number, number][] = [
  [-0.250, 51.5162],
  [-0.244, 51.5166],
  [-0.238, 51.5172],
  [-0.231, 51.5177],
  [-0.224, 51.5181],
  [-0.217, 51.5183],
  [-0.210, 51.5180],
  [-0.203, 51.5176],
  [-0.196, 51.5170],
  [-0.189, 51.5164],
  [-0.182, 51.5159],
  [-0.175, 51.5155],
  [-0.168, 51.5150],
  [-0.161, 51.5146],
  [-0.154, 51.5142],
  [-0.147, 51.5139],
  [-0.140, 51.5135],
  [-0.133, 51.5130],
  [-0.126, 51.5123],
  [-0.119, 51.5116],
  [-0.112, 51.5109],
  [-0.105, 51.5100],
  [-0.098, 51.5092],
  [-0.091, 51.5084],
]

type CellFeatureProps = {
  cellId: string
  opacity: number
  selected: number
  tooltipHtml: string
}

type PixelProps = {
  imsi: string
  sessionId: string
  cellId: string
  period: 'A' | 'B'
  kpiQuality: number
  selectedSession: number
  hasSelection: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rand01(seed: number): number {
  let x = seed >>> 0
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  return (x >>> 0) / 2 ** 32
}

function randNormal(seed: number): number {
  const u1 = Math.max(rand01(seed * 1664525 + 1013904223), 1e-9)
  const u2 = rand01(seed * 22695477 + 1)
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

const VIP_ROUTE_FAMILY: [number, number][][] = [
  VIP_HIGHWAY_ROUTE_MAIN,
]
const VIP_HIGHWAY_STRESS_ZONES: RectZone[] = [
  { west: -0.24, east: -0.205, south: 51.5135, north: 51.5188 },
  { west: -0.205, east: -0.165, south: 51.512, north: 51.5182 },
  { west: -0.165, east: -0.132, south: 51.5108, north: 51.5168 },
]

type RectZone = { west: number; east: number; south: number; north: number }
type EllipseZone = { cx: number; cy: number; rx: number; ry: number }

const WATER_ZONES: RectZone[] = [
  // Thames corridor (wider buffered envelope to avoid any on-water rendering)
  { west: -0.255, east: -0.16, south: 51.4995, north: 51.5119 },
  { west: -0.16, east: -0.08, south: 51.4992, north: 51.5122 },
  // Local bulges near Blackfriars / Southwark / London Bridge
  { west: -0.126, east: -0.082, south: 51.4988, north: 51.5128 },
  // Serpentine / Long Water
  { west: -0.183, east: -0.154, south: 51.504, north: 51.515 },
]

const PARK_ZONES: EllipseZone[] = [
  // Hyde Park
  { cx: -0.167, cy: 51.509, rx: 0.0155, ry: 0.0085 },
  // Green Park / St James's Park belt
  { cx: -0.143, cy: 51.5042, rx: 0.0105, ry: 0.0062 },
  // Regent's Park south-west
  { cx: -0.154, cy: 51.528, rx: 0.0108, ry: 0.0058 },
]

function mapXYToLngLat(mapX: number, mapY: number): [number, number] {
  const lng = MAP_BOUNDS.west + ((MAP_BOUNDS.east - MAP_BOUNDS.west) * mapX) / 100
  const lat = MAP_BOUNDS.north - ((MAP_BOUNDS.north - MAP_BOUNDS.south) * mapY) / 100
  return [lng, lat]
}

function inRect(lng: number, lat: number, r: RectZone): boolean {
  return lng >= r.west && lng <= r.east && lat >= r.south && lat <= r.north
}

function inEllipse(lng: number, lat: number, e: EllipseZone): boolean {
  const dx = (lng - e.cx) / e.rx
  const dy = (lat - e.cy) / e.ry
  return dx * dx + dy * dy <= 1
}

function isInExcludedLand(lng: number, lat: number): boolean {
  return WATER_ZONES.some((z) => inRect(lng, lat, z)) || PARK_ZONES.some((z) => inEllipse(lng, lat, z))
}

function isInVipHighwayStressZone(lng: number, lat: number): boolean {
  return VIP_HIGHWAY_STRESS_ZONES.some((z) => inRect(lng, lat, z))
}

function keepInsideBounds(lng: number, lat: number): [number, number] {
  return [
    clamp(lng, MAP_BOUNDS.west + 0.0004, MAP_BOUNDS.east - 0.0004),
    clamp(lat, MAP_BOUNDS.south + 0.0004, MAP_BOUNDS.north - 0.0004),
  ]
}

function coerceToRoadishPoint(
  rawLng: number,
  rawLat: number,
  seed: number,
  tangent: [number, number],
  perp: [number, number],
): [number, number] {
  let [lng, lat] = keepInsideBounds(rawLng, rawLat)
  if (!isInExcludedLand(lng, lat)) return [lng, lat]

  for (let attempt = 0; attempt < 10; attempt++) {
    const s = seed + attempt * 131
    const along = (0.0002 + rand01(s + 17) * 0.00055) * (rand01(s + 23) < 0.5 ? -1 : 1)
    const lateral = (0.00012 + rand01(s + 31) * 0.00042) * (rand01(s + 47) < 0.5 ? -1 : 1)
    const candidateLng = lng + tangent[0] * along + perp[0] * lateral
    const candidateLat = lat + tangent[1] * along + perp[1] * lateral
    ;[lng, lat] = keepInsideBounds(candidateLng, candidateLat)
    if (!isInExcludedLand(lng, lat)) return [lng, lat]
  }

  for (let attempt = 0; attempt < 16; attempt++) {
    const fallback = sampleRoute(
      VIP_HIGHWAY_ROUTE_MAIN,
      clamp(rand01(seed + 911 + attempt * 37) + randNormal(seed + 937 + attempt * 13) * 0.08, 0, 1),
    )
    const fallbackLng = fallback.point[0] + fallback.perp[0] * randNormal(seed + 947 + attempt * 17) * 0.00014
    const fallbackLat = fallback.point[1] + fallback.perp[1] * randNormal(seed + 953 + attempt * 19) * 0.00014
    const [safeLng, safeLat] = keepInsideBounds(fallbackLng, fallbackLat)
    if (!isInExcludedLand(safeLng, safeLat)) return [safeLng, safeLat]
  }

  // Last-resort: nudge north, away from Thames belt.
  return keepInsideBounds(lng, Math.max(lat, 51.5112))
}

function bearingFromCells(a: Cell, b: Cell | undefined): number {
  if (!b) return 0
  const dx = b.mapX - a.mapX
  const dy = a.mapY - b.mapY
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI
  return (deg + 360) % 360
}

function offsetLngLat(origin: [number, number], bearingDeg: number, distanceDeg: number): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180
  const latRad = (origin[1] * Math.PI) / 180
  const dLat = Math.cos(rad) * distanceDeg
  const dLng = (Math.sin(rad) * distanceDeg) / Math.max(0.15, Math.cos(latRad))
  return [origin[0] + dLng, origin[1] + dLat]
}

function segmentNorm(a: [number, number], b: [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function sampleRoute(route: [number, number][], t: number): {
  point: [number, number]
  tangent: [number, number]
  perp: [number, number]
} {
  if (route.length < 2) return { point: route[0] ?? [0, 0], tangent: [1, 0], perp: [0, 1] }
  const clamped = clamp(t, 0, 1)
  const segLens: number[] = []
  let total = 0
  for (let i = 0; i < route.length - 1; i++) {
    const len = segmentNorm(route[i], route[i + 1])
    segLens.push(len)
    total += len
  }
  if (total <= 1e-12) return { point: route[0], tangent: [1, 0], perp: [0, 1] }
  let target = clamped * total
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i]
    if (target > len && i < segLens.length - 1) {
      target -= len
      continue
    }
    const a = route[i]
    const b = route[i + 1]
    const u = len <= 1e-12 ? 0 : target / len
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const norm = Math.max(Math.hypot(dx, dy), 1e-12)
    const tangent: [number, number] = [dx / norm, dy / norm]
    const perp: [number, number] = [-tangent[1], tangent[0]]
    return {
      point: [a[0] + dx * u, a[1] + dy * u],
      tangent,
      perp,
    }
  }
  const a = route[route.length - 2]
  const b = route[route.length - 1]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const norm = Math.max(Math.hypot(dx, dy), 1e-12)
  const tangent: [number, number] = [dx / norm, dy / norm]
  return { point: b, tangent, perp: [-tangent[1], tangent[0]] }
}

function cellSectorAzimuth(cell: Cell): number {
  return bearingFromCells(cell, cellById(cell.neighborIds[0]))
}

function wedgePolygon(
  center: [number, number],
  azimuthDeg: number,
  outerDeg = CELL_WEDGE_OUTER_DEG,
  innerDeg = CELL_WEDGE_INNER_DEG,
  spreadDeg = CELL_WEDGE_SPREAD_DEG,
): [number, number][][] {
  const leftOuter = offsetLngLat(center, azimuthDeg - spreadDeg / 2, outerDeg)
  const rightOuter = offsetLngLat(center, azimuthDeg + spreadDeg / 2, outerDeg)
  const tip = offsetLngLat(center, azimuthDeg, outerDeg * 1.08)
  const rightInner = offsetLngLat(center, azimuthDeg + spreadDeg / 2, innerDeg)
  const leftInner = offsetLngLat(center, azimuthDeg - spreadDeg / 2, innerDeg)
  return [[leftInner, leftOuter, tip, rightOuter, rightInner, leftInner]]
}

function kpiQualityFromSession(s: SessionRow, tab: TableTab, tunnelPenalty: number, jitter: number): number {
  const failQ = clamp(100 - s.setupAccessFailures * 17 - tunnelPenalty - jitter, 0, 100)
  const dropQ = clamp(100 - s.callDrops * 30 - tunnelPenalty * 0.9 - jitter, 0, 100)
  const payloadQ = clamp(s.throughputMbps * 1.9 - tunnelPenalty * 0.85 + 8 - jitter * 0.35, 0, 100)
  const hoBase = s.handoverAttempted ? (s.handoverSuccess ? 94 : 62) : 88
  const hoQ = clamp(hoBase - tunnelPenalty * 0.55 - jitter * 0.2, 0, 100)
  if (tab === 'failure') return failQ
  if (tab === 'callDrop') return dropQ
  if (tab === 'payload') return payloadQ
  return hoQ
}

function makeSessionJourneyPoints(
  imsi: string,
  sessions: SessionRow[],
  tab: TableTab,
  period: 'A' | 'B',
  selectedSessionId: string | null,
): Feature<Point, PixelProps>[] {
  const features: Feature<Point, PixelProps>[] = []
  const seed = hashString(imsi)
  const periodShiftLng = period === 'B' ? 0.000045 : 0
  const periodShiftLat = period === 'B' ? -0.000035 : 0
  const periodPenalty = period === 'B' ? 11 : 0
  const perSession = imsi === VIP_HIGHWAY_IMSI ? 56 : 18

  if (imsi === VIP_HIGHWAY_IMSI && sessions.length) {
    const handoverCenters = sessions
      .map((s, i) => (i > 0 && sessions[i - 1]?.cellId !== s.cellId ? i / sessions.length : -1))
      .filter((v) => v >= 0)
    sessions.forEach((s, sessionIdx) => {
      for (let j = 0; j < perSession; j++) {
        const inner = (j + 0.5) / perSession
        const progress = (sessionIdx + inner) / sessions.length
        const route = VIP_HIGHWAY_ROUTE_MAIN
        const speedFactor = clamp(0.72 + rand01(seed + sessionIdx * 47 + j * 3) * 0.6, 0.65, 1.4)
        const smoothProgress = clamp(
          progress + randNormal(seed + sessionIdx * 193 + j * 29) * 0.0065,
          0,
          1,
        )
        const routePos = sampleRoute(route, clamp((sessionIdx + inner * speedFactor) / sessions.length + smoothProgress * 0.015, 0, 1))
        const laneOffset = randNormal(seed + sessionIdx * 31 + j * 17) * 0.00027
        const lateralNoise = randNormal(seed + sessionIdx * 43 + j * 23) * 0.00009
        const alongNoise = randNormal(seed + sessionIdx * 37 + j * 19) * 0.00011
        const lng =
          routePos.point[0] +
          routePos.perp[0] * (laneOffset + lateralNoise) +
          routePos.tangent[0] * alongNoise +
          periodShiftLng
        const lat =
          routePos.point[1] +
          routePos.perp[1] * (laneOffset + lateralNoise) +
          routePos.tangent[1] * alongNoise +
          periodShiftLat
        const [safeLng, safeLat] = coerceToRoadishPoint(
          lng,
          lat,
          seed + sessionIdx * 761 + j * 43,
          routePos.tangent,
          routePos.perp,
        )
        const tunnel =
          isInVipHighwayStressZone(safeLng, safeLat)
            ? 42
            : safeLng >= -0.246 && safeLng <= -0.165 && safeLat >= 51.506 && safeLat <= 51.528
              ? 18
              : 0
        const nearestHandover = handoverCenters.reduce((best, x) => Math.min(best, Math.abs(progress - x)), 1)
        const handoverPenalty = nearestHandover < 0.07 ? (1 - nearestHandover / 0.07) * 26 : 0
        const jitter = rand01(seed + (sessionIdx * 97 + j * 17) * 17) * 7
        const quality = clamp(
          kpiQualityFromSession(s, tab, tunnel + periodPenalty + handoverPenalty, jitter),
          0,
          100,
        )
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [safeLng, safeLat] },
          properties: {
            imsi,
            sessionId: s.id,
            cellId: s.cellId,
            period,
            kpiQuality: quality,
            selectedSession: selectedSessionId === s.id ? 1 : 0,
            hasSelection: selectedSessionId ? 1 : 0,
          },
        })
      }
    })
    return features
  }

  const anchors = sessions.map((s) => {
    const c = cellById(s.cellId)
    return c ? mapXYToLngLat(c.mapX, c.mapY) : mapXYToLngLat(50, 50)
  })

  sessions.forEach((s, sessionIdx) => {
    const from = anchors[sessionIdx] ?? mapXYToLngLat(50, 50)
    const to = anchors[Math.min(sessionIdx + 1, anchors.length - 1)] ?? from
    const segDx = to[0] - from[0]
    const segDy = to[1] - from[1]
    const segLen = Math.max(Math.hypot(segDx, segDy), 1e-9)
    const perpX = -segDy / segLen
    const perpY = segDx / segLen
    const handoverStress = sessionIdx > 0 && sessions[sessionIdx - 1]?.cellId !== s.cellId ? 14 : 0

    for (let j = 0; j < perSession; j++) {
      const progress = (j + 0.5) / perSession
      const ord = sessionIdx * 97 + j * 17
      const alongLng = from[0] + segDx * progress
      const alongLat = from[1] + segDy * progress
      const useMacroCorridor = rand01(seed + ord * 11 + sessionIdx * 7) < 0.34
      const macroRoute =
        VIP_ROUTE_FAMILY[
          Math.floor(rand01(seed + ord * 5 + sessionIdx * 3) * VIP_ROUTE_FAMILY.length) %
            VIP_ROUTE_FAMILY.length
        ]
      const macroProgress = clamp(
        (sessionIdx + progress) / sessions.length + randNormal(seed + ord * 13) * 0.035,
        0,
        1,
      )
      const macro = sampleRoute(macroRoute, macroProgress)
      const laneSpread = randNormal(seed + ord * 17 + 7) * 0.0002
      const noise = randNormal(seed + ord * 19 + 11) * 0.00012
      const baseLng = useMacroCorridor ? alongLng * 0.45 + macro.point[0] * 0.55 : alongLng
      const baseLat = useMacroCorridor ? alongLat * 0.45 + macro.point[1] * 0.55 : alongLat
      const usePerpX = useMacroCorridor ? macro.perp[0] : perpX
      const usePerpY = useMacroCorridor ? macro.perp[1] : perpY
      const useTanX = useMacroCorridor ? macro.tangent[0] : segDx / segLen
      const useTanY = useMacroCorridor ? macro.tangent[1] : segDy / segLen
      const lng = baseLng + usePerpX * laneSpread + useTanX * noise + periodShiftLng
      const lat = baseLat + usePerpY * laneSpread + useTanY * noise + periodShiftLat
      const [safeLng, safeLat] = coerceToRoadishPoint(
        lng,
        lat,
        seed + ord * 59 + sessionIdx * 17,
        [useTanX, useTanY],
        [usePerpX, usePerpY],
      )
      const tunnel =
        isInVipHighwayStressZone(safeLng, safeLat)
          ? 42
          : safeLng >= -0.246 && safeLng <= -0.165 && safeLat >= 51.506 && safeLat <= 51.528
            ? 18
            : 0
      const jitter = rand01(seed + ord * 17) * 7
      const quality = clamp(
        kpiQualityFromSession(s, tab, tunnel + periodPenalty + handoverStress, jitter),
        0,
        100,
      )
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [safeLng, safeLat] },
        properties: {
          imsi,
          sessionId: s.id,
          cellId: s.cellId,
          period,
          kpiQuality: quality,
          selectedSession: selectedSessionId === s.id ? 1 : 0,
          hasSelection: selectedSessionId ? 1 : 0,
        },
      })
    }
  })
  return features
}

function makeActivityCloud(
  subscribers: typeof SUBSCRIBERS,
  tab: TableTab,
  period: 'A' | 'B',
  selectedSessionId: string | null,
): Feature<Point, PixelProps>[] {
  const features: Feature<Point, PixelProps>[] = []
  const periodPenalty = period === 'B' ? 8 : 0
  const periodShiftLng = period === 'B' ? 0.00003 : 0
  const periodShiftLat = period === 'B' ? -0.000022 : 0
  subscribers.forEach((s, i) => {
    const c = cellById(s.cellId)
    if (!c) return
    const center = mapXYToLngLat(c.mapX, c.mapY)
    const seed = hashString(`${s.imsi}-${period}`)
    const neighborId = c.neighborIds.length
      ? c.neighborIds[Math.floor(rand01(seed + 11) * c.neighborIds.length) % c.neighborIds.length]
      : c.id
    const neighbor = cellById(neighborId) ?? c
    const target = mapXYToLngLat(neighbor.mapX, neighbor.mapY)
    const t = clamp(rand01(seed + i * 7) + randNormal(seed + i * 29) * 0.12, 0, 1)
    const baseLng = center[0] + (target[0] - center[0]) * t
    const baseLat = center[1] + (target[1] - center[1]) * t
    const segDx = target[0] - center[0]
    const segDy = target[1] - center[1]
    const segLen = Math.max(Math.hypot(segDx, segDy), 1e-9)
    const perpX = -segDy / segLen
    const perpY = segDx / segLen
    const corridorHalfWidth = 0.00082
    const offset = clamp(randNormal(seed + i * 13) * corridorHalfWidth, -corridorHalfWidth, corridorHalfWidth)
    const azimuth = cellSectorAzimuth(c)
    const useMacroCorridor = rand01(seed + i * 23) < 0.28
    const macroRoute =
      VIP_ROUTE_FAMILY[
        Math.floor(rand01(seed + i * 31 + 3) * VIP_ROUTE_FAMILY.length) % VIP_ROUTE_FAMILY.length
      ]
    const macro = sampleRoute(macroRoute, clamp(rand01(seed + i * 37) + randNormal(seed + i * 41) * 0.08, 0, 1))
    const routeBlend = useMacroCorridor ? 0.62 : 0
    const blendedBase: [number, number] = [
      baseLng * (1 - routeBlend) + macro.point[0] * routeBlend,
      baseLat * (1 - routeBlend) + macro.point[1] * routeBlend,
    ]
    const sectorBias = offsetLngLat(blendedBase, azimuth, rand01(seed + 3) * 0.0003)
    const tangentJitter = randNormal(seed + i * 43) * 0.0001
    const tangentX = useMacroCorridor ? macro.tangent[0] : segDx / segLen
    const tangentY = useMacroCorridor ? macro.tangent[1] : segDy / segLen
    const perpUseX = useMacroCorridor ? macro.perp[0] : perpX
    const perpUseY = useMacroCorridor ? macro.perp[1] : perpY
    const pos: [number, number] = [
      sectorBias[0] + perpUseX * offset + tangentX * tangentJitter,
      sectorBias[1] + perpUseY * offset + tangentY * tangentJitter,
    ]
    const [safeLng, safeLat] = coerceToRoadishPoint(
      pos[0] + periodShiftLng,
      pos[1] + periodShiftLat,
      seed + i * 73,
      [tangentX, tangentY],
      [perpUseX, perpUseY],
    )
    const pseudoSession: SessionRow = {
      id: `CLOUD-${s.imsi.slice(-6)}`,
      signalQuality: 3.5,
      throughputMbps: s.dlMbps,
      ulMbps: s.ulMbps,
      connectivity: 'Stable',
      packetLossPct: 0.4,
      cellId: s.cellId,
      cellName: s.cellName,
      setupAccessFailures: s.setupAccessFailures,
      callDrops: s.callDrops,
      handoverAttempted: true,
      handoverSuccess: s.hoSuccessPct > 90,
    }
    const quality = kpiQualityFromSession(pseudoSession, tab, periodPenalty, rand01(seed + 5) * 8)
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [safeLng, safeLat],
      },
      properties: {
        imsi: s.imsi,
        sessionId: `ACT-${s.imsi.slice(-7)}-${i}`,
        cellId: s.cellId,
        period,
        kpiQuality: quality,
        selectedSession: 0,
        hasSelection: selectedSessionId ? 1 : 0,
      },
    })
  })
  return features
}

export function OperatorMap({
  mode,
  selectedCellId,
  subscriberImsi,
  activeTab,
  sessions,
  selectedSessionId = null,
  onSessionSelect,
  sessionTableCellFilter,
  showHoverKpis: _showHoverKpis,
  embed = 'full',
  subscriberGlobalFilters,
  onCellSelect,
  onMapBackgroundClick,
}: Props) {
  void _showHoverKpis
  const compact = embed === 'compact'
  const filters = subscriberGlobalFilters ?? ALL_SUBSCRIBER_FILTERS
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapElRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const pixelPopupRef = useRef<mapboxgl.Popup | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [showPixels, setShowPixels] = useState(true)
  const [showPeriodB, setShowPeriodB] = useState(true)
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const { direct, all } = useMemo(
    () =>
      subscriberImsi
        ? subscriberFootprint(subscriberImsi)
        : { direct: new Set<string>(), all: new Set<string>() },
    [subscriberImsi],
  )

  const fitIds = useMemo(() => {
    if (mode === 'all') return new Set(CELLS.map((c) => c.id))
    if (mode === 'cellFocus' && selectedCellId) return neighborSet(selectedCellId)
    if (mode === 'subscriberFocus' && all.size) return all
    return new Set(CELLS.map((c) => c.id))
  }, [mode, selectedCellId, all])

  const cellCollection = useMemo<FeatureCollection<Polygon, CellFeatureProps>>(() => {
    const features: Feature<Polygon, CellFeatureProps>[] = CELLS.map((c) => {
      const center = mapXYToLngLat(c.mapX, c.mapY)
      const azimuth = bearingFromCells(c, cellById(c.neighborIds[0]))
      const geom = wedgePolygon(center, azimuth)
      let opacity = 0.9
      if (mode === 'cellFocus' && selectedCellId) {
        const n = neighborSet(selectedCellId)
        if (c.id === selectedCellId) opacity = 1
        else if (n.has(c.id)) opacity = 0.5
        else opacity = 0.15
      } else if (mode === 'subscriberFocus' && subscriberImsi) {
        if (direct.has(c.id)) opacity = 0.95
        else if (all.has(c.id)) opacity = 0.45
        else opacity = 0.14
      }
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: geom },
        properties: {
          cellId: c.id,
          opacity,
          selected: selectedCellId === c.id ? 1 : 0,
          tooltipHtml: mapCellSummaryLines(c, filters).join('<br/>'),
        },
      }
    })
    return { type: 'FeatureCollection', features }
  }, [mode, selectedCellId, subscriberImsi, direct, all, filters])

  const pixelCollection = useMemo<FeatureCollection<Point, PixelProps>>(() => {
    let features: Feature<Point, PixelProps>[] = []
    if (mode === 'subscriberFocus' && subscriberImsi) {
      features = makeSessionJourneyPoints(subscriberImsi, sessions, activeTab, 'A', selectedSessionId)
      if (showPeriodB) {
        features = features.concat(
          makeSessionJourneyPoints(subscriberImsi, sessions, activeTab, 'B', selectedSessionId),
        )
      }
    } else {
      const baseSubs =
        mode === 'cellFocus' && selectedCellId
          ? applyGlobalSubscriberFilters(subscribersForFootprint(selectedCellId), filters)
          : applyGlobalSubscriberFilters(SUBSCRIBERS, filters)
      const scoped =
        mode === 'cellFocus' && selectedCellId
          ? baseSubs.filter((s) => neighborSet(selectedCellId).has(s.cellId))
          : baseSubs
      features = makeActivityCloud(scoped, activeTab, 'A', selectedSessionId)
      if (showPeriodB)
        features = features.concat(makeActivityCloud(scoped, activeTab, 'B', selectedSessionId))
    }
    return { type: 'FeatureCollection', features }
  }, [
    mode,
    subscriberImsi,
    selectedCellId,
    sessions,
    selectedSessionId,
    filters,
    activeTab,
    showPeriodB,
  ])

  const legendText = useMemo(() => {
    if (mode === 'all') return 'All sectors · click a cell or table row to open subscribers'
    if (mode === 'cellFocus')
      return 'Blue = selected · gray = neighbour · faded = other · map and table are synced'
    if (sessionTableCellFilter)
      return 'Subscriber footprint · click cell to filter sessions · click empty map for all sessions'
    if (subscriberImsi === VIP_HIGHWAY_IMSI)
      return 'VIP highway demo · scoped to one corridor · degradation at corridor handovers'
    return 'Subscriber footprint · click pixel to highlight matching session row'
  }, [mode, sessionTableCellFilter, subscriberImsi])

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return
    if (!mapboxgl.accessToken) {
      mapboxgl.accessToken =
        import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? MAPBOX_FALLBACK_ACCESS_TOKEN
    }
    if (!mapboxgl.accessToken) {
      setMapError('Map unavailable: missing VITE_MAPBOX_ACCESS_TOKEN')
      return
    }
    const mapStyle = import.meta.env.VITE_MAPBOX_STYLE_URL ?? MAPBOX_FALLBACK_STYLE
    const avgX = CELLS.reduce((a, c) => a + c.mapX, 0) / CELLS.length
    const avgY = CELLS.reduce((a, c) => a + c.mapY, 0) / CELLS.length
    const center = mapXYToLngLat(avgX, avgY)
    let map: mapboxgl.Map
    try {
      map = new mapboxgl.Map({
        container: mapElRef.current,
        style: mapStyle,
        center,
        zoom: 12.2,
        attributionControl: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Map initialization failed'
      setMapError(message)
      return
    }
    mapRef.current = map
    map.on('error', (event) => {
      const message = event.error?.message ?? 'Map rendering error'
      setMapError(message)
    })
    map.on('load', () => {
      map.addSource(CELL_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addSource(PIXEL_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: CELL_FILL_LAYER,
        type: 'fill',
        source: CELL_SOURCE,
        paint: {
          'fill-color': '#1d4ed8',
          'fill-opacity': ['coalesce', ['get', 'opacity'], 0.2],
        },
      })
      map.addLayer({
        id: CELL_LINE_LAYER,
        type: 'line',
        source: CELL_SOURCE,
        paint: {
          'line-color': ['case', ['==', ['get', 'selected'], 1], '#0f172a', '#ffffff'],
          'line-width': ['case', ['==', ['get', 'selected'], 1], 2.2, 1],
          'line-opacity': ['coalesce', ['get', 'opacity'], 0.2],
        },
      })
      const colorExpr: mapboxgl.Expression = [
        'step',
        ['coalesce', ['get', 'kpiQuality'], 0],
        '#ef4444',
        40,
        '#f59e0b',
        70,
        '#22c55e',
      ]
      map.addLayer({
        id: PIXEL_A_LAYER,
        type: 'circle',
        source: PIXEL_SOURCE,
        filter: ['==', ['get', 'period'], 'A'],
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'selectedSession'], 1],
            3.3,
            ['==', ['get', 'hasSelection'], 1],
            1.7,
            2,
          ],
          'circle-color': [
            'case',
            ['all', ['==', ['get', 'hasSelection'], 1], ['!=', ['get', 'selectedSession'], 1]],
            '#94a3b8',
            colorExpr,
          ],
          'circle-opacity': [
            'case',
            ['==', ['get', 'selectedSession'], 1],
            0.98,
            ['==', ['get', 'hasSelection'], 1],
            0.24,
            0.9,
          ],
        },
      })
      map.addLayer({
        id: PIXEL_B_LAYER,
        type: 'circle',
        source: PIXEL_SOURCE,
        filter: ['==', ['get', 'period'], 'B'],
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'selectedSession'], 1],
            2.8,
            ['==', ['get', 'hasSelection'], 1],
            1.55,
            2,
          ],
          'circle-color': [
            'case',
            ['all', ['==', ['get', 'hasSelection'], 1], ['!=', ['get', 'selectedSession'], 1]],
            '#94a3b8',
            colorExpr,
          ],
          'circle-opacity': [
            'case',
            ['==', ['get', 'selectedSession'], 1],
            0.74,
            ['==', ['get', 'hasSelection'], 1],
            0.14,
            0.3,
          ],
        },
      })

      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14,
        className: 'mapbox-kpi-popup',
      })
      pixelPopupRef.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 14,
        className: 'mapbox-kpi-popup',
      })

      const showPixelPopup = (e: mapboxgl.MapLayerMouseEvent) => {
        const f = e.features?.[0]
        if (!f || !e.lngLat || !pixelPopupRef.current) return
        const sessionId = String(f.properties?.sessionId ?? '')
        const cellId = String(f.properties?.cellId ?? '')
        const period = String(f.properties?.period ?? 'A')
        const imsi = String(f.properties?.imsi ?? '')
        const kpiQuality = Number(f.properties?.kpiQuality ?? 0)
        if (sessionId) onSessionSelect?.(sessionId)
        const cellName = cellById(cellId)?.name ?? 'Unknown cell'
        const qualityLabel = kpiQuality >= 70 ? 'Good' : kpiQuality >= 40 ? 'Mid' : 'Bad'
        pixelPopupRef.current
          .setLngLat(e.lngLat)
          .setHTML(
            [
              '<ul class="map-hover-list">',
              `<li>Session ${sessionId || 'n/a'}</li>`,
              `<li>${cellName} (${cellId || 'n/a'})</li>`,
              `<li>IMSI: ${imsi || 'n/a'}</li>`,
              `<li>Period ${period} · KPI ${qualityLabel} (${kpiQuality.toFixed(1)})</li>`,
              '</ul>',
            ].join(''),
          )
          .addTo(map)
      }

      map.on('mouseenter', CELL_FILL_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', CELL_FILL_LAYER, () => {
        map.getCanvas().style.cursor = ''
        popupRef.current?.remove()
      })
      map.on('mousemove', CELL_FILL_LAYER, (e) => {
        const f = e.features?.[0]
        if (!f || !e.lngLat || !popupRef.current) return
        popupRef.current.setLngLat(e.lngLat).setHTML(String(f.properties?.tooltipHtml ?? '')).addTo(map)
      })
      map.on('click', CELL_FILL_LAYER, (e) => {
        const f = e.features?.[0]
        const id = String(f?.properties?.cellId ?? '')
        pixelPopupRef.current?.remove()
        if (id) onCellSelect?.(id)
      })

      map.on('mouseenter', PIXEL_A_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', PIXEL_A_LAYER, () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('mouseenter', PIXEL_B_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', PIXEL_B_LAYER, () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('click', PIXEL_A_LAYER, showPixelPopup)
      map.on('click', PIXEL_B_LAYER, showPixelPopup)

      map.on('click', (e) => {
        const clicked = map.queryRenderedFeatures(e.point, {
          layers: [CELL_FILL_LAYER, PIXEL_A_LAYER, PIXEL_B_LAYER],
        })
        if (clicked.length === 0) {
          pixelPopupRef.current?.remove()
          onMapBackgroundClick?.()
        }
      })

      setMapReady(true)
    })

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
      pixelPopupRef.current?.remove()
      pixelPopupRef.current = null
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [onCellSelect, onMapBackgroundClick, onSessionSelect])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const src = mapRef.current.getSource(CELL_SOURCE) as GeoJSONSource | undefined
    src?.setData(cellCollection)
  }, [mapReady, cellCollection])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const src = mapRef.current.getSource(PIXEL_SOURCE) as GeoJSONSource | undefined
    src?.setData(pixelCollection)
  }, [mapReady, pixelCollection])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const visibility = showPixels ? 'visible' : 'none'
    mapRef.current.setLayoutProperty(PIXEL_A_LAYER, 'visibility', visibility)
    mapRef.current.setLayoutProperty(
      PIXEL_B_LAYER,
      'visibility',
      showPixels && showPeriodB ? 'visible' : 'none',
    )
  }, [mapReady, showPixels, showPeriodB])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !fitIds.size) return
    const cells = CELLS.filter((c) => fitIds.has(c.id))
    if (!cells.length) return
    const bounds = new mapboxgl.LngLatBounds()
    cells.forEach((c) => bounds.extend(mapXYToLngLat(c.mapX, c.mapY)))
    mapRef.current.fitBounds(bounds, { padding: compact ? 28 : 48, duration: 350, maxZoom: 14.6 })
  }, [mapReady, fitIds, compact])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedCellId) return
    const c = cellById(selectedCellId)
    if (!c) return
    mapRef.current.flyTo({ center: mapXYToLngLat(c.mapX, c.mapY), duration: 380, zoom: 14.2 })
  }, [mapReady, selectedCellId])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedSessionId) return
    const selectedPoint = pixelCollection.features.find(
      (f) => f.properties.sessionId === selectedSessionId && f.properties.period === 'A',
    )
    if (!selectedPoint) return
    mapRef.current.flyTo({
      center: selectedPoint.geometry.coordinates as [number, number],
      duration: 320,
      zoom: Math.max(mapRef.current.getZoom(), 14.8),
    })
  }, [mapReady, selectedSessionId, pixelCollection])

  const kpiLabel =
    activeTab === 'failure'
      ? 'Setup / access failures'
      : activeTab === 'callDrop'
        ? 'Call drops'
        : activeTab === 'payload'
          ? 'Payload throughput'
          : 'Handover success'

  return (
    <div className={`map-shell ${compact ? 'map-shell--embed' : ''}`}>
      <div className={`map-toolbar ${compact ? 'map-toolbar--embed' : ''}`}>
        <span className="map-toolbar-title">{compact ? 'Map' : 'RAN footprint'}</span>
        <div className="map-toolbar-actions">
          <button
            type="button"
            className="map-tool-btn"
            title="Zoom in"
            onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
          >
            +
          </button>
          <button
            type="button"
            className="map-tool-btn"
            title="Zoom out"
            onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
          >
            −
          </button>
          <button
            type="button"
            className="map-tool-btn"
            title="Fit current focus"
            onClick={() => {
              if (!mapRef.current || !fitIds.size) return
              const bounds = new mapboxgl.LngLatBounds()
              CELLS.filter((c) => fitIds.has(c.id)).forEach((c) =>
                bounds.extend(mapXYToLngLat(c.mapX, c.mapY)),
              )
              mapRef.current.fitBounds(bounds, { padding: compact ? 28 : 48, duration: 300 })
            }}
          >
            Fit
          </button>
          <button
            type="button"
            className="map-tool-btn"
            title="Reset zoom & pan"
            onClick={() =>
              mapRef.current?.fitBounds(
                [
                  [MAP_BOUNDS.west, MAP_BOUNDS.south],
                  [MAP_BOUNDS.east, MAP_BOUNDS.north],
                ],
                { padding: compact ? 28 : 52, duration: 300 },
              )
            }
          >
            Reset
          </button>
        </div>
      </div>

      <div className="map-svg-wrap">
        <div ref={mapElRef} className="map-canvas" />
        {mapError ? (
          <div className="map-error-banner" role="status">
            Map warning: {mapError}
          </div>
        ) : null}
        <div
          className={`map-legend-panel ${legendCollapsed ? 'map-legend-panel--collapsed' : ''}`}
          role="group"
          aria-label="Pixel legend"
        >
          <div className="map-legend-head">
            <div className="map-legend-title">Pixel layer</div>
            <button
              type="button"
              className="map-legend-hide-btn"
              aria-label={legendCollapsed ? 'Show legend details' : 'Hide legend details'}
              title={legendCollapsed ? 'Show legend details' : 'Hide legend details'}
              onClick={() => setLegendCollapsed((v) => !v)}
            >
              {legendCollapsed ? '+' : '-'}
            </button>
          </div>
          {!legendCollapsed && (
            <>
              <div className="map-legend-row">
                <span className="map-legend-swatch map-legend-swatch--good" />
                <span>Good</span>
              </div>
              <div className="map-legend-row">
                <span className="map-legend-swatch map-legend-swatch--mid" />
                <span>Mid</span>
              </div>
              <div className="map-legend-row">
                <span className="map-legend-swatch map-legend-swatch--bad" />
                <span>Bad</span>
              </div>
              <div className="map-legend-kpi">KPI: {kpiLabel}</div>
              <label className="map-legend-toggle">
                <input
                  type="checkbox"
                  checked={showPixels}
                  onChange={(e) => setShowPixels(e.target.checked)}
                />
                Show pixels
              </label>
              <label className="map-legend-toggle">
                <input
                  type="checkbox"
                  checked={showPeriodB}
                  onChange={(e) => setShowPeriodB(e.target.checked)}
                />
                Show period B overlay
              </label>
            </>
          )}
        </div>
      </div>

      <div className={`map-footer ${compact ? 'map-footer--embed' : ''}`}>
        <span className="map-legend">{legendText}</span>
        {!compact && <span className="map-hint">Mapbox GL sources update in place via setData()</span>}
      </div>
    </div>
  )
}
