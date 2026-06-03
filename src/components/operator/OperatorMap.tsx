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
  cellKpiValue,
  formatKpiValue,
  kpiBand,
  kpiDefinition,
  mapCellSummaryLines,
  neighborSet,
  sessionKpiValue,
  subscribersForFootprint,
  subscriberCellKpiBand,
  subscriberFootprint,
  type Cell,
  type KpiStateBand,
  type SessionRow,
  type SubscriberGlobalFilters,
} from '../../data/placeholderNetwork'
import { unionCellIdsForAoiSelection } from '../../data/operatorAois'
import { sessionKpiBand, type KpiId } from '../../data/kpis'

type MapMode = 'all' | 'cellFocus' | 'subscriberFocus'

/** How subscriber pixels are drawn on the map (operator-facing semantics). */
export type PixelDisplayMode = 'journeySamples' | 'sessionAnchors' | 'handovers'

const VIP_JOURNEY_SAMPLES_PER_SESSION = 12
const DEFAULT_JOURNEY_SAMPLES_PER_SESSION = 18

type Props = {
  mode: MapMode
  selectedCellId: string | null
  subscriberImsi: string | null
  selectedKpiId: KpiId
  sessions: SessionRow[]
  selectedSessionIds?: string[]
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
const PIXEL_COLOR_EXPR: mapboxgl.Expression = ['coalesce', ['get', 'pixelColor'], '#94a3b8']

/** Performance palette (top → bottom in design reference). */
export const MAP_PERFORMANCE_COLORS = {
  good: '#37783D',
  fair: '#3B7591',
  warning: '#C07931',
  bad: '#B3322C',
} as const

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
  cellFillColor: string
  opacity: number
  selected: number
  tooltipHtml: string
}

type PixelProps = {
  imsi: string
  sessionId: string
  cellId: string
  period: 'A' | 'B'
  kpiValue: number
  kpiValueDisplay: string
  kpiState: KpiStateBand
  kpiStateLabel: string
  /** KPI band color from MAP_PERFORMANCE_COLORS. */
  pixelColor: string
  selectedSession: number
  hasSelection: number
}

function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (v: number) =>
    clamp(Math.round(v), 0, 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`
}

function parseHexColor(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : normalized
  const value = Number.parseInt(expanded, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const w = clamp(t, 0, 1)
  return [
    a[0] + (b[0] - a[0]) * w,
    a[1] + (b[1] - a[1]) * w,
    a[2] + (b[2] - a[2]) * w,
  ]
}

/** Map KPI band → palette (green good → red bad; blue = fair / period B tint). */
export function performanceColorForState(
  kpiState: KpiStateBand,
  period: 'A' | 'B' = 'A',
): string {
  const base =
    kpiState === 'meetsTarget'
      ? MAP_PERFORMANCE_COLORS.good
      : kpiState === 'nearBreach'
        ? MAP_PERFORMANCE_COLORS.warning
        : kpiState === 'breached'
          ? MAP_PERFORMANCE_COLORS.bad
          : MAP_PERFORMANCE_COLORS.fair
  if (period === 'B') {
    const rgb = mixRgb(
      parseHexColor(base),
      parseHexColor(MAP_PERFORMANCE_COLORS.fair),
      0.42,
    )
    return rgbToHex(rgb[0], rgb[1], rgb[2])
  }
  return base
}

function withPixelColor(
  props: Omit<PixelProps, 'pixelColor'>,
): PixelProps {
  return {
    ...props,
    pixelColor: performanceColorForState(props.kpiState, props.period),
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Hover copy: KPI at point (global KPI), quality band, spatial + session context; click still selects session. */
function buildPixelHoverTooltipHtml(
  f: mapboxgl.MapboxGeoJSONFeature | Feature<Point, PixelProps>,
  kpiId: KpiId,
): string {
  const p = f.properties as PixelProps | null | undefined
  if (!p) return ''
  const sessionId = String(p.sessionId ?? '')
  const cellId = String(p.cellId ?? '')
  const period = String(p.period ?? 'A')
  const imsi = String(p.imsi ?? '')
  const kpiStateLabel = String(p.kpiStateLabel ?? 'Unknown')
  const kpiValueDisplay = String(p.kpiValueDisplay ?? 'n/a')
  const cellName = cellById(cellId)?.name ?? 'Unknown cell'
  const kpiLabel = kpiDefinition(kpiId).label
  return [
    '<ul class="map-hover-list">',
    `<li class="map-hover-kpi-line"><strong>${escapeHtml(kpiLabel)}</strong> · ${escapeHtml(kpiStateLabel)} <span class="map-hover-value">(${escapeHtml(kpiValueDisplay)})</span></li>`,
    `<li>${escapeHtml(cellName)} <span class="map-hover-muted">(${escapeHtml(cellId || 'n/a')})</span></li>`,
    `<li>Period ${escapeHtml(period)} · session <span class="map-hover-code">${escapeHtml(sessionId || 'n/a')}</span></li>`,
    `<li>Subscriber · <span class="map-hover-code">${escapeHtml(imsi || 'n/a')}</span></li>`,
    '</ul>',
  ].join('')
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function isFiniteLngLat(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
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

function operatorBandForKpi(
  s: SessionRow,
  selectedKpiId: KpiId,
  tunnelPenalty: number,
  jitter: number,
): {
  state: KpiStateBand
  label: string
  value: number
  display: string
} {
  const definition = kpiDefinition(selectedKpiId)
  const baseValue = sessionKpiValue(s, selectedKpiId)
  const stressFactor = clamp((tunnelPenalty + jitter) / 320, 0, 0.36)
  const value =
    definition.direction === 'higher_is_better'
      ? baseValue * (1 - stressFactor)
      : baseValue * (1 + stressFactor)
  let state = sessionKpiBand(selectedKpiId, value)
  if (s.connectivity === 'Intermittent' && state === 'meetsTarget') {
    state = 'nearBreach'
  }
  if (
    s.connectivity === 'Intermittent' &&
    (s.setupAccessFailures + s.callDrops >= 4 || s.packetLossPct >= 3)
  ) {
    state = 'breached'
  }
  const label = state === 'meetsTarget' ? 'Good' : state === 'nearBreach' ? 'Warning' : 'Bad'
  return { state, label, value, display: formatKpiValue(selectedKpiId, value) }
}

function journeySamplesPerSession(imsi: string): number {
  return imsi === VIP_HIGHWAY_IMSI ? VIP_JOURNEY_SAMPLES_PER_SESSION : DEFAULT_JOURNEY_SAMPLES_PER_SESSION
}

function sessionAnchorLngLat(
  session: SessionRow,
  imsi: string,
): [number, number] {
  const cell = cellById(session.cellId)
  if (!cell) return mapXYToLngLat(50, 50)
  const center = mapXYToLngLat(cell.mapX, cell.mapY)
  const seed = hashString(`${imsi}-${session.id}-anchor`)
  const azimuth = cellSectorAzimuth(cell)
  const offset = offsetLngLat(center, azimuth, rand01(seed + 3) * 0.00022)
  return [
    offset[0] + randNormal(seed + 7) * 0.00006,
    offset[1] + randNormal(seed + 11) * 0.00005,
  ]
}

function pushSessionPixel(
  features: Feature<Point, PixelProps>[],
  coordinates: [number, number],
  session: SessionRow,
  imsi: string,
  selectedKpiId: KpiId,
  period: 'A' | 'B',
  selectedSessionIds: Set<string>,
  penalty = 0,
  jitter = 0,
) {
  const band = operatorBandForKpi(session, selectedKpiId, penalty, jitter)
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: withPixelColor({
      imsi,
      sessionId: session.id,
      cellId: session.cellId,
      period,
      kpiValue: band.value,
      kpiValueDisplay: band.display,
      kpiState: band.state,
      kpiStateLabel: band.label,
      selectedSession: selectedSessionIds.has(session.id) ? 1 : 0,
      hasSelection: selectedSessionIds.size > 0 ? 1 : 0,
    }),
  })
}

function makeSessionAnchorPoints(
  imsi: string,
  sessions: SessionRow[],
  selectedKpiId: KpiId,
  period: 'A' | 'B',
  selectedSessionIds: Set<string>,
): Feature<Point, PixelProps>[] {
  const features: Feature<Point, PixelProps>[] = []
  const periodPenalty = period === 'B' ? 8 : 0
  sessions.forEach((session, sessionIdx) => {
    const handoverStress =
      sessionIdx > 0 && sessions[sessionIdx - 1]?.cellId !== session.cellId ? 10 : 0
    pushSessionPixel(
      features,
      sessionAnchorLngLat(session, imsi),
      session,
      imsi,
      selectedKpiId,
      period,
      selectedSessionIds,
      periodPenalty + handoverStress,
      rand01(hashString(`${session.id}-${period}`)) * 4,
    )
  })
  return features
}

function makeHandoverEventPoints(
  imsi: string,
  sessions: SessionRow[],
  selectedKpiId: KpiId,
  period: 'A' | 'B',
  selectedSessionIds: Set<string>,
): Feature<Point, PixelProps>[] {
  const features: Feature<Point, PixelProps>[] = []
  const periodPenalty = period === 'B' ? 8 : 0
  sessions.forEach((session, sessionIdx) => {
    const isHandover = sessionIdx > 0 && sessions[sessionIdx - 1]?.cellId !== session.cellId
    if (sessionIdx > 0 && !isHandover) return
    pushSessionPixel(
      features,
      sessionAnchorLngLat(session, imsi),
      session,
      imsi,
      selectedKpiId,
      period,
      selectedSessionIds,
      periodPenalty + (isHandover ? 16 : 4),
      rand01(hashString(`${session.id}-ho-${period}`)) * 5,
    )
  })
  return features
}

function makeSubscriberFocusPixels(
  imsi: string,
  sessions: SessionRow[],
  selectedKpiId: KpiId,
  period: 'A' | 'B',
  displayMode: PixelDisplayMode,
  selectedSessionIds: Set<string>,
): Feature<Point, PixelProps>[] {
  switch (displayMode) {
    case 'sessionAnchors':
      return makeSessionAnchorPoints(imsi, sessions, selectedKpiId, period, selectedSessionIds)
    case 'handovers':
      return makeHandoverEventPoints(imsi, sessions, selectedKpiId, period, selectedSessionIds)
    default:
      return makeSessionJourneyPoints(
        imsi,
        sessions,
        selectedKpiId,
        period,
        selectedSessionIds,
      )
  }
}

function makeSessionJourneyPoints(
  imsi: string,
  sessions: SessionRow[],
  selectedKpiId: KpiId,
  period: 'A' | 'B',
  selectedSessionIds: Set<string>,
): Feature<Point, PixelProps>[] {
  const features: Feature<Point, PixelProps>[] = []
  const seed = hashString(imsi)
  const periodShiftLng = period === 'B' ? 0.000045 : 0
  const periodShiftLat = period === 'B' ? -0.000035 : 0
  const periodPenalty = period === 'B' ? 11 : 0
  const perSession = journeySamplesPerSession(imsi)

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
        const band = operatorBandForKpi(
          s,
          selectedKpiId,
          tunnel + periodPenalty + handoverPenalty,
          jitter,
        )
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [safeLng, safeLat] },
          properties: withPixelColor({
            imsi,
            sessionId: s.id,
            cellId: s.cellId,
            period,
            kpiValue: band.value,
            kpiValueDisplay: band.display,
            kpiState: band.state,
            kpiStateLabel: band.label,
            selectedSession: selectedSessionIds.has(s.id) ? 1 : 0,
            hasSelection: selectedSessionIds.size > 0 ? 1 : 0,
          }),
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
      const band = operatorBandForKpi(
        s,
        selectedKpiId,
        tunnel + periodPenalty + handoverStress,
        jitter,
      )
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [safeLng, safeLat] },
        properties: withPixelColor({
          imsi,
          sessionId: s.id,
          cellId: s.cellId,
          period,
          kpiValue: band.value,
          kpiValueDisplay: band.display,
          kpiState: band.state,
          kpiStateLabel: band.label,
          selectedSession: selectedSessionIds.has(s.id) ? 1 : 0,
          hasSelection: selectedSessionIds.size > 0 ? 1 : 0,
        }),
      })
    }
  })
  return features
}

function makeActivityCloud(
  subscribers: typeof SUBSCRIBERS,
  selectedKpiId: KpiId,
  period: 'A' | 'B',
  selectedSessionIds: Set<string>,
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
    const band = operatorBandForKpi(
      pseudoSession,
      selectedKpiId,
      periodPenalty,
      rand01(seed + 5) * 8,
    )
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [safeLng, safeLat],
      },
      properties: withPixelColor({
        imsi: s.imsi,
        sessionId: `ACT-${s.imsi.slice(-7)}-${i}`,
        cellId: s.cellId,
        period,
        kpiValue: band.value,
        kpiValueDisplay: band.display,
        kpiState: band.state,
        kpiStateLabel: band.label,
        selectedSession: 0,
        hasSelection: selectedSessionIds.size > 0 ? 1 : 0,
      }),
    })
  })
  return features
}

export function OperatorMap({
  mode,
  selectedCellId,
  subscriberImsi,
  selectedKpiId,
  sessions,
  selectedSessionIds = [],
  onSessionSelect,
  sessionTableCellFilter: _sessionTableCellFilter,
  showHoverKpis: _showHoverKpis,
  embed = 'full',
  subscriberGlobalFilters,
  onCellSelect,
  onMapBackgroundClick,
}: Props) {
  void _showHoverKpis
  void _sessionTableCellFilter
  const compact = embed === 'compact'
  const selectedSessionIdSet = useMemo(() => new Set(selectedSessionIds), [selectedSessionIds])
  const filters = subscriberGlobalFilters ?? ALL_SUBSCRIBER_FILTERS
  /** Parent passes inline handlers; keep refs so the map mount effect does not re-run every render. */
  const onCellSelectRef = useRef(onCellSelect)
  const onMapBackgroundClickRef = useRef(onMapBackgroundClick)
  const onSessionSelectRef = useRef(onSessionSelect)
  onCellSelectRef.current = onCellSelect
  onMapBackgroundClickRef.current = onMapBackgroundClick
  onSessionSelectRef.current = onSessionSelect
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapShellRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const pixelPopupRef = useRef<mapboxgl.Popup | null>(null)
  const pixelHoverPopupRef = useRef<mapboxgl.Popup | null>(null)
  const lastHoveredPixelFeatureIdRef = useRef<string | number | null>(null)
  const selectedKpiIdRef = useRef<KpiId>(selectedKpiId)
  selectedKpiIdRef.current = selectedKpiId
  const [mapReady, setMapReady] = useState(false)
  const [showPixels, setShowPixels] = useState(true)
  const [showPeriodB, setShowPeriodB] = useState(false)
  const pixelDisplayMode: PixelDisplayMode = 'journeySamples'
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const [mapIsFullscreen, setMapIsFullscreen] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const deferMapError = (message: string) => {
    setTimeout(() => {
      setMapError(message)
    }, 0)
  }
  const canShowPeriodBOverlay = mode === 'subscriberFocus'
  const showPeriodBOverlay = canShowPeriodBOverlay && showPeriodB

  useEffect(() => {
    const syncFullscreen = () => {
      setMapIsFullscreen(document.fullscreenElement === mapShellRef.current)
    }
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  const { direct, all } = useMemo(
    () =>
      subscriberImsi
        ? subscriberFootprint(subscriberImsi)
        : { direct: new Set<string>(), all: new Set<string>() },
    [subscriberImsi],
  )

  const aoiCellSet = useMemo(
    () => unionCellIdsForAoiSelection(filters.selectedAoiIds ?? []),
    [filters.selectedAoiIds],
  )

  const fitIds = useMemo(() => {
    let base: Set<string>
    if (mode === 'all') base = new Set(CELLS.map((c) => c.id))
    else if (mode === 'cellFocus' && selectedCellId) base = neighborSet(selectedCellId)
    else if (mode === 'subscriberFocus' && all.size) base = all
    else base = new Set(CELLS.map((c) => c.id))
    if (!aoiCellSet?.size) return base
    const inter = new Set<string>()
    for (const id of base) if (aoiCellSet.has(id)) inter.add(id)
    return inter.size > 0 ? inter : base
  }, [mode, selectedCellId, all, aoiCellSet])

  const cellsForMap = useMemo(() => {
    if (!aoiCellSet?.size) return CELLS
    return CELLS.filter((c) => aoiCellSet.has(c.id))
  }, [aoiCellSet])

  const cellCollection = useMemo<FeatureCollection<Polygon, CellFeatureProps>>(() => {
    const features: Feature<Polygon, CellFeatureProps>[] = cellsForMap.map((c) => {
      const center = mapXYToLngLat(c.mapX, c.mapY)
      const azimuth = bearingFromCells(c, cellById(c.neighborIds[0]))
      const geom = wedgePolygon(center, azimuth)
      let opacity = 0.9
      if (mode === 'cellFocus' && selectedCellId) {
        const n = neighborSet(selectedCellId)
        if (c.id === selectedCellId) opacity = 1
        else if (n.has(c.id)) opacity = 0.34
        else opacity = 0.08
      } else if (mode === 'subscriberFocus' && subscriberImsi) {
        if (direct.has(c.id)) opacity = 0.98
        else if (all.has(c.id)) opacity = 0.32
        else opacity = 0.08
      }
      let cellFillColor: string
      if (mode === 'subscriberFocus' && subscriberImsi && sessions.length > 0) {
        const scopedBand = subscriberCellKpiBand(c.id, sessions, selectedKpiId)
        if (scopedBand !== null) {
          cellFillColor = performanceColorForState(scopedBand, 'A')
        } else if (direct.has(c.id) || all.has(c.id)) {
          cellFillColor = MAP_PERFORMANCE_COLORS.fair
        } else {
          cellFillColor = performanceColorForState(
            kpiBand(selectedKpiId, cellKpiValue(c, filters, selectedKpiId)),
            'A',
          )
        }
      } else {
        cellFillColor = performanceColorForState(
          kpiBand(selectedKpiId, cellKpiValue(c, filters, selectedKpiId)),
          'A',
        )
      }
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: geom },
        properties: {
          cellId: c.id,
          cellFillColor,
          opacity,
          selected: selectedCellId === c.id ? 1 : 0,
          tooltipHtml: mapCellSummaryLines(
            c,
            filters,
            selectedKpiId,
            mode === 'subscriberFocus' && subscriberImsi ? sessions : undefined,
          ).join('<br/>'),
        },
      }
    })
    return { type: 'FeatureCollection', features }
  }, [mode, selectedCellId, subscriberImsi, direct, all, filters, selectedKpiId, sessions, cellsForMap])

  const pixelCollection = useMemo<FeatureCollection<Point, PixelProps>>(() => {
    if (mode === 'subscriberFocus' && subscriberImsi) {
      const featuresA = makeSubscriberFocusPixels(
        subscriberImsi,
        sessions,
        selectedKpiId,
        'A',
        pixelDisplayMode,
        selectedSessionIdSet,
      )
      const features = showPeriodBOverlay
        ? featuresA.concat(
            makeSubscriberFocusPixels(
              subscriberImsi,
              sessions,
              selectedKpiId,
              'B',
              pixelDisplayMode,
              selectedSessionIdSet,
            ),
          )
        : featuresA
      return { type: 'FeatureCollection', features }
    }
    const baseSubs =
      mode === 'cellFocus' && selectedCellId
        ? applyGlobalSubscriberFilters(subscribersForFootprint(selectedCellId), filters)
        : applyGlobalSubscriberFilters(SUBSCRIBERS, filters)
    const scoped =
      mode === 'cellFocus' && selectedCellId
        ? baseSubs.filter((s) => neighborSet(selectedCellId).has(s.cellId))
        : baseSubs
    const featuresA = makeActivityCloud(scoped, selectedKpiId, 'A', selectedSessionIdSet)
    const features = showPeriodBOverlay
      ? featuresA.concat(
          makeActivityCloud(scoped, selectedKpiId, 'B', selectedSessionIdSet),
        )
      : featuresA
    return { type: 'FeatureCollection', features }
  }, [
    mode,
    subscriberImsi,
    selectedCellId,
    sessions,
    selectedSessionIdSet,
    filters,
    selectedKpiId,
    showPeriodBOverlay,
    pixelDisplayMode,
  ])

  const selectedPeriodAPoints = useMemo(
    () =>
      pixelCollection.features.filter(
        (f) => f.properties.period === 'A' && selectedSessionIdSet.has(f.properties.sessionId),
      ),
    [pixelCollection, selectedSessionIdSet],
  )

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return
    if (!mapboxgl.accessToken) {
      mapboxgl.accessToken =
        import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? MAPBOX_FALLBACK_ACCESS_TOKEN
    }
    if (!mapboxgl.accessToken) {
      deferMapError('Map unavailable: missing VITE_MAPBOX_ACCESS_TOKEN')
      return
    }
    const configuredStyle = (import.meta.env.VITE_MAPBOX_STYLE_URL ?? '').trim()
    // Use an env-provided style when available; otherwise keep the existing default.
    const mapStyle = configuredStyle || MAPBOX_FALLBACK_STYLE
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
      deferMapError(message)
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
        generateId: true,
      })
      map.addLayer({
        id: CELL_FILL_LAYER,
        type: 'fill',
        source: CELL_SOURCE,
        paint: {
          'fill-color': ['coalesce', ['get', 'cellFillColor'], '#1d4ed8'],
          'fill-opacity': [
            '*',
            ['coalesce', ['get', 'opacity'], 0.2],
            0.38,
          ],
        },
      })
      map.addLayer({
        id: CELL_LINE_LAYER,
        type: 'line',
        source: CELL_SOURCE,
        paint: {
          'line-color': ['case', ['==', ['get', 'selected'], 1], '#0f172a', '#ffffff'],
          'line-width': ['case', ['==', ['get', 'selected'], 1], 3.4, 0.9],
          'line-opacity': ['coalesce', ['get', 'opacity'], 0.2],
        },
      })
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
            PIXEL_COLOR_EXPR,
          ],
          'circle-opacity': [
            'case',
            ['==', ['get', 'selectedSession'], 1],
            0.98,
            ['==', ['get', 'hasSelection'], 1],
            0.24,
            ['match', ['get', 'kpiState'], 'breached', 0.82, 'nearBreach', 0.88, 0.94],
          ],
          'circle-stroke-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2.5,
            0,
          ],
          'circle-stroke-color': '#e2e8f0',
          'circle-stroke-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.95,
            0,
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
            PIXEL_COLOR_EXPR,
          ],
          'circle-opacity': [
            'case',
            ['==', ['get', 'selectedSession'], 1],
            0.74,
            ['==', ['get', 'hasSelection'], 1],
            0.14,
            ['match', ['get', 'kpiState'], 'breached', 0.26, 'nearBreach', 0.3, 0.34],
          ],
          'circle-stroke-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2.2,
            0,
          ],
          'circle-stroke-color': '#cbd5e1',
          'circle-stroke-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.85,
            0,
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
      pixelHoverPopupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
        maxWidth: 'min(320px, 92vw)',
        className: 'mapbox-kpi-popup mapbox-pixel-hover-popup',
      })

      const clearPixelHoverState = () => {
        const prev = lastHoveredPixelFeatureIdRef.current
        if (prev != null) {
          try {
            map.setFeatureState({ source: PIXEL_SOURCE, id: prev }, { hover: false })
          } catch {
            // ignore invalid ids during style reloads
          }
          lastHoveredPixelFeatureIdRef.current = null
        }
      }

      const handlePixelHoverMove = (e: mapboxgl.MapLayerMouseEvent) => {
        const f = e.features?.[0]
        if (!f || !e.lngLat || !pixelHoverPopupRef.current) return
        const fid = f.id
        if (fid !== undefined && fid !== null) {
          if (lastHoveredPixelFeatureIdRef.current !== fid) {
            const prev = lastHoveredPixelFeatureIdRef.current
            if (prev != null) {
              try {
                map.setFeatureState({ source: PIXEL_SOURCE, id: prev }, { hover: false })
              } catch {
                // ignore
              }
            }
            lastHoveredPixelFeatureIdRef.current = fid
            try {
              map.setFeatureState({ source: PIXEL_SOURCE, id: fid }, { hover: true })
            } catch {
              // ignore
            }
          }
        } else {
          clearPixelHoverState()
        }
        pixelHoverPopupRef.current
          .setLngLat(e.lngLat)
          .setHTML(buildPixelHoverTooltipHtml(f, selectedKpiIdRef.current))
          .addTo(map)
      }

      const handlePixelHoverLeave = () => {
        map.getCanvas().style.cursor = ''
        clearPixelHoverState()
        pixelHoverPopupRef.current?.remove()
      }

      const showPixelPopup = (e: mapboxgl.MapLayerMouseEvent) => {
        const f = e.features?.[0]
        if (!f || !e.lngLat || !pixelPopupRef.current) return
        pixelHoverPopupRef.current?.remove()
        clearPixelHoverState()
        const sessionId = String(f.properties?.sessionId ?? '')
        if (sessionId) onSessionSelectRef.current?.(sessionId)
        pixelPopupRef.current
          .setLngLat(e.lngLat)
          .setHTML(buildPixelHoverTooltipHtml(f, selectedKpiIdRef.current))
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
        pixelHoverPopupRef.current?.remove()
        clearPixelHoverState()
        if (id) onCellSelectRef.current?.(id)
      })

      map.on('mouseenter', PIXEL_A_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', PIXEL_A_LAYER, handlePixelHoverLeave)
      map.on('mousemove', PIXEL_A_LAYER, handlePixelHoverMove)
      map.on('mouseenter', PIXEL_B_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', PIXEL_B_LAYER, handlePixelHoverLeave)
      map.on('mousemove', PIXEL_B_LAYER, handlePixelHoverMove)
      map.on('click', PIXEL_A_LAYER, showPixelPopup)
      map.on('click', PIXEL_B_LAYER, showPixelPopup)

      map.on('click', (e) => {
        const clicked = map.queryRenderedFeatures(e.point, {
          layers: [CELL_FILL_LAYER, PIXEL_A_LAYER, PIXEL_B_LAYER],
        })
        if (clicked.length === 0) {
          pixelPopupRef.current?.remove()
          pixelHoverPopupRef.current?.remove()
          clearPixelHoverState()
          onMapBackgroundClickRef.current?.()
        }
      })

      map.resize()
      requestAnimationFrame(() => {
        map.resize()
      })
      setMapReady(true)
    })

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
      pixelPopupRef.current?.remove()
      pixelPopupRef.current = null
      pixelHoverPopupRef.current?.remove()
      pixelHoverPopupRef.current = null
      const prev = lastHoveredPixelFeatureIdRef.current
      if (prev != null && map.getSource(PIXEL_SOURCE)) {
        try {
          map.setFeatureState({ source: PIXEL_SOURCE, id: prev }, { hover: false })
        } catch {
          // ignore
        }
      }
      lastHoveredPixelFeatureIdRef.current = null
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapElRef.current) return
    const map = mapRef.current
    const el = mapElRef.current
    const scheduleResize = () => {
      map.resize()
      requestAnimationFrame(() => map.resize())
    }
    scheduleResize()
    const ro = new ResizeObserver(() => {
      scheduleResize()
    })
    ro.observe(el)
    window.addEventListener('resize', scheduleResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', scheduleResize)
    }
  }, [mapReady, compact])

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

  /** Pixel GeoJSON is replaced often; clear hover ring + hover popup so feature-state IDs stay consistent. */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const prev = lastHoveredPixelFeatureIdRef.current
    if (prev != null && map.getSource(PIXEL_SOURCE)) {
      try {
        map.setFeatureState({ source: PIXEL_SOURCE, id: prev }, { hover: false })
      } catch {
        // ignore
      }
    }
    lastHoveredPixelFeatureIdRef.current = null
    pixelHoverPopupRef.current?.remove()
  }, [mapReady, pixelCollection])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    if (!map.isStyleLoaded()) return
    if (!map.getLayer(PIXEL_A_LAYER) || !map.getLayer(PIXEL_B_LAYER)) return
    const visibility = showPixels ? 'visible' : 'none'
    try {
      map.setLayoutProperty(PIXEL_A_LAYER, 'visibility', visibility)
      map.setLayoutProperty(
        PIXEL_B_LAYER,
        'visibility',
        showPixels && showPeriodBOverlay ? 'visible' : 'none',
      )
    } catch {
      // Avoid hard-crashing React render path when style/layers are still resolving.
      deferMapError('Map layers are still loading, please retry in a moment.')
    }
  }, [mapReady, showPixels, showPeriodBOverlay])

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
    if (!mapReady || !mapRef.current || selectedSessionIds.length === 0) return
    if (!selectedPeriodAPoints.length) return

    const map = mapRef.current

    if (selectedSessionIds.length === 1 || selectedPeriodAPoints.length === 1) {
      const selectedPoint = selectedPeriodAPoints[0]
      const center = selectedPoint.geometry.coordinates
      if (!isFiniteLngLat(center)) {
        deferMapError('Unable to focus selected session due to invalid coordinates')
        return
      }
      try {
        map.flyTo({
          center,
          duration: 320,
          zoom: Math.max(map.getZoom(), 14.8),
        })
      } catch {
        deferMapError('Unable to focus selected session')
      }
      return
    }

    const bounds = new mapboxgl.LngLatBounds()
    let hasValidCoordinate = false
    for (const point of selectedPeriodAPoints) {
      const coordinates = point.geometry.coordinates
      if (!isFiniteLngLat(coordinates)) continue
      bounds.extend(coordinates)
      hasValidCoordinate = true
    }
    if (!hasValidCoordinate) {
      deferMapError('Unable to focus selected sessions due to invalid coordinates')
      return
    }
    try {
      map.fitBounds(bounds, {
        padding: compact ? 36 : 64,
        duration: 320,
        maxZoom: 14.8,
      })
    } catch {
      deferMapError('Unable to focus selected sessions')
    }
  }, [mapReady, selectedSessionIds, selectedPeriodAPoints, compact])

  const toggleMapFullscreen = () => {
    const el = mapShellRef.current
    if (!el) return
    void (async () => {
      try {
        if (document.fullscreenElement === el) {
          await document.exitFullscreen()
        } else {
          await el.requestFullscreen()
        }
      } catch {
        // Fullscreen may be unavailable (iframe permissions, etc.)
      }
    })()
  }

  return (
    <div ref={mapShellRef} className={`map-shell ${compact ? 'map-shell--embed' : ''}`}>
      <div className={`map-toolbar ${compact ? 'map-toolbar--embed' : ''}`}>
        <span className="map-toolbar-title">{compact ? 'Map' : 'RAN footprint'}</span>
        <div className="map-toolbar-actions">
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
        <div className="map-float-controls" role="toolbar" aria-label="Map controls">
          <button
            type="button"
            className="map-float-controls__btn map-float-controls__btn--icon"
            title={mapIsFullscreen ? 'Exit full screen' : 'Full screen'}
            aria-label={mapIsFullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={toggleMapFullscreen}
          >
            {mapIsFullscreen ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="4 14 4 20 10 20" />
                <polyline points="20 10 20 4 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="4 9 4 4 9 4" />
                <polyline points="15 4 20 4 20 9" />
                <polyline points="20 15 20 20 15 20" />
                <polyline points="9 20 4 20 4 15" />
              </svg>
            )}
          </button>
          <div className="map-float-controls__sep" role="presentation" />
          <button
            type="button"
            className="map-float-controls__btn"
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
          >
            +
          </button>
          <button
            type="button"
            className="map-float-controls__btn"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
          >
            −
          </button>
        </div>
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
                <span
                  className="map-legend-swatch"
                  style={{ backgroundColor: MAP_PERFORMANCE_COLORS.good }}
                  aria-hidden
                />
                <span className="map-legend-label">Good</span>
                <span className="map-legend-value">Meets target</span>
              </div>
              <div className="map-legend-row">
                <span
                  className="map-legend-swatch"
                  style={{ backgroundColor: MAP_PERFORMANCE_COLORS.fair }}
                  aria-hidden
                />
                <span className="map-legend-label">Fair</span>
                <span className="map-legend-value">Neutral</span>
              </div>
              <div className="map-legend-row">
                <span
                  className="map-legend-swatch"
                  style={{ backgroundColor: MAP_PERFORMANCE_COLORS.warning }}
                  aria-hidden
                />
                <span className="map-legend-label">Warning</span>
                <span className="map-legend-value">Near breach</span>
              </div>
              <div className="map-legend-row">
                <span
                  className="map-legend-swatch"
                  style={{ backgroundColor: MAP_PERFORMANCE_COLORS.bad }}
                  aria-hidden
                />
                <span className="map-legend-label">Bad</span>
                <span className="map-legend-value">Breached</span>
              </div>
              <label className="map-legend-toggle">
                <input
                  type="checkbox"
                  checked={showPixels}
                  onChange={(e) => setShowPixels(e.target.checked)}
                />
                Show pixels
              </label>
              {canShowPeriodBOverlay && (
                <label className="map-legend-toggle">
                  <input
                    type="checkbox"
                    checked={showPeriodB}
                    onChange={(e) => setShowPeriodB(e.target.checked)}
                  />
                  Show period B overlay
                </label>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
