import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  SUBSCRIBERS,
  applyGlobalSubscriberFilters,
  cellById,
  cellKpiValue,
  comparePeriodBLabel,
  computePeriodBKpiValueByKpi,
  formatKpiValue,
  formatSessionDuration,
  formatSessionStartLocal,
  getSessions,
  globalTimeRangeLabel,
  rankedCellsByKpi,
  sessionKpiValue,
  sortSubscribersByKpi,
  subscriberKpiValue,
  subscribersForFootprint,
  type ComparePeriodOption,
  type Cell as NetworkCell,
  type Subscriber as NetworkSubscriber,
  type SubscriberDevice,
  type SubscriberGlobalFilters,
  type TableTab,
} from '../../data/placeholderNetwork'
import { GlobalFiltersBar } from './GlobalFiltersBar'
import { OperatorMap } from './OperatorMap'
import {
  DEFAULT_GLOBAL_FILTER_SNAPSHOT,
  loadFilterPresets,
  newPresetId,
  persistFilterPresets,
  type GlobalFilterSnapshot,
  type SavedFilterPreset,
} from '../../utils/filterPresets'
import { correlatedKpiIdsForLens, correlatedSessionSummary } from '../../data/kpiCorrelations'
import {
  KPI_BY_ID,
  kpiDistributionBins,
  type KpiDistributionBin,
  type KpiId,
} from '../../data/kpis'
import { DashboardTopHeader } from './DashboardTopHeader'

type View = 'cells' | 'subscribers' | 'sessions'

const TABS: { id: TableTab; label: string }[] = [
  { id: 'callDrop', label: 'Call drop' },
  { id: 'failure', label: 'Failure type' },
  { id: 'payload', label: 'Payload' },
  { id: 'handover', label: 'Handover' },
]

const CELL_FOCUS_TREND_BUCKETS = 48
const CELL_FOCUS_SCATTER_MAX_POINTS = 320
const CELL_FOCUS_COMPARISON_MAX_SESSIONS = 2500

type SessionPoint = ReturnType<typeof getSessions>[number]

/** Default session table: connectivity is degraded or intermittent only (stable rows need Show all sessions). */
function sessionPassesStressTableFilter(session: SessionPoint): boolean {
  const c = session.connectivity.toLowerCase()
  return c.includes('intermittent') || c.includes('degraded')
}

type TrendDatum = {
  i: number
  tp: number
  id: string | null
  cellId: string | null
  cellName: string | null
  peerBackdrop: number | null
  peerAvg: number | null
  peerLow: number | null
  peerHigh: number | null
  peerCount: number
  bucketSize: number
  bucketCellCount: number
  p10: number
  p90: number
  low: number
  high: number
  isAggregated: boolean
}

function deterministicSample<T>(items: T[], maxItems: number): T[] {
  if (items.length <= maxItems || maxItems <= 0) return items
  if (maxItems === 1) return [items[0]]
  const result: T[] = []
  for (let i = 0; i < maxItems; i += 1) {
    const idx = Math.floor((i * (items.length - 1)) / (maxItems - 1))
    result.push(items[idx])
  }
  return result
}

function percentileFromSorted(values: number[], percentile: number): number {
  if (!values.length) return 0
  const clamped = Math.min(Math.max(percentile, 0), 1)
  const idx = Math.floor(clamped * (values.length - 1))
  return values[idx]
}

function distributionBinIndex(value: number, bins: KpiDistributionBin[]): number {
  for (let i = 0; i < bins.length; i += 1) {
    const bin = bins[i]
    if (value >= bin.min && value < bin.max) return i
  }
  return Math.max(0, bins.length - 1)
}

function distributionStats(values: number[], bins: KpiDistributionBin[]) {
  const counts = new Array(bins.length).fill(0)
  for (const value of values) {
    const idx = distributionBinIndex(value, bins)
    counts[idx] += 1
  }
  const total = values.length
  let cumulativePct = 0
  return bins.map((_, idx) => {
    const count = counts[idx]
    const pct = total > 0 ? (count / total) * 100 : 0
    cumulativePct = Math.min(100, cumulativePct + pct)
    return { count, pct, cdfPct: cumulativePct }
  })
}

function bucketSessionsForTrend(sessions: SessionPoint[], targetBuckets: number) {
  if (!sessions.length) return []
  const bucketCount = Math.max(1, Math.min(targetBuckets, sessions.length))
  const buckets: {
    i: number
    avgThroughput: number
    p10Throughput: number
    p90Throughput: number
    lowThroughput: number
    highThroughput: number
    bucketSize: number
    cellCount: number
  }[] = []
  for (let bucketIdx = 0; bucketIdx < bucketCount; bucketIdx += 1) {
    const start = Math.floor((bucketIdx * sessions.length) / bucketCount)
    const end = Math.floor(((bucketIdx + 1) * sessions.length) / bucketCount)
    const slice = sessions.slice(start, end)
    if (!slice.length) continue
    const throughput = slice.map((session) => session.throughputMbps)
    const sorted = [...throughput].sort((a, b) => a - b)
    const total = throughput.reduce((sum, value) => sum + value, 0)
    buckets.push({
      i: buckets.length,
      avgThroughput: total / throughput.length,
      p10Throughput: percentileFromSorted(sorted, 0.1),
      p90Throughput: percentileFromSorted(sorted, 0.9),
      lowThroughput: sorted[0],
      highThroughput: sorted[sorted.length - 1],
      bucketSize: slice.length,
      cellCount: new Set(slice.map((session) => session.cellId)).size,
    })
  }
  return buckets
}

function matchImsi(q: string, imsi: string): boolean {
  const n = q.replace(/\s/g, '').toLowerCase()
  if (!n) return true
  return imsi.replace(/\s/g, '').toLowerCase().includes(n)
}

function cellDetailColSpan(tab: TableTab): number {
  switch (tab) {
    case 'handover':
      return 4
    default:
      return 3
  }
}

function CellDetailsPanel({ cell }: { cell: NetworkCell }) {
  return (
    <div className="cell-details-grid" role="group" aria-label={`Details for ${cell.name}`}>
      <span>
        <strong>Cell ID</strong>: {cell.id}
      </span>
      <span>
        <strong>Site</strong>: {cell.siteCode}
      </span>
      <span>
        <strong>Sector</strong>: {cell.sector}
      </span>
      <span>
        <strong>Azimuth</strong>: {cell.azimuthDeg} deg
      </span>
      <span>
        <strong>PCI</strong>: {cell.pci}
      </span>
      <span>
        <strong>NR-ARFCN</strong>: {cell.nrArfcn}
      </span>
      <span>
        <strong>Band / BW</strong>: {cell.band} / {cell.bandwidthMhz} MHz
      </span>
      <span>
        <strong>TAC</strong>: {cell.tac}
      </span>
      <span>
        <strong>Antenna</strong>: {cell.antennaHeightM} m, tilt {cell.electricalTiltDeg} deg
      </span>
      <span>
        <strong>Vendor</strong>: {cell.vendor}
      </span>
      <span>
        <strong>Neighbors</strong>: {cell.neighborIds.length}
      </span>
    </div>
  )
}

function subscriberDeviceLabel(device: SubscriberDevice): string {
  switch (device) {
    case 'phone':
      return 'Mobile handset'
    case 'cpe':
      return 'CPE / fixed wireless'
    case 'module':
      return 'IoT / embedded module'
    default:
      return device
  }
}

function SubscriberDetailsPanel({ subscriber }: { subscriber: NetworkSubscriber }) {
  const anchor = cellById(subscriber.cellId)
  return (
    <div className="subscriber-details-grid" role="group" aria-label="Additional subscriber details">
      <span>
        <strong>Subscriber type</strong>: {subscriber.segment}
      </span>
      <span>
        <strong>Device</strong>: {subscriber.device}
      </span>
      <span>
        <strong>Technology</strong>: {subscriber.technology.toUpperCase()} {subscriber.mode.toUpperCase()}
      </span>
      <span>
        <strong>Service</strong>: {subscriber.service}
      </span>
      <span>
        <strong>Neighbor cells</strong>: {anchor?.neighborIds.length ?? 0}
      </span>
      <span>
        <strong>Setup/access failures</strong>: {subscriber.setupAccessFailures}
      </span>
      <span>
        <strong>Call drops</strong>: {subscriber.callDrops}
      </span>
      <span>
        <strong>DL throughput</strong>: {subscriber.dlMbps} Mbps
      </span>
      <span>
        <strong>UL throughput</strong>: {subscriber.ulMbps} Mbps
      </span>
      <span>
        <strong>HO success</strong>: {subscriber.hoSuccessPct.toFixed(1)}%
      </span>
    </div>
  )
}

function TableNavBreadcrumb({
  view,
  selectedCellId,
  selectedImsi,
  onToCells,
  onToSubscribers,
}: {
  view: 'subscribers' | 'sessions'
  selectedCellId: string | null
  selectedImsi: string | null
  onToCells: () => void
  onToSubscribers: () => void
}) {
  const cell = selectedCellId ? cellById(selectedCellId) : undefined
  const cellLabel = cell ? `${cell.name} (${cell.id})` : (selectedCellId ?? 'Cell')

  if (view === 'sessions') {
    return (
      <nav className="table-breadcrumb" aria-label="Subscriber context">
        <ol className="table-breadcrumb-list">
          {selectedCellId ? (
            <>
              <li className="table-breadcrumb-item">
                <button type="button" className="table-breadcrumb-link" onClick={onToSubscribers}>
                  {cellLabel}
                </button>
              </li>
              <li className="table-breadcrumb-sep" aria-hidden="true">
                /
              </li>
            </>
          ) : null}
          <li className="table-breadcrumb-item">
            <span className="table-breadcrumb-current mono" aria-current="page">
              {selectedImsi}
            </span>
          </li>
        </ol>
      </nav>
    )
  }

  return (
    <nav className="table-breadcrumb" aria-label="Drill-down navigation">
      <ol className="table-breadcrumb-list">
        <li className="table-breadcrumb-item">
          <button type="button" className="table-breadcrumb-link" onClick={onToCells}>
            Cells
          </button>
        </li>
        {selectedCellId && (
          <>
            <li className="table-breadcrumb-sep" aria-hidden="true">
              /
            </li>
            <li className="table-breadcrumb-item">
              <span className="table-breadcrumb-current" aria-current="page">
                {cellLabel}
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  )
}

function connectivityChipClass(connectivity: string): string {
  const c = connectivity.toLowerCase()
  if (c.includes('intermittent')) return 'connectivity-chip--intermittent'
  if (c.includes('degraded')) return 'connectivity-chip--degraded'
  return 'connectivity-chip--stable'
}

function connectivityLabelSentenceCase(connectivity: string): string {
  const t = connectivity.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

function SessionCorrelatedKpisSection({
  session,
  lensKpiId,
}: {
  session: SessionPoint
  lensKpiId: KpiId
}) {
  const ids = useMemo(() => correlatedKpiIdsForLens(lensKpiId), [lensKpiId])
  const lensDef = KPI_BY_ID[lensKpiId]
  const lensVal = sessionKpiValue(session, lensKpiId)
  const summary = useMemo(
    () => correlatedSessionSummary(lensKpiId, (id) => sessionKpiValue(session, id)),
    [lensKpiId, session],
  )
  return (
    <section
      className="session-correlated-section"
      aria-labelledby="session-correlated-h"
      aria-describedby="session-correlated-summary"
    >
      <h3 className="session-correlated-section__title" id="session-correlated-h">
        Correlated KPIs
      </h3>
      <div className="session-correlated-lens-strip" aria-label="Global lens value for this session">
        <span className="session-correlated-lens-strip__label">{lensDef.label}</span>
        <span className="session-correlated-lens-strip__value mono">{formatKpiValue(lensKpiId, lensVal)}</span>
      </div>
      {ids.length > 0 ? (
        <dl className="session-correlated-dl">
          {ids.map((kpiId) => (
            <div key={kpiId} className="session-correlated-dl__row">
              <dt>{KPI_BY_ID[kpiId].label}</dt>
              <dd className="mono">{formatKpiValue(kpiId, sessionKpiValue(session, kpiId))}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="session-correlated-summary" id="session-correlated-summary">
        {summary}
      </p>
    </section>
  )
}

function SessionDetailSlideOver({
  session,
  lensKpiId,
  onClose,
}: {
  session: SessionPoint
  lensKpiId: KpiId
  onClose: () => void
}) {
  const networkCell = cellById(session.cellId)
  return (
    <div className="session-detail-pane">
      <div className="session-detail-pane__header">
        <div className="session-detail-pane__header-body">
          <p className="session-detail-pane__eyebrow" id="session-detail-pane-title">
            Session
          </p>
          <dl className="session-detail-pane__facts">
            <div className="session-detail-pane__fact-row">
              <dt>Session ID</dt>
              <dd className="mono">{session.id}</dd>
            </div>
            <div className="session-detail-pane__fact-row">
              <dt>Serving cell</dt>
              <dd>
                {session.cellName} <span className="mono">({session.cellId})</span>
              </dd>
            </div>
            {networkCell ? (
              <div className="session-detail-pane__fact-row">
                <dt>Site / sector / band</dt>
                <dd>
                  Site {networkCell.siteCode} · sector {networkCell.sector} · band {networkCell.band}
                </dd>
              </div>
            ) : null}
            <div className="session-detail-pane__fact-row">
              <dt>Duration</dt>
              <dd>{formatSessionDuration(session.durationMs)}</dd>
            </div>
          </dl>
        </div>
        <button type="button" className="session-detail-pane__close" onClick={onClose} aria-label="Close session details">
          ✕
        </button>
      </div>
      <div className="session-detail-pane__scroll">
        <SessionCorrelatedKpisSection session={session} lensKpiId={lensKpiId} />
      </div>
    </div>
  )
}

function SubscriberSessionSummaryBar({ subscriber }: { subscriber: NetworkSubscriber }) {
  return (
    <div className="subscriber-session-summary" role="group" aria-label="Subscriber profile">
      <div className="subscriber-session-summary__grid">
        <span>
          <strong>Device</strong> {subscriberDeviceLabel(subscriber.device)}
        </span>
        <span>
          <strong>Subscriber type</strong> {subscriber.segment}
        </span>
        <span>
          <strong>Access</strong> {subscriber.technology.toUpperCase()} {subscriber.mode.toUpperCase()}
        </span>
        <span>
          <strong>Service</strong> {subscriber.service}
        </span>
      </div>
    </div>
  )
}

export function OperatorDashboard() {
  const [timeRange, setTimeRange] = useState('24h')
  const [customTimeRangeStart, setCustomTimeRangeStart] = useState('')
  const [customTimeRangeEnd, setCustomTimeRangeEnd] = useState('')
  const [service, setService] = useState('all')
  const [networkMode, setNetworkMode] = useState<'all' | 'sa' | 'nsa'>(
    DEFAULT_GLOBAL_FILTER_SNAPSHOT.networkMode,
  )
  const [subscriberType, setSubscriberType] = useState('all')
  const [selectedKpiId, setSelectedKpiId] = useState<KpiId>(DEFAULT_GLOBAL_FILTER_SNAPSHOT.selectedKpiId)
  const [cellAttributes, setCellAttributes] = useState('')

  const [filterPresets, setFilterPresets] = useState<SavedFilterPreset[]>(() =>
    loadFilterPresets(),
  )

  useEffect(() => {
    persistFilterPresets(filterPresets)
  }, [filterPresets])

  const [activeTab, setActiveTab] = useState<TableTab>('callDrop')
  const [view, setView] = useState<View>('cells')
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
  const [selectedImsi, setSelectedImsi] = useState<string | null>(null)
  /** STATE 3: filter session table to one cell (map click); cleared on background click or navigation. */
  const [sessionCellFilter, setSessionCellFilter] = useState<string | null>(null)
  /** When false (default), session table/map use stress-only rows; when true, show every session in scope. */
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [sessionSelectionAnchorId, setSessionSelectionAnchorId] = useState<string | null>(null)
  const [expandedCellIds, setExpandedCellIds] = useState<Set<string>>(() => new Set())
  const [expandedSubscriberIds, setExpandedSubscriberIds] = useState<Set<string>>(() => new Set())
  /** Open slide-over session inspector (plain row click); cleared on nav / multi-select / backdrop. */
  const [sessionDetailPaneId, setSessionDetailPaneId] = useState<string | null>(null)
  const [tableImsiSearch, setTableImsiSearch] = useState('')

  const [comparePeriodB, setComparePeriodB] = useState<ComparePeriodOption>('7d')
  const [customRangeStart, setCustomRangeStart] = useState('')
  const [customRangeEnd, setCustomRangeEnd] = useState('')
  const [showComparisonCdf, setShowComparisonCdf] = useState(false)

  const subscriberGlobalFilters: SubscriberGlobalFilters = useMemo(
    () => ({
      timeRange,
      customTimeRangeStart,
      customTimeRangeEnd,
      service,
      networkMode,
      subscriberType,
    }),
    [
      timeRange,
      customTimeRangeStart,
      customTimeRangeEnd,
      service,
      networkMode,
      subscriberType,
    ],
  )

  const ranked = useMemo(
    () => rankedCellsByKpi(selectedKpiId, subscriberGlobalFilters),
    [selectedKpiId, subscriberGlobalFilters],
  )

  const visibleRanked = useMemo(() => {
    const q = cellAttributes.trim().toLowerCase()
    if (!q) return ranked
    return ranked.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    )
  }, [ranked, cellAttributes])

  const footprintSubscribers = useMemo(() => {
    if (!selectedCellId) return []
    const base = subscribersForFootprint(selectedCellId)
    return applyGlobalSubscriberFilters(base, subscriberGlobalFilters)
  }, [selectedCellId, subscriberGlobalFilters])

  const subscriberRows = useMemo(() => {
    let rows = footprintSubscribers
    if (tableImsiSearch.trim())
      rows = rows.filter((s) => matchImsi(tableImsiSearch, s.imsi))
    return sortSubscribersByKpi(rows, selectedKpiId)
  }, [footprintSubscribers, selectedKpiId, tableImsiSearch])

  const imsiQuickMatches = useMemo(() => {
    const q = tableImsiSearch.trim()
    if (!q) return []
    return SUBSCRIBERS.filter((s) => matchImsi(q, s.imsi)).slice(0, 8)
  }, [tableImsiSearch])

  const allSessionsForSubscriber = useMemo(
    () => (selectedImsi ? getSessions(selectedImsi, subscriberGlobalFilters) : []),
    [selectedImsi, subscriberGlobalFilters],
  )

  const sessionDrillSubscriber = useMemo(() => {
    if (!selectedImsi) return null
    return SUBSCRIBERS.find((s) => s.imsi === selectedImsi) ?? null
  }, [selectedImsi])

  const sessions = useMemo(() => {
    if (!sessionCellFilter) return allSessionsForSubscriber
    return allSessionsForSubscriber.filter((s) => s.cellId === sessionCellFilter)
  }, [allSessionsForSubscriber, sessionCellFilter])

  const sessionsDisplay = useMemo(() => {
    if (view !== 'sessions' || showAllSessions) return sessions
    return sessions.filter((s) => sessionPassesStressTableFilter(s))
  }, [view, sessions, showAllSessions])

  useEffect(() => {
    setShowAllSessions(false)
  }, [selectedImsi, sessionCellFilter])

  const sessionDetailPaneSession = useMemo(() => {
    if (!sessionDetailPaneId) return null
    return sessionsDisplay.find((s) => s.id === sessionDetailPaneId) ?? null
  }, [sessionsDisplay, sessionDetailPaneId])

  useEffect(() => {
    if (sessionDetailPaneId && !sessionsDisplay.some((s) => s.id === sessionDetailPaneId)) {
      setSessionDetailPaneId(null)
    }
  }, [sessionsDisplay, sessionDetailPaneId])

  useEffect(() => {
    if (!sessionDetailPaneId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSessionDetailPaneId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sessionDetailPaneId])

  const cellFocusSessions = useMemo(() => {
    if (view !== 'subscribers' || !selectedCellId) return []
    return footprintSubscribers.flatMap((subscriber) =>
      getSessions(subscriber.imsi, subscriberGlobalFilters),
    )
  }, [view, selectedCellId, footprintSubscribers, subscriberGlobalFilters])

  const isSubscriberSessionView = view === 'sessions' && !!selectedImsi
  const isCellFocusView = view === 'subscribers' && !!selectedCellId

  const analyticsSessions = useMemo(() => {
    if (isSubscriberSessionView) return sessionsDisplay
    if (isCellFocusView) return cellFocusSessions
    return []
  }, [isSubscriberSessionView, isCellFocusView, sessionsDisplay, cellFocusSessions])

  const peerTrendByIndex = useMemo(() => {
    const bucketCount = analyticsSessions.length
    if (!isSubscriberSessionView || !selectedImsi || bucketCount === 0) {
      return new Map<number, { avg: number; min: number; max: number; count: number }>()
    }
    const peerRows = applyGlobalSubscriberFilters(
      SUBSCRIBERS.filter((subscriber) => subscriber.imsi !== selectedImsi),
      subscriberGlobalFilters,
    )
    const stats = Array.from({ length: bucketCount }, () => ({
      sum: 0,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
      count: 0,
    }))
    for (const peer of peerRows) {
      const peerSessions = getSessions(peer.imsi, subscriberGlobalFilters).filter((session) =>
        sessionCellFilter ? session.cellId === sessionCellFilter : true,
      )
      if (!peerSessions.length) continue
      const denominator = Math.max(peerSessions.length - 1, 1)
      peerSessions.forEach((session, index) => {
        const bucketIndex =
          bucketCount === 1 ? 0 : Math.round((index / denominator) * (bucketCount - 1))
        const bucket = stats[bucketIndex]
        bucket.sum += session.throughputMbps
        bucket.min = Math.min(bucket.min, session.throughputMbps)
        bucket.max = Math.max(bucket.max, session.throughputMbps)
        bucket.count += 1
      })
    }
    const rawAverages = stats.map((bucket) => (bucket.count > 0 ? bucket.sum / bucket.count : null))
    const result = new Map<number, { avg: number; min: number; max: number; count: number }>()
    stats.forEach((value, index) => {
      if (value.count === 0) return
      // Smooth peer trend so it reads as a contextual backdrop, not a per-point trace.
      let smoothedTotal = 0
      let smoothedCount = 0
      for (let offset = -1; offset <= 1; offset += 1) {
        const neighbor = rawAverages[index + offset]
        if (neighbor === null || neighbor === undefined) continue
        smoothedTotal += neighbor
        smoothedCount += 1
      }
      result.set(index, {
        avg: smoothedCount > 0 ? smoothedTotal / smoothedCount : value.sum / value.count,
        min: value.min,
        max: value.max,
        count: value.count,
      })
    })
    return result
  }, [
    analyticsSessions.length,
    isSubscriberSessionView,
    selectedImsi,
    sessionCellFilter,
    subscriberGlobalFilters,
  ])

  const trendData = useMemo<TrendDatum[]>(() => {
    if (isCellFocusView) {
      return bucketSessionsForTrend(analyticsSessions, CELL_FOCUS_TREND_BUCKETS).map((bucket) => ({
        i: bucket.i,
        tp: bucket.avgThroughput,
        id: null,
        cellId: null,
        cellName: null,
        peerBackdrop: null,
        peerAvg: null,
        peerLow: null,
        peerHigh: null,
        peerCount: 0,
        bucketSize: bucket.bucketSize,
        bucketCellCount: bucket.cellCount,
        p10: bucket.p10Throughput,
        p90: bucket.p90Throughput,
        low: bucket.lowThroughput,
        high: bucket.highThroughput,
        isAggregated: true,
      }))
    }
    return analyticsSessions.map((s, i) => {
      const peer = peerTrendByIndex.get(i)
      return {
        i,
        tp: s.throughputMbps,
        id: s.id,
        cellId: s.cellId,
        cellName: s.cellName,
        peerBackdrop: peer?.avg ?? null,
        peerAvg: peer?.avg ?? null,
        peerLow: peer?.min ?? null,
        peerHigh: peer?.max ?? null,
        peerCount: peer?.count ?? 0,
        bucketSize: 1,
        bucketCellCount: 1,
        p10: s.throughputMbps,
        p90: s.throughputMbps,
        low: s.throughputMbps,
        high: s.throughputMbps,
        isAggregated: false,
      }
    })
  }, [analyticsSessions, isCellFocusView, peerTrendByIndex])
  const scatterSourceSessions = useMemo(
    () =>
      isCellFocusView
        ? deterministicSample(analyticsSessions, CELL_FOCUS_SCATTER_MAX_POINTS)
        : analyticsSessions,
    [analyticsSessions, isCellFocusView],
  )
  const scatterData = useMemo(
    () => scatterSourceSessions.map((s) => ({ x: s.signalQuality, y: s.throughputMbps, id: s.id })),
    [scatterSourceSessions],
  )
  const analyticsSessionIdSet = useMemo(
    () => new Set(analyticsSessions.map((session) => session.id)),
    [analyticsSessions],
  )
  const visibleSelectedSessionIds = useMemo(
    () => selectedSessionIds.filter((id) => analyticsSessionIdSet.has(id)),
    [selectedSessionIds, analyticsSessionIdSet],
  )
  const selectedSessionIdSet = useMemo(
    () => new Set(visibleSelectedSessionIds),
    [visibleSelectedSessionIds],
  )
  const selectedTrendPoints = useMemo(
    () => (isCellFocusView ? [] : trendData.filter((d) => d.id && selectedSessionIdSet.has(d.id))),
    [isCellFocusView, trendData, selectedSessionIdSet],
  )
  const trendSessionBands = useMemo(
    () => {
      const palette = [
        'rgba(59, 130, 246, 0.18)',
        'rgba(16, 185, 129, 0.18)',
        'rgba(168, 85, 247, 0.18)',
        'rgba(245, 158, 11, 0.18)',
      ]
      return trendData.map((point, index) => ({
        x1: point.i - 0.5,
        x2: point.i + 0.5,
        fill: palette[index % palette.length],
      }))
    },
    [trendData],
  )
  const selectedScatterPoints = useMemo(
    () => (isCellFocusView ? [] : scatterData.filter((d) => selectedSessionIdSet.has(d.id))),
    [isCellFocusView, scatterData, selectedSessionIdSet],
  )

  const comparisonSourceSessions = useMemo(
    () =>
      isCellFocusView
        ? deterministicSample(analyticsSessions, CELL_FOCUS_COMPARISON_MAX_SESSIONS)
        : analyticsSessions,
    [analyticsSessions, isCellFocusView],
  )

  const comparisonDistributionData = useMemo(() => {
    if (!comparisonSourceSessions.length) return []
    const bins = kpiDistributionBins(selectedKpiId)
    const periodAValues = comparisonSourceSessions.map((session) =>
      sessionKpiValue(session, selectedKpiId),
    )
    const periodBValues = periodAValues.map((value) =>
      computePeriodBKpiValueByKpi(value, selectedKpiId, comparePeriodB, customRangeStart, customRangeEnd),
    )
    const periodAStats = distributionStats(periodAValues, bins)
    const periodBStats = distributionStats(periodBValues, bins)
    return bins.map((bin, idx) => ({
      binLabel: bin.label,
      periodAPct: periodAStats[idx].pct,
      periodBPct: periodBStats[idx].pct,
      periodACdfPct: periodAStats[idx].cdfPct,
      periodBCdfPct: periodBStats[idx].cdfPct,
      periodACount: periodAStats[idx].count,
      periodBCount: periodBStats[idx].count,
    }))
  }, [
    comparisonSourceSessions,
    selectedKpiId,
    comparePeriodB,
    customRangeStart,
    customRangeEnd,
  ])

  const comparisonPeriodALabel =
    timeRange === 'custom' && customTimeRangeStart && customTimeRangeEnd
      ? `${customTimeRangeStart} → ${customTimeRangeEnd}`
      : globalTimeRangeLabel(timeRange)

  const comparisonPeriodBWindowLabel = comparePeriodBLabel(
    comparePeriodB,
    customRangeStart,
    customRangeEnd,
  )

  function handleMapCellSelect(cellId: string) {
    if (view === 'sessions' && selectedImsi) {
      setSessionCellFilter(cellId)
      setSelectedSessionIds([])
      setSessionSelectionAnchorId(null)
      setSessionDetailPaneId(null)
      return
    }
    setSessionCellFilter(null)
    setSelectedCellId(cellId)
    setSelectedImsi(null)
    setView('subscribers')
  }

  function handleMapBackgroundClick() {
    if (view === 'sessions' && selectedImsi) {
      setSessionCellFilter(null)
      setSelectedSessionIds([])
      setSessionSelectionAnchorId(null)
      setSessionDetailPaneId(null)
    }
  }

  function selectCellFromTable(cellId: string) {
    setSelectedCellId(cellId)
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
    setSessionDetailPaneId(null)
    setView('subscribers')
  }

  function backToCells() {
    setView('cells')
    setSelectedCellId(null)
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
    setSessionDetailPaneId(null)
    setTableImsiSearch('')
  }

  function backToSubscribers() {
    setView('subscribers')
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
    setSessionDetailPaneId(null)
  }

  function openSubscriber(imsi: string) {
    setSelectedImsi(imsi)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
    setSessionDetailPaneId(null)
    setView('sessions')
  }

  function openSubscriberFromGlobal(imsi: string) {
    setSelectedCellId(null)
    setSelectedImsi(imsi)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
    setSessionDetailPaneId(null)
    setView('sessions')
  }

  function handleTabSelect(tabId: TableTab) {
    setActiveTab(tabId)
    setView('cells')
    setSelectedCellId(null)
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
    setExpandedSubscriberIds(new Set())
    setSessionDetailPaneId(null)
  }

  function selectSingleSession(sessionId: string) {
    setSelectedSessionIds([sessionId])
    setSessionSelectionAnchorId(sessionId)
    setSessionDetailPaneId(sessionId)
  }

  function selectSessionFromTable(sessionId: string, rowIndex: number, shiftKey: boolean) {
    if (!shiftKey) {
      selectSingleSession(sessionId)
      return
    }
    setSessionDetailPaneId(null)
    const clickedIsSelected = selectedSessionIdSet.has(sessionId)
    const anchorIndex = sessionSelectionAnchorId
      ? sessionsDisplay.findIndex((s) => s.id === sessionSelectionAnchorId)
      : -1
    if (anchorIndex < 0 || rowIndex < 0) {
      setSelectedSessionIds((prev) => {
        if (clickedIsSelected) return prev.filter((id) => id !== sessionId)
        return [...prev, sessionId]
      })
      setSessionSelectionAnchorId(sessionId)
      return
    }
    const [start, end] = anchorIndex < rowIndex ? [anchorIndex, rowIndex] : [rowIndex, anchorIndex]
    const rangeIds = sessionsDisplay.slice(start, end + 1).map((s) => s.id)
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (clickedIsSelected) {
        rangeIds.forEach((id) => next.delete(id))
      } else {
        rangeIds.forEach((id) => next.add(id))
      }
      return Array.from(next)
    })
    setSessionSelectionAnchorId(sessionId)
  }

  function toggleCellDetails(cellId: string) {
    setExpandedCellIds((prev) => {
      const next = new Set(prev)
      if (next.has(cellId)) next.delete(cellId)
      else next.add(cellId)
      return next
    })
  }

  function toggleSubscriberDetails(imsi: string) {
    setExpandedSubscriberIds((prev) => {
      const next = new Set(prev)
      if (next.has(imsi)) next.delete(imsi)
      else next.add(imsi)
      return next
    })
  }

  const mapMode =
    view === 'sessions' && selectedImsi
      ? 'subscriberFocus'
      : view === 'subscribers' && selectedCellId
        ? 'cellFocus'
        : 'all'
  const showAnalytics = isSubscriberSessionView || isCellFocusView
  const selectedKpiMeta = KPI_BY_ID[selectedKpiId]
  const showSessionInspector = Boolean(
    view === 'sessions' && selectedImsi && sessionDetailPaneSession && sessionDetailPaneId,
  )

  function snapshotGlobalFilters(): GlobalFilterSnapshot {
    return {
      timeRange,
      customTimeRangeStart,
      customTimeRangeEnd,
      service,
      networkMode,
      subscriberType,
      cellAttributes,
      selectedKpiId,
    }
  }

  function handleApplyPreset(id: string) {
    const preset = filterPresets.find((p) => p.id === id)
    if (!preset) return
    const { filters } = preset
    setTimeRange(filters.timeRange)
    setCustomTimeRangeStart(filters.customTimeRangeStart)
    setCustomTimeRangeEnd(filters.customTimeRangeEnd)
    setService(filters.service)
    setNetworkMode(filters.networkMode)
    setSubscriberType(filters.subscriberType)
    setCellAttributes(filters.cellAttributes)
  }

  function handleSavePreset(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const next: SavedFilterPreset = {
      id: newPresetId(),
      name: trimmed,
      savedAt: new Date().toISOString(),
      filters: snapshotGlobalFilters(),
    }
    setFilterPresets((prev) => [...prev, next])
  }

  function handleDeletePreset(id: string | null) {
    if (!id) return
    const preset = filterPresets.find((p) => p.id === id)
    if (
      preset &&
      typeof window !== 'undefined' &&
      !window.confirm(`Remove preset "${preset.name}"?`)
    ) {
      return
    }
    setFilterPresets((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="operator-app">
      <DashboardTopHeader />
      <GlobalFiltersBar
        timeRange={timeRange}
        onTimeRange={setTimeRange}
        customTimeRangeStart={customTimeRangeStart}
        onCustomTimeRangeStart={setCustomTimeRangeStart}
        customTimeRangeEnd={customTimeRangeEnd}
        onCustomTimeRangeEnd={setCustomTimeRangeEnd}
        service={service}
        onService={setService}
        subscriberType={subscriberType}
        onSubscriberType={setSubscriberType}
        networkMode={networkMode}
        onNetworkMode={setNetworkMode}
        cellAttributes={cellAttributes}
        onCellAttributes={setCellAttributes}
        selectedKpiId={selectedKpiId}
        onSelectedKpiId={setSelectedKpiId}
        presets={filterPresets}
        onApplyPreset={handleApplyPreset}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
      />

      <div className={`workspace${showSessionInspector ? ' workspace--session-inspector' : ''}`}>
        <section className="pane table-pane">
          <div className="table-stack">
            <label className="imsi-search">
              <span>Subscriber search</span>
              <input
                type="search"
                placeholder="Filter or find subscriber…"
                value={tableImsiSearch}
                onChange={(e) => setTableImsiSearch(e.target.value)}
              />
            </label>

            {view === 'cells' && tableImsiSearch.trim() && imsiQuickMatches.length > 0 && (
              <div className="quick-matches">
                <span className="quick-matches-label">Matching subscribers (open session view)</span>
                <ul>
                  {imsiQuickMatches.map((s) => (
                    <li key={s.imsi}>
                      <button type="button" onClick={() => openSubscriberFromGlobal(s.imsi)}>
                        {s.imsi}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!(view === 'sessions' && selectedImsi) && (
              <div className="tabs">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`tab ${activeTab === t.id ? 'active' : ''}`}
                    onClick={() => handleTabSelect(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {view === 'subscribers' && selectedCellId && (
              <TableNavBreadcrumb
                view="subscribers"
                selectedCellId={selectedCellId}
                selectedImsi={null}
                onToCells={backToCells}
                onToSubscribers={backToSubscribers}
              />
            )}
            {view === 'sessions' && selectedImsi && (
              <TableNavBreadcrumb
                view="sessions"
                selectedCellId={selectedCellId}
                selectedImsi={selectedImsi}
                onToCells={backToCells}
                onToSubscribers={backToSubscribers}
              />
            )}

            {view === 'cells' && (
              <>
                <div className="table-scroll">
                  {activeTab === 'failure' && (
                    <table className="minimal-table">
                      <thead>
                        <tr>
                          <th className="row-expand-col" aria-label="Expand row details" />
                          <th>Cell name</th>
                          <th>{selectedKpiMeta.label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const isExpanded = expandedCellIds.has(c.id)
                          return (
                            <Fragment key={c.id}>
                              <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
                                <td className="row-expand-col">
                                  <button
                                    type="button"
                                    className="row-expand-btn"
                                    aria-label={`${
                                      isExpanded ? 'Collapse' : 'Expand'
                                    } details for ${c.name}`}
                                    aria-expanded={isExpanded}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleCellDetails(c.id)
                                    }}
                                  >
                                    {isExpanded ? '▾' : '▸'}
                                  </button>
                                </td>
                                <td>{c.name}</td>
                                <td>{formatKpiValue(selectedKpiId, cellKpiValue(c, subscriberGlobalFilters, selectedKpiId))}</td>
                              </tr>
                              {isExpanded && (
                                <tr className="cell-details-row" key={`${c.id}-detail`}>
                                  <td colSpan={cellDetailColSpan('failure')}>
                                    <CellDetailsPanel cell={c} />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  {activeTab === 'callDrop' && (
                    <table className="minimal-table">
                      <thead>
                        <tr>
                          <th className="row-expand-col" aria-label="Expand row details" />
                          <th>Cell name</th>
                          <th>{selectedKpiMeta.label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const isExpanded = expandedCellIds.has(c.id)
                          return (
                            <Fragment key={c.id}>
                              <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
                                <td className="row-expand-col">
                                  <button
                                    type="button"
                                    className="row-expand-btn"
                                    aria-label={`${
                                      isExpanded ? 'Collapse' : 'Expand'
                                    } details for ${c.name}`}
                                    aria-expanded={isExpanded}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleCellDetails(c.id)
                                    }}
                                  >
                                    {isExpanded ? '▾' : '▸'}
                                  </button>
                                </td>
                                <td>{c.name}</td>
                                <td>{formatKpiValue(selectedKpiId, cellKpiValue(c, subscriberGlobalFilters, selectedKpiId))}</td>
                              </tr>
                              {isExpanded && (
                                <tr className="cell-details-row" key={`${c.id}-detail`}>
                                  <td colSpan={cellDetailColSpan('callDrop')}>
                                    <CellDetailsPanel cell={c} />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  {activeTab === 'payload' && (
                    <table className="minimal-table">
                      <thead>
                        <tr>
                          <th className="row-expand-col" aria-label="Expand row details" />
                          <th>Cell name</th>
                          <th>{selectedKpiMeta.label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const isExpanded = expandedCellIds.has(c.id)
                          return (
                            <Fragment key={c.id}>
                              <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
                                <td className="row-expand-col">
                                  <button
                                    type="button"
                                    className="row-expand-btn"
                                    aria-label={`${
                                      isExpanded ? 'Collapse' : 'Expand'
                                    } details for ${c.name}`}
                                    aria-expanded={isExpanded}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleCellDetails(c.id)
                                    }}
                                  >
                                    {isExpanded ? '▾' : '▸'}
                                  </button>
                                </td>
                                <td>{c.name}</td>
                                <td>{formatKpiValue(selectedKpiId, cellKpiValue(c, subscriberGlobalFilters, selectedKpiId))}</td>
                              </tr>
                              {isExpanded && (
                                <tr className="cell-details-row" key={`${c.id}-detail`}>
                                  <td colSpan={cellDetailColSpan('payload')}>
                                    <CellDetailsPanel cell={c} />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  {activeTab === 'handover' && (
                    <table className="minimal-table">
                      <thead>
                        <tr>
                          <th className="row-expand-col" aria-label="Expand row details" />
                          <th>Cell name</th>
                          <th>Total handovers</th>
                          <th>{selectedKpiMeta.label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const isExpanded = expandedCellIds.has(c.id)
                          return (
                            <Fragment key={c.id}>
                              <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
                                <td className="row-expand-col">
                                  <button
                                    type="button"
                                    className="row-expand-btn"
                                    aria-label={`${
                                      isExpanded ? 'Collapse' : 'Expand'
                                    } details for ${c.name}`}
                                    aria-expanded={isExpanded}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleCellDetails(c.id)
                                    }}
                                  >
                                    {isExpanded ? '▾' : '▸'}
                                  </button>
                                </td>
                                <td>{c.name}</td>
                                <td>{c.totalHandovers.toLocaleString()}</td>
                                <td>{formatKpiValue(selectedKpiId, cellKpiValue(c, subscriberGlobalFilters, selectedKpiId))}</td>
                              </tr>
                              {isExpanded && (
                                <tr className="cell-details-row" key={`${c.id}-detail`}>
                                  <td colSpan={cellDetailColSpan('handover')}>
                                    <CellDetailsPanel cell={c} />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {view === 'subscribers' && selectedCellId && (
              <>
                <div className="table-scroll">
                  <table className="minimal-table">
                    <thead>
                      <tr>
                        <th className="row-expand-col" aria-label="Expand row details" />
                        <th>Subscriber</th>
                        <th>Cell</th>
                        <th>Sessions</th>
                        <th>{selectedKpiMeta.label}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriberRows.map((s) => {
                        const isExpanded = expandedSubscriberIds.has(s.imsi)
                        return (
                          <Fragment key={s.imsi}>
                            <tr onClick={() => openSubscriber(s.imsi)}>
                              <td className="row-expand-col">
                                <button
                                  type="button"
                                  className="row-expand-btn"
                                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${s.imsi}`}
                                  aria-expanded={isExpanded}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleSubscriberDetails(s.imsi)
                                  }}
                                >
                                  {isExpanded ? '▾' : '▸'}
                                </button>
                              </td>
                              <td className="mono">{s.imsi}</td>
                              <td>{s.cellName}</td>
                              <td>{s.sessions}</td>
                              <td>{formatKpiValue(selectedKpiId, subscriberKpiValue(s, selectedKpiId))}</td>
                            </tr>
                            {isExpanded && (
                              <tr className="subscriber-details-row">
                                <td colSpan={5}>
                                  <SubscriberDetailsPanel subscriber={s} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {view === 'sessions' && selectedImsi && (
              <>
                {sessionDrillSubscriber ? (
                  <SubscriberSessionSummaryBar subscriber={sessionDrillSubscriber} />
                ) : null}
                <div className="session-table-toolbar">
                  <label className="session-table-toggle-all">
                    <input
                      type="checkbox"
                      checked={showAllSessions}
                      onChange={(e) => setShowAllSessions(e.target.checked)}
                    />
                    <span>Show all sessions</span>
                  </label>
                </div>
                {!showAllSessions && sessionsDisplay.length === 0 ? (
                  <p className="session-table-filter-empty">
                    No sessions in this scope have degraded or intermittent connectivity. Turn on Show all sessions to
                    list every session in scope.
                  </p>
                ) : null}
                <div className="table-scroll table-scroll--session-table">
                  <table className="minimal-table session-table">
                    <thead>
                      <tr>
                        <th>Session ID</th>
                        <th>Time</th>
                        <th>Connectivity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionsDisplay.map((s, i) => (
                        <tr
                          key={s.id}
                          className={
                            [
                              sessionCellFilter && s.cellId === sessionCellFilter
                                ? 'session-row--cell-focus'
                                : '',
                              selectedSessionIdSet.has(s.id) ? 'session-row--selected' : '',
                            ]
                              .filter(Boolean)
                              .join(' ') || undefined
                          }
                          onClick={(e) => selectSessionFromTable(s.id, i, e.shiftKey)}
                        >
                          <td className="mono">{s.id}</td>
                          <td className="mono session-time-cell">{formatSessionStartLocal(s.sessionStart)}</td>
                          <td className="session-connectivity-cell">
                            <span
                              className={`connectivity-chip ${connectivityChipClass(s.connectivity)}`}
                            >
                              {connectivityLabelSentenceCase(s.connectivity)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        {showSessionInspector && sessionDetailPaneSession ? (
          <section className="pane session-inspector-pane" aria-label="Session inspector">
            <SessionDetailSlideOver
              session={sessionDetailPaneSession}
              lensKpiId={selectedKpiId}
              onClose={() => setSessionDetailPaneId(null)}
            />
          </section>
        ) : null}

        <section
          className={`pane detail-pane${showAnalytics ? ' detail-pane--sessions' : ''}`}
        >
          <div className="detail-stack">
            <div className="detail-map-slot">
              <OperatorMap
                mode={mapMode}
                selectedCellId={selectedCellId}
                subscriberImsi={selectedImsi}
                selectedKpiId={selectedKpiId}
                sessions={sessionsDisplay}
                selectedSessionIds={visibleSelectedSessionIds}
                onSessionSelect={selectSingleSession}
                sessionTableCellFilter={sessionCellFilter}
                showHoverKpis={view === 'sessions'}
                embed={showAnalytics ? 'compact' : 'full'}
                subscriberGlobalFilters={subscriberGlobalFilters}
                onCellSelect={handleMapCellSelect}
                onMapBackgroundClick={handleMapBackgroundClick}
              />
            </div>

            {showAnalytics && (
              <div className="session-analytics-scroll">
                <div className="charts-block">
                  <h3 className="block-title">
                    {isCellFocusView ? 'Cell footprint charts' : 'Session charts'}
                  </h3>
                  <div className="chart-grid">
                    <figure className="chart-fig">
                      <figcaption>Throughput trend</figcaption>
                      <ResponsiveContainer
                        width="100%"
                        height={220}
                        initialDimension={{ width: 360, height: 220 }}
                      >
                        <ComposedChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          {trendSessionBands.map((band) => (
                            <ReferenceArea
                              key={`${band.x1}-${band.x2}`}
                              x1={band.x1}
                              x2={band.x2}
                              fill={band.fill}
                              strokeOpacity={0}
                            />
                          ))}
                          <XAxis
                            type="number"
                            dataKey="i"
                            tick={{ fontSize: 11, fill: '#cbd5e1' }}
                            axisLine={{ stroke: '#475569' }}
                            tickFormatter={(value) => `${Number(value) + 1}`}
                            domain={[-0.5, Math.max(trendData.length - 0.5, 0.5)]}
                            allowDecimals={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#cbd5e1' }}
                            axisLine={{ stroke: '#475569' }}
                            unit=" Mbps"
                            domain={[0, 'auto']}
                          />
                          <Tooltip
                            cursor={{ stroke: '#475569', strokeDasharray: '4 3' }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null
                              const d = payload[0].payload as (typeof trendData)[number]
                              if (d.isAggregated) {
                                return (
                                  <div className="chart-tooltip">
                                    <div className="chart-tooltip-title">Bucket {d.i + 1}</div>
                                    <div className="chart-tooltip-sub">
                                      {d.bucketSize} sessions across {d.bucketCellCount} cells
                                    </div>
                                    <div className="chart-tooltip-kpi">
                                      Avg throughput: <strong>{d.tp.toFixed(1)} Mbps</strong>
                                    </div>
                                    <div className="chart-tooltip-kpi">
                                      P10-P90: {d.p10.toFixed(1)}-{d.p90.toFixed(1)} Mbps
                                    </div>
                                  </div>
                                )
                              }
                              return (
                                <div className="chart-tooltip">
                                  <div className="chart-tooltip-title">Session {d.i + 1}</div>
                                  <div className="chart-tooltip-sub">
                                    {d.id} · {d.cellName} ({d.cellId})
                                  </div>
                                  <div className="chart-tooltip-kpi">
                                    {isCellFocusView ? 'Cell footprint' : 'Selected subscriber'}:{' '}
                                    <strong>{d.tp.toFixed(1)} Mbps</strong>
                                  </div>
                                  {!isCellFocusView &&
                                  d.peerAvg !== null &&
                                  d.peerLow !== null &&
                                  d.peerHigh !== null ? (
                                    <div className="chart-tooltip-kpi">
                                      Peers ({d.peerCount}): {d.peerAvg.toFixed(1)} avg ·{' '}
                                      {d.peerLow.toFixed(1)}-{d.peerHigh.toFixed(1)} Mbps
                                    </div>
                                  ) : !isCellFocusView ? (
                                    <div className="chart-tooltip-kpi">Peers: no data</div>
                                  ) : null}
                                </div>
                              )
                            }}
                          />
                          {!isCellFocusView && (
                            <>
                              <Area
                                type="monotone"
                                dataKey="peerBackdrop"
                                stroke="none"
                                fill="#93c5fd"
                                fillOpacity={0.22}
                                isAnimationActive={false}
                                connectNulls
                              />
                              <Line
                                type="monotone"
                                dataKey="peerAvg"
                                stroke="#93c5fd"
                                strokeWidth={1.5}
                                dot={false}
                                strokeDasharray="4 4"
                                strokeOpacity={0.75}
                                isAnimationActive={false}
                                connectNulls
                              />
                            </>
                          )}
                          {selectedTrendPoints.map((point) => (
                            <Fragment key={point.id}>
                              <ReferenceArea
                                x1={point.i - 0.5}
                                x2={point.i + 0.5}
                                fill="rgba(245, 158, 11, 0.12)"
                                strokeOpacity={0}
                              />
                              <ReferenceLine x={point.i} stroke="#f59e0b" strokeDasharray="4 3" />
                              <ReferenceDot
                                x={point.i}
                                y={point.tp}
                                r={5}
                                fill="#f59e0b"
                                stroke="#0f172a"
                                strokeWidth={1.4}
                              />
                            </Fragment>
                          ))}
                          <Line
                            type="monotone"
                            dataKey="tp"
                            stroke="#60a5fa"
                            dot={false}
                            strokeWidth={2.4}
                            isAnimationActive={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </figure>
                    <figure className="chart-fig">
                      <figcaption>Signal vs throughput</figcaption>
                      <ResponsiveContainer
                        width="100%"
                        height={220}
                        initialDimension={{ width: 360, height: 220 }}
                      >
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis
                            dataKey="x"
                            name="Signal"
                            type="number"
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            dataKey="y"
                            name="Throughput"
                            type="number"
                            unit=" Mbps"
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                          <Scatter data={scatterData} fill="#2dd4bf" />
                          {selectedScatterPoints.length > 0 && (
                            <Scatter data={selectedScatterPoints} fill="#f59e0b" />
                          )}
                        </ScatterChart>
                      </ResponsiveContainer>
                    </figure>
                  </div>
                </div>

                <div className="compare-block">
                  <h3 className="block-title">Time period comparison</h3>
                  <div className="compare-controls">
                    <label className="compare-select-label">
                      <span>Period B (compare to)</span>
                      <select
                        value={comparePeriodB}
                        onChange={(e) =>
                          setComparePeriodB(e.target.value as ComparePeriodOption)
                        }
                      >
                        <option value="15m">Last 15 minutes</option>
                        <option value="1h">Last 1 hour</option>
                        <option value="24h">Last 24 hours</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="custom">Custom — date range</option>
                      </select>
                    </label>
                    {comparePeriodB === 'custom' && (
                      <div className="custom-range-row">
                        <label>
                          <span>Start</span>
                          <input
                            type="date"
                            value={customRangeStart}
                            onChange={(e) => setCustomRangeStart(e.target.value)}
                          />
                        </label>
                        <label>
                          <span>End</span>
                          <input
                            type="date"
                            value={customRangeEnd}
                            onChange={(e) => setCustomRangeEnd(e.target.value)}
                          />
                        </label>
                      </div>
                    )}
                    <label className="compare-toggle">
                      <input
                        type="checkbox"
                        checked={showComparisonCdf}
                        onChange={(e) => setShowComparisonCdf(e.target.checked)}
                      />
                      <span>Show CDF overlay</span>
                    </label>
                  </div>
                  <figure className="chart-fig compare-chart-fig">
                    <div className="compare-chart-header">
                      <figcaption>{selectedKpiMeta.label}</figcaption>
                      <div className="compare-top-legend" aria-label="Comparison chart legend">
                        <span className="compare-legend-item">
                          <span
                            className="compare-legend-marker compare-legend-marker--period-a"
                            aria-hidden="true"
                          />
                          <span className="compare-legend-text">
                            <strong>Period A</strong> {comparisonPeriodALabel}
                          </span>
                        </span>
                        <span className="compare-legend-item">
                          <span
                            className="compare-legend-marker compare-legend-marker--period-b"
                            aria-hidden="true"
                          />
                          <span className="compare-legend-text">
                            <strong>Period B</strong> {comparisonPeriodBWindowLabel}
                          </span>
                        </span>
                        {showComparisonCdf && (
                          <>
                            <span className="compare-legend-item">
                              <span
                                className="compare-legend-marker compare-legend-marker--cdf-a"
                                aria-hidden="true"
                              />
                              <span className="compare-legend-text">
                                <strong>CDF A</strong>
                              </span>
                            </span>
                            <span className="compare-legend-item">
                              <span
                                className="compare-legend-marker compare-legend-marker--cdf-b"
                                aria-hidden="true"
                              />
                              <span className="compare-legend-text">
                                <strong>CDF B</strong>
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {comparisonDistributionData.length > 0 ? (
                      <ResponsiveContainer
                        width="100%"
                        height={300}
                        initialDimension={{ width: 360, height: 300 }}
                      >
                        <ComposedChart
                          data={comparisonDistributionData}
                          margin={{ top: 12, right: 20, left: 8, bottom: 74 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis
                            dataKey="binLabel"
                            tick={{ fontSize: 12, fill: '#cbd5e1' }}
                            axisLine={{ stroke: '#475569' }}
                            angle={-24}
                            textAnchor="end"
                            interval={0}
                            height={80}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 11, fill: '#cbd5e1' }}
                            tickFormatter={(value) => `${value}%`}
                            axisLine={{ stroke: '#475569' }}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(96, 165, 250, 0.15)' }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null
                              const d = payload[0].payload as (typeof comparisonDistributionData)[number]
                              return (
                                <div className="chart-tooltip">
                                  <div className="chart-tooltip-title">{d.binLabel}</div>
                                  <div className="chart-tooltip-sub">{selectedKpiMeta.label}</div>
                                  <div className="chart-tooltip-kpi">
                                    <strong>Period A</strong> ({comparisonPeriodALabel}): {d.periodACount}{' '}
                                    sessions ({d.periodAPct.toFixed(1)}%)
                                  </div>
                                  <div className="chart-tooltip-kpi">
                                    <strong>Period B</strong> ({comparisonPeriodBWindowLabel}):{' '}
                                    {d.periodBCount} sessions ({d.periodBPct.toFixed(1)}%)
                                  </div>
                                  {showComparisonCdf && (
                                    <div className="chart-tooltip-kpi">
                                      CDF A/B: {d.periodACdfPct.toFixed(1)}% /{' '}
                                      {d.periodBCdfPct.toFixed(1)}%
                                    </div>
                                  )}
                                </div>
                              )
                            }}
                          />
                          <Bar
                            dataKey="periodAPct"
                            name="Period A %"
                            fill="#60a5fa"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={26}
                          />
                          <Bar
                            dataKey="periodBPct"
                            name="Period B %"
                            fill="#94a3b8"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={26}
                          />
                          {showComparisonCdf && (
                            <>
                              <Line
                                type="monotone"
                                dataKey="periodACdfPct"
                                name="Period A CDF"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="periodBCdfPct"
                                name="Period B CDF"
                                stroke="#22d3ee"
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="4 3"
                              />
                            </>
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="muted small">No session data for comparison.</p>
                    )}
                  </figure>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
