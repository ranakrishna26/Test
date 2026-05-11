import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  aggregateKpiFromSessions,
  applyGlobalSubscriberFilters,
  cellById,
  cellTableCallDropMetrics,
  cellTableFailureMetrics,
  cellTableHoPctMetrics,
  cellTablePayloadDlMetrics,
  cellTablePayloadUlMetrics,
  comparePeriodBLabel,
  comparisonKpiFromTab,
  computePeriodBKpiValue,
  getSessions,
  globalTimeRangeLabel,
  headlineMetric,
  rankedCells,
  sortSubscribersByTab,
  subscribersForFootprint,
  tabHeadlineLabel,
  type ComparePeriodOption,
  type Cell as NetworkCell,
  type Subscriber as NetworkSubscriber,
  type SubscriberGlobalFilters,
  type TableTab,
} from '../../data/placeholderNetwork'
import { GlobalFiltersBar } from './GlobalFiltersBar'
import { OperatorMap } from './OperatorMap'
import {
  loadFilterPresets,
  newPresetId,
  persistFilterPresets,
  type GlobalFilterSnapshot,
  type SavedFilterPreset,
} from '../../utils/filterPresets'

type View = 'cells' | 'subscribers' | 'sessions'

const TABS: { id: TableTab; label: string }[] = [
  { id: 'callDrop', label: 'Call drop' },
  { id: 'failure', label: 'Failure type' },
  { id: 'payload', label: 'Payload' },
  { id: 'handover', label: 'Handover' },
]

function matchImsi(q: string, imsi: string): boolean {
  const n = q.replace(/\s/g, '').toLowerCase()
  if (!n) return true
  return imsi.replace(/\s/g, '').toLowerCase().includes(n)
}

/** Filtered footprint cohort: with issue / cohort size; 0/0 when filters exclude everyone; em dash when no anchored subs. */
function CellFootprintRatio({
  affected,
  total,
  fromAnchors,
  noMatchTooltip,
  ranTooltip,
  issueDescriptor = 'this issue',
}: {
  affected: number
  total: number
  fromAnchors: boolean
  noMatchTooltip: string
  ranTooltip: string
  /** Phrase used in tooltip, e.g. "setup/access failures" or "call drops". */
  issueDescriptor?: string
}) {
  if (fromAnchors) {
    const cohortTooltip =
      total === 0
        ? noMatchTooltip
        : `Subscribers with ${issueDescriptor} / in cohort (after global filters): ${affected} subscriber${
            affected === 1 ? '' : 's'
          } with ${issueDescriptor}, ${total} in the footprint cohort.`
    return (
      <span className="metric-with-impact" title={cohortTooltip}>
        <span className="metric-with-impact__primary">
          {affected}/{total}
        </span>
        <span className="muted"> subs</span>
      </span>
    )
  }
  return (
    <span className="metric-with-impact" title={ranTooltip}>
      <span className="muted">—</span>
    </span>
  )
}

function cellTableFootprintHint(tab: TableTab): string {
  switch (tab) {
    case 'failure':
      return 'Same filtered footprint as the subscriber list (this cell and neighbours; global filters on the bar). With issue / cohort counts subscribers with any setup/access failure; denominator is cohort size. Subscriber search only filters the subscriber table.'
    case 'callDrop':
      return 'Same filtered footprint as the subscriber list (this cell and neighbours; global filters on the bar). With issue / cohort counts subscribers with any call drop; denominator is cohort size. Subscriber search only filters the subscriber table.'
    case 'payload':
      return 'Columns match the subscriber drill-down footprint (this cell and neighbours; global filters). DL and UL columns compare each subscriber to a fraction of the cell RAN throughput. Subscriber search only filters the subscriber table.'
    case 'handover':
      return 'Columns match the subscriber drill-down footprint (this cell and neighbours; global filters). With issue / in cohort reflects subscribers under the HO success threshold for that cell. Subscriber search only filters the subscriber table.'
    default:
      return ''
  }
}

function heatmapData(sessions: ReturnType<typeof getSessions>) {
  const rows = 6
  const cols = 8
  const cells: { x: number; y: number; v: number; label: string }[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (x + y * cols) % Math.max(sessions.length, 1)
      const v = sessions[i]?.packetLossPct ?? 0.5
      cells.push({ x, y, v, label: `${v.toFixed(2)}% loss` })
    }
  }
  return { rows, cols, cells }
}

function cellDetailColSpan(tab: TableTab): number {
  return tab === 'payload' || tab === 'handover' ? 5 : 4
}

function CellDetailsPanel({ cell }: { cell: NetworkCell }) {
  return (
    <div className="cell-details-grid" role="group" aria-label={`Details for ${cell.name}`}>
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
        <strong>Time horizon</strong>: {subscriber.timeHorizon}
      </span>
      <span>
        <strong>Anchor cell</strong>: {subscriber.cellName} ({subscriber.cellId})
      </span>
      <span>
        <strong>Neighbor cells</strong>: {anchor?.neighborIds.length ?? 0}
      </span>
      <span>
        <strong>Sessions</strong>: {subscriber.sessions}
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

  return (
    <nav className="table-breadcrumb" aria-label="Drill-down navigation">
      <ol className="table-breadcrumb-list">
        <li className="table-breadcrumb-item">
          <button type="button" className="table-breadcrumb-link" onClick={onToCells}>
            Cells
          </button>
        </li>
        {view === 'subscribers' && selectedCellId && (
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
        {view === 'sessions' && (
          <>
            {selectedCellId ? (
              <>
                <li className="table-breadcrumb-sep" aria-hidden="true">
                  /
                </li>
                <li className="table-breadcrumb-item">
                  <button type="button" className="table-breadcrumb-link" onClick={onToSubscribers}>
                    {cellLabel}
                  </button>
                </li>
              </>
            ) : null}
            <li className="table-breadcrumb-sep" aria-hidden="true">
              /
            </li>
            <li className="table-breadcrumb-item">
              <span className="table-breadcrumb-current mono" aria-current="page">
                {selectedImsi}
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  )
}

export function OperatorDashboard() {
  const [timeRange, setTimeRange] = useState('24h')
  const [customTimeRangeStart, setCustomTimeRangeStart] = useState('')
  const [customTimeRangeEnd, setCustomTimeRangeEnd] = useState('')
  const [technology, setTechnology] = useState('all')
  const [service, setService] = useState('all')
  const [networkMode, setNetworkMode] = useState<'all' | 'sa' | 'nsa'>('all')
  const [subscriberType, setSubscriberType] = useState('all')
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
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [sessionSelectionAnchorId, setSessionSelectionAnchorId] = useState<string | null>(null)
  const [expandedCellIds, setExpandedCellIds] = useState<Set<string>>(() => new Set())
  const [expandedSubscriberIds, setExpandedSubscriberIds] = useState<Set<string>>(() => new Set())
  const [tableImsiSearch, setTableImsiSearch] = useState('')

  const [comparePeriodB, setComparePeriodB] = useState<ComparePeriodOption>('7d')
  const [customRangeStart, setCustomRangeStart] = useState('')
  const [customRangeEnd, setCustomRangeEnd] = useState('')

  const subscriberGlobalFilters: SubscriberGlobalFilters = useMemo(
    () => ({
      timeRange,
      customTimeRangeStart,
      customTimeRangeEnd,
      technology,
      service,
      networkMode,
      subscriberType,
    }),
    [
      timeRange,
      customTimeRangeStart,
      customTimeRangeEnd,
      technology,
      service,
      networkMode,
      subscriberType,
    ],
  )

  const ranked = useMemo(
    () => rankedCells(activeTab, subscriberGlobalFilters),
    [activeTab, subscriberGlobalFilters],
  )

  const visibleRanked = useMemo(() => {
    const q = cellAttributes.trim().toLowerCase()
    if (!q) return ranked
    return ranked.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    )
  }, [ranked, cellAttributes])

  const subscriberRows = useMemo(() => {
    if (!selectedCellId) return []
    const base = subscribersForFootprint(selectedCellId)
    let rows = applyGlobalSubscriberFilters(base, subscriberGlobalFilters)
    if (tableImsiSearch.trim())
      rows = rows.filter((s) => matchImsi(tableImsiSearch, s.imsi))
    return sortSubscribersByTab(rows, activeTab)
  }, [selectedCellId, activeTab, tableImsiSearch, subscriberGlobalFilters])

  const imsiQuickMatches = useMemo(() => {
    const q = tableImsiSearch.trim()
    if (!q) return []
    return SUBSCRIBERS.filter((s) => matchImsi(q, s.imsi)).slice(0, 8)
  }, [tableImsiSearch])

  const allSessionsForSubscriber = useMemo(
    () => (selectedImsi ? getSessions(selectedImsi) : []),
    [selectedImsi],
  )

  const sessions = useMemo(() => {
    if (!sessionCellFilter) return allSessionsForSubscriber
    return allSessionsForSubscriber.filter((s) => s.cellId === sessionCellFilter)
  }, [allSessionsForSubscriber, sessionCellFilter])

  const peerTrendByIndex = useMemo(() => {
    const bucketCount = sessions.length
    if (!selectedImsi || bucketCount === 0) {
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
      const peerSessions = getSessions(peer.imsi).filter((session) =>
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
  }, [selectedImsi, sessionCellFilter, sessions.length, subscriberGlobalFilters])

  const trendData = useMemo(
    () =>
      sessions.map((s, i) => {
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
        }
      }),
    [sessions, peerTrendByIndex],
  )
  const scatterData = useMemo(
    () => sessions.map((s) => ({ x: s.signalQuality, y: s.throughputMbps, id: s.id })),
    [sessions],
  )
  const heatmap = useMemo(() => heatmapData(sessions), [sessions])
  const selectedSessionIdSet = useMemo(() => new Set(selectedSessionIds), [selectedSessionIds])
  const selectedSessions = useMemo(
    () => sessions.filter((s) => selectedSessionIdSet.has(s.id)),
    [sessions, selectedSessionIdSet],
  )
  const selectedTrendPoints = useMemo(
    () => trendData.filter((d) => selectedSessionIdSet.has(d.id)),
    [trendData, selectedSessionIdSet],
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
    () => scatterData.filter((d) => selectedSessionIdSet.has(d.id)),
    [scatterData, selectedSessionIdSet],
  )
  const selectedHeatmapIndexes = useMemo(() => {
    if (!selectedSessionIds.length || !heatmap.cells.length) return new Set<number>()
    const indexes = new Set<number>()
    sessions.forEach((s, idx) => {
      if (selectedSessionIdSet.has(s.id)) indexes.add(idx % heatmap.cells.length)
    })
    return indexes
  }, [sessions, selectedSessionIds.length, selectedSessionIdSet, heatmap.cells.length])

  useEffect(() => {
    const validIds = new Set(sessions.map((s) => s.id))
    setSelectedSessionIds((prev) => prev.filter((id) => validIds.has(id)))
    setSessionSelectionAnchorId((prev) => (prev && validIds.has(prev) ? prev : null))
  }, [sessions])

  const comparisonBarData = useMemo(() => {
    if (!sessions.length) return []
    const meta = comparisonKpiFromTab(activeTab)
    const valueA = aggregateKpiFromSessions(sessions, activeTab)
    const valueB = computePeriodBKpiValue(
      valueA,
      activeTab,
      comparePeriodB,
      customRangeStart,
      customRangeEnd,
    )
    return [
      {
        key: 'A',
        name: 'Period A',
        periodLabel:
          timeRange === 'custom' && customTimeRangeStart && customTimeRangeEnd
            ? `${customTimeRangeStart} → ${customTimeRangeEnd}`
            : globalTimeRangeLabel(timeRange),
        value: valueA,
        meta,
      },
      {
        key: 'B',
        name: 'Period B',
        periodLabel: comparePeriodBLabel(
          comparePeriodB,
          customRangeStart,
          customRangeEnd,
        ),
        value: valueB,
        meta,
      },
    ]
  }, [
    sessions,
    activeTab,
    timeRange,
    customTimeRangeStart,
    customTimeRangeEnd,
    comparePeriodB,
    customRangeStart,
    customRangeEnd,
  ])

  function handleMapCellSelect(cellId: string) {
    if (view === 'sessions' && selectedImsi) {
      setSessionCellFilter(cellId)
      setSelectedSessionIds([])
      setSessionSelectionAnchorId(null)
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
    }
  }

  function selectCellFromTable(cellId: string) {
    setSelectedCellId(cellId)
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
    setView('subscribers')
  }

  function backToCells() {
    setView('cells')
    setSelectedCellId(null)
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
    setTableImsiSearch('')
  }

  function backToSubscribers() {
    setView('subscribers')
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
  }

  function openSubscriber(imsi: string) {
    setSelectedImsi(imsi)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
    setView('sessions')
  }

  function openSubscriberFromGlobal(imsi: string) {
    setSelectedCellId(null)
    setSelectedImsi(imsi)
    setSessionCellFilter(null)
    setSelectedSessionIds([])
    setSessionSelectionAnchorId(null)
    setView('sessions')
  }

  function selectSingleSession(sessionId: string) {
    setSelectedSessionIds([sessionId])
    setSessionSelectionAnchorId(sessionId)
  }

  function selectSessionFromTable(sessionId: string, rowIndex: number, shiftKey: boolean) {
    if (!shiftKey) {
      // Plain click follows standard single-select behavior.
      setSelectedSessionIds([sessionId])
      setSessionSelectionAnchorId(sessionId)
      return
    }
    const clickedIsSelected = selectedSessionIdSet.has(sessionId)
    const anchorIndex = sessionSelectionAnchorId
      ? sessions.findIndex((s) => s.id === sessionSelectionAnchorId)
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
    const rangeIds = sessions.slice(start, end + 1).map((s) => s.id)
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

  function snapshotGlobalFilters(): GlobalFilterSnapshot {
    return {
      timeRange,
      customTimeRangeStart,
      customTimeRangeEnd,
      technology,
      service,
      networkMode,
      subscriberType,
      cellAttributes,
    }
  }

  function handleApplyPreset(id: string | null) {
    if (!id) return
    const preset = filterPresets.find((p) => p.id === id)
    if (!preset) return
    const { filters } = preset
    setTimeRange(filters.timeRange)
    setCustomTimeRangeStart(filters.customTimeRangeStart)
    setCustomTimeRangeEnd(filters.customTimeRangeEnd)
    setTechnology(filters.technology)
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
      <GlobalFiltersBar
        timeRange={timeRange}
        onTimeRange={setTimeRange}
        customTimeRangeStart={customTimeRangeStart}
        onCustomTimeRangeStart={setCustomTimeRangeStart}
        customTimeRangeEnd={customTimeRangeEnd}
        onCustomTimeRangeEnd={setCustomTimeRangeEnd}
        technology={technology}
        onTechnology={setTechnology}
        service={service}
        onService={setService}
        subscriberType={subscriberType}
        onSubscriberType={setSubscriberType}
        networkMode={networkMode}
        onNetworkMode={setNetworkMode}
        presets={filterPresets}
        onApplyPreset={handleApplyPreset}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
      />

      <div className="workspace">
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

            {view === 'cells' && (
              <>
                <div className="tabs">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`tab ${activeTab === t.id ? 'active' : ''}`}
                      onClick={() => setActiveTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="context-line table-footprint-hint">{cellTableFootprintHint(activeTab)}</p>
                <div className="table-scroll">
                  {activeTab === 'failure' && (
                    <table className="minimal-table">
                      <thead>
                        <tr>
                          <th className="row-expand-col" aria-label="Expand row details" />
                          <th>Cell name</th>
                          <th>Cell ID</th>
                          <th>With issue / in cohort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const m = cellTableFailureMetrics(c, subscriberGlobalFilters)
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
                                <td className="muted">{c.id}</td>
                                <td>
                                  <CellFootprintRatio
                                    affected={m.affected}
                                    total={m.total}
                                    fromAnchors={m.fromAnchors}
                                    noMatchTooltip="No subscribers match current global filters in this footprint."
                                    ranTooltip={`No subscribers in this footprint for drill-down. RAN: ${c.setupAccessFailures} failures`}
                                    issueDescriptor="setup/access failures"
                                  />
                                </td>
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
                          <th>Cell ID</th>
                          <th>With issue / in cohort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const m = cellTableCallDropMetrics(c, subscriberGlobalFilters)
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
                                <td className="muted">{c.id}</td>
                                <td>
                                  <CellFootprintRatio
                                    affected={m.affected}
                                    total={m.total}
                                    fromAnchors={m.fromAnchors}
                                    noMatchTooltip="No subscribers match current global filters in this footprint."
                                    ranTooltip={`No subscribers in this footprint for drill-down. RAN: ${c.callDrops} drops`}
                                    issueDescriptor="call drops"
                                  />
                                </td>
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
                          <th>Cell ID</th>
                          <th>DL: with issue / in cohort</th>
                          <th>UL: with issue / in cohort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const dl = cellTablePayloadDlMetrics(c, subscriberGlobalFilters)
                          const ul = cellTablePayloadUlMetrics(c, subscriberGlobalFilters)
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
                                <td className="muted">{c.id}</td>
                                <td>
                                  <CellFootprintRatio
                                    affected={dl.affected}
                                    total={dl.total}
                                    fromAnchors={dl.fromAnchors}
                                    noMatchTooltip="No subscribers match current global filters in this footprint."
                                    ranTooltip={`No subscribers in this footprint for drill-down. RAN DL: ${c.dlMbps} Mbps`}
                                  />
                                </td>
                                <td>
                                  <CellFootprintRatio
                                    affected={ul.affected}
                                    total={ul.total}
                                    fromAnchors={ul.fromAnchors}
                                    noMatchTooltip="No subscribers match current global filters in this footprint."
                                    ranTooltip={`No subscribers in this footprint for drill-down. RAN UL: ${c.ulMbps} Mbps`}
                                  />
                                </td>
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
                          <th>Cell ID</th>
                          <th>Total handovers</th>
                          <th>With issue / in cohort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const m = cellTableHoPctMetrics(c, subscriberGlobalFilters)
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
                                <td className="muted">{c.id}</td>
                                <td>{c.totalHandovers.toLocaleString()}</td>
                                <td>
                                  <CellFootprintRatio
                                    affected={m.affected}
                                    total={m.total}
                                    fromAnchors={m.fromAnchors}
                                    noMatchTooltip="No subscribers match current global filters in this footprint."
                                    ranTooltip={`No subscribers in this footprint for drill-down. RAN HO: ${c.hoSuccessPct.toFixed(1)}%`}
                                  />
                                </td>
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
                <p className="context-line">
                  Footprint subscribers (this cell and neighbours), worst first —{' '}
                  {tabHeadlineLabel(activeTab)}. Use the map to switch cell; scope matches the
                  footprint.
                </p>
                <div className="table-scroll">
                  <table className="minimal-table">
                    <thead>
                      <tr>
                        <th className="row-expand-col" aria-label="Expand row details" />
                        <th>Subscriber</th>
                        <th>Cell</th>
                        <th>Sessions</th>
                        <th>{tabHeadlineLabel(activeTab)}</th>
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
                              <td>{headlineMetric(s, activeTab)}</td>
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
                <p className="context-line">
                  Session list and charts for the subscriber above. Map cell click filters rows;
                  empty map clears the filter.
                </p>
                {sessionCellFilter && (
                  <p className="session-cell-filter-banner" role="status">
                    Showing sessions on{' '}
                    <strong>{cellById(sessionCellFilter)?.name ?? sessionCellFilter}</strong> (
                    {sessionCellFilter}). Click empty map area to show all sessions.
                  </p>
                )}
                <div className="table-scroll">
                  <table className="minimal-table session-table">
                    <thead>
                      <tr>
                        <th>Session ID</th>
                        <th>Cell</th>
                        <th>Signal quality</th>
                        <th>Throughput</th>
                        <th>Connectivity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s, i) => (
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
                          <td className="muted">
                            {s.cellName} <span className="mono">({s.cellId})</span>
                          </td>
                          <td>{s.signalQuality.toFixed(2)}</td>
                          <td>{s.throughputMbps} Mbps</td>
                          <td>{s.connectivity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        <section
          className={`pane detail-pane${view === 'sessions' ? ' detail-pane--sessions' : ''}`}
        >
          <div className="detail-stack">
            <div className="detail-map-slot">
              <OperatorMap
                mode={mapMode}
                selectedCellId={selectedCellId}
                subscriberImsi={selectedImsi}
                activeTab={activeTab}
                sessions={sessions}
                selectedSessionIds={selectedSessionIds}
                onSessionSelect={selectSingleSession}
                sessionTableCellFilter={sessionCellFilter}
                showHoverKpis={view === 'sessions'}
                embed={view === 'sessions' ? 'compact' : 'full'}
                subscriberGlobalFilters={subscriberGlobalFilters}
                onCellSelect={handleMapCellSelect}
                onMapBackgroundClick={handleMapBackgroundClick}
              />
            </div>

            {view === 'sessions' && selectedImsi && (
              <div className="session-analytics-scroll">
                <div className="charts-block">
                  <h3 className="block-title">Session charts</h3>
                  {selectedSessions.length === 1 ? (
                    <p className="session-selection-chip" role="status">
                      Selected session: <strong>{selectedSessions[0].id}</strong> on{' '}
                      {selectedSessions[0].cellName} ({selectedSessions[0].cellId}) - signal{' '}
                      {selectedSessions[0].signalQuality.toFixed(2)}, throughput{' '}
                      {selectedSessions[0].throughputMbps} Mbps
                    </p>
                  ) : selectedSessions.length > 1 ? (
                    <p className="session-selection-chip" role="status">
                      Selected sessions: <strong>{selectedSessions.length}</strong> across{' '}
                      <strong>{new Set(selectedSessions.map((s) => s.cellId)).size}</strong> cells -
                      avg signal{' '}
                      {(
                        selectedSessions.reduce((sum, s) => sum + s.signalQuality, 0) /
                        selectedSessions.length
                      ).toFixed(2)}
                      , avg throughput{' '}
                      {(
                        selectedSessions.reduce((sum, s) => sum + s.throughputMbps, 0) /
                        selectedSessions.length
                      ).toFixed(1)}{' '}
                      Mbps
                    </p>
                  ) : (
                    <p className="session-selection-chip" role="status">
                      Select a session row or map pixel to highlight it across charts.
                    </p>
                  )}
                  <div className="chart-grid">
                    <figure className="chart-fig">
                      <figcaption>Trend · throughput by session order</figcaption>
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
                              return (
                                <div className="chart-tooltip">
                                  <div className="chart-tooltip-title">Session {d.i + 1}</div>
                                  <div className="chart-tooltip-sub">
                                    {d.id} · {d.cellName} ({d.cellId})
                                  </div>
                                  <div className="chart-tooltip-kpi">
                                    Selected subscriber: <strong>{d.tp.toFixed(1)} Mbps</strong>
                                  </div>
                                  {d.peerAvg !== null && d.peerLow !== null && d.peerHigh !== null ? (
                                    <div className="chart-tooltip-kpi">
                                      Peers ({d.peerCount}): {d.peerAvg.toFixed(1)} avg ·{' '}
                                      {d.peerLow.toFixed(1)}-{d.peerHigh.toFixed(1)} Mbps
                                    </div>
                                  ) : (
                                    <div className="chart-tooltip-kpi">Peers: no data</div>
                                  )}
                                </div>
                              )
                            }}
                          />
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
                      <figcaption>Scatter · signal vs throughput</figcaption>
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
                    <figure className="chart-fig heatmap-fig">
                      <figcaption>Heatmap · packet loss (placeholder grid)</figcaption>
                      <div
                        className="heatmap-grid"
                        style={{
                          gridTemplateColumns: `repeat(${heatmap.cols}, 1fr)`,
                        }}
                      >
                        {heatmap.cells.map((cell, idx) => (
                          <div
                            key={idx}
                            className={`heatmap-cell ${
                              selectedHeatmapIndexes.has(idx) ? 'heatmap-cell--selected' : ''
                            }`}
                            title={cell.label}
                            style={{
                              opacity: 0.32 + (cell.v / 3) * 0.5,
                              background: `hsl(220, 55%, ${38 - cell.v * 8}%)`,
                            }}
                          />
                        ))}
                      </div>
                    </figure>
                  </div>
                </div>

                <div className="compare-block">
                  <h3 className="block-title">Time period comparison</h3>
                  <p className="compare-hint">
                    <strong>Period A</strong> uses the global time range. <strong>Period B</strong> is
                    the comparison window. KPI matches the cell table tab you used (
                    {comparisonKpiFromTab(activeTab).label}).
                  </p>
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
                  </div>
                  <figure className="chart-fig compare-chart-fig">
                    <figcaption>
                      {comparisonKpiFromTab(activeTab).label}: Period A vs Period B
                    </figcaption>
                    {comparisonBarData.length > 0 ? (
                      <ResponsiveContainer
                        width="100%"
                        height={300}
                        initialDimension={{ width: 360, height: 300 }}
                      >
                        <BarChart
                          data={comparisonBarData}
                          margin={{ top: 12, right: 16, left: 8, bottom: 56 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fill: '#cbd5e1' }}
                            axisLine={{ stroke: '#475569' }}
                          />
                          <YAxis tick={{ fontSize: 11, fill: '#cbd5e1' }} axisLine={{ stroke: '#475569' }} />
                          <Tooltip
                            cursor={{ fill: 'rgba(96, 165, 250, 0.15)' }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null
                              const d = payload[0].payload as (typeof comparisonBarData)[0]
                              return (
                                <div className="chart-tooltip">
                                  <div className="chart-tooltip-title">{d.name}</div>
                                  <div className="chart-tooltip-sub">{d.periodLabel}</div>
                                  <div className="chart-tooltip-kpi">
                                    {d.meta.label}: <strong>{d.meta.format(d.value)}</strong>
                                  </div>
                                </div>
                              )
                            }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={72}>
                            {comparisonBarData.map((_, i) => (
                              <Cell key={i} fill={i === 0 ? '#60a5fa' : '#94a3b8'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="muted small">No session data for comparison.</p>
                    )}
                    <div className="compare-x-labels">
                      {comparisonBarData.map((d) => (
                        <div key={d.key} className="compare-x-label">
                          <span className="compare-x-name">{d.name}</span>
                          <span className="compare-x-period">{d.periodLabel}</span>
                        </div>
                      ))}
                    </div>
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
