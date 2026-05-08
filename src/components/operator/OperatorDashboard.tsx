import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceDot,
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
      return 'Same filtered footprint as the subscriber list (this cell and neighbours; global filters on the bar). With issue / cohort counts subscribers with any setup/access failure; denominator is cohort size. IMSI search only filters the subscriber table.'
    case 'callDrop':
      return 'Same filtered footprint as the subscriber list (this cell and neighbours; global filters on the bar). With issue / cohort counts subscribers with any call drop; denominator is cohort size. IMSI search only filters the subscriber table.'
    case 'payload':
      return 'Columns match the subscriber drill-down footprint (this cell and neighbours; global filters). DL and UL columns compare each subscriber to a fraction of the cell RAN throughput. IMSI search only filters the subscriber table.'
    case 'handover':
      return 'Columns match the subscriber drill-down footprint (this cell and neighbours; global filters). With issue / in cohort reflects subscribers under the HO success threshold for that cell. IMSI search only filters the subscriber table.'
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
  const [subscriberType, setSubscriberType] = useState('all')
  const [deviceType, setDeviceType] = useState('all')
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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [expandedCellIds, setExpandedCellIds] = useState<Set<string>>(() => new Set())
  const [tableImsiSearch, setTableImsiSearch] = useState('')

  const [comparePeriodB, setComparePeriodB] = useState<ComparePeriodOption>('7d')
  const [customRangeStart, setCustomRangeStart] = useState('')
  const [customRangeEnd, setCustomRangeEnd] = useState('')

  const subscriberGlobalFilters: SubscriberGlobalFilters = useMemo(
    () => ({
      timeRange,
      subscriberType,
      deviceType,
    }),
    [timeRange, subscriberType, deviceType],
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

  const trendData = useMemo(
    () => sessions.map((s, i) => ({ i, tp: s.throughputMbps, id: s.id })),
    [sessions],
  )
  const scatterData = useMemo(
    () => sessions.map((s) => ({ x: s.signalQuality, y: s.throughputMbps, id: s.id })),
    [sessions],
  )
  const heatmap = useMemo(() => heatmapData(sessions), [sessions])
  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  )
  const selectedTrendPoint = useMemo(
    () => trendData.find((d) => d.id === selectedSessionId) ?? null,
    [trendData, selectedSessionId],
  )
  const selectedScatterPoint = useMemo(
    () => scatterData.find((d) => d.id === selectedSessionId) ?? null,
    [scatterData, selectedSessionId],
  )
  const selectedHeatmapIndex = useMemo(() => {
    if (!selectedSessionId || !heatmap.cells.length) return -1
    const idx = sessions.findIndex((s) => s.id === selectedSessionId)
    if (idx < 0) return -1
    return idx % heatmap.cells.length
  }, [sessions, selectedSessionId, heatmap.cells.length])

  useEffect(() => {
    if (selectedSessionId && !sessions.some((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(null)
    }
  }, [sessions, selectedSessionId])

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
        periodLabel: globalTimeRangeLabel(timeRange),
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
    comparePeriodB,
    customRangeStart,
    customRangeEnd,
  ])

  function handleMapCellSelect(cellId: string) {
    if (view === 'sessions' && selectedImsi) {
      setSessionCellFilter(cellId)
      setSelectedSessionId(null)
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
      setSelectedSessionId(null)
    }
  }

  function selectCellFromTable(cellId: string) {
    setSelectedCellId(cellId)
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setSelectedSessionId(null)
    setView('subscribers')
  }

  function backToCells() {
    setView('cells')
    setSelectedCellId(null)
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setSelectedSessionId(null)
    setTableImsiSearch('')
  }

  function backToSubscribers() {
    setView('subscribers')
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setSelectedSessionId(null)
  }

  function openSubscriber(imsi: string) {
    setSelectedImsi(imsi)
    setSessionCellFilter(null)
    setSelectedSessionId(null)
    setView('sessions')
  }

  function openSubscriberFromGlobal(imsi: string) {
    setSelectedCellId(null)
    setSelectedImsi(imsi)
    setSessionCellFilter(null)
    setSelectedSessionId(null)
    setView('sessions')
  }

  function toggleSessionSelection(sessionId: string) {
    setSelectedSessionId((prev) => (prev === sessionId ? null : sessionId))
  }

  function toggleCellDetails(cellId: string) {
    setExpandedCellIds((prev) => {
      const next = new Set(prev)
      if (next.has(cellId)) next.delete(cellId)
      else next.add(cellId)
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
      subscriberType,
      deviceType,
      cellAttributes,
    }
  }

  function handleApplyPreset(id: string) {
    const preset = filterPresets.find((p) => p.id === id)
    if (!preset) return
    const { filters } = preset
    setTimeRange(filters.timeRange)
    setSubscriberType(filters.subscriberType)
    setDeviceType(filters.deviceType)
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

  function handleDeletePreset(id: string) {
    setFilterPresets((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="operator-app">
      <GlobalFiltersBar
        timeRange={timeRange}
        onTimeRange={setTimeRange}
        subscriberType={subscriberType}
        onSubscriberType={setSubscriberType}
        deviceType={deviceType}
        onDeviceType={setDeviceType}
        presets={filterPresets}
        onApplyPreset={handleApplyPreset}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
      />

      <div className="workspace">
        <section className="pane table-pane">
          <div className="table-stack">
            <label className="imsi-search">
              <span>IMSI search</span>
              <input
                type="search"
                placeholder="Filter or find IMSI…"
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
                        <th>IMSI</th>
                        <th>Cell</th>
                        <th>Sessions</th>
                        <th>{tabHeadlineLabel(activeTab)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriberRows.map((s) => (
                        <tr key={s.imsi} onClick={() => openSubscriber(s.imsi)}>
                          <td className="mono">{s.imsi}</td>
                          <td>{s.cellName}</td>
                          <td>{s.sessions}</td>
                          <td>{headlineMetric(s, activeTab)}</td>
                        </tr>
                      ))}
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
                      {sessions.map((s) => (
                        <tr
                          key={s.id}
                          className={
                            [
                              sessionCellFilter && s.cellId === sessionCellFilter
                                ? 'session-row--cell-focus'
                                : '',
                              selectedSessionId === s.id ? 'session-row--selected' : '',
                            ]
                              .filter(Boolean)
                              .join(' ') || undefined
                          }
                          onClick={() => toggleSessionSelection(s.id)}
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
                selectedSessionId={selectedSessionId}
                onSessionSelect={toggleSessionSelection}
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
                  {selectedSession ? (
                    <p className="session-selection-chip" role="status">
                      Selected session: <strong>{selectedSession.id}</strong> on{' '}
                      {selectedSession.cellName} ({selectedSession.cellId}) - signal{' '}
                      {selectedSession.signalQuality.toFixed(2)}, throughput{' '}
                      {selectedSession.throughputMbps} Mbps
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
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="i" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} unit=" Mbps" />
                          <Tooltip />
                          {selectedTrendPoint && (
                            <>
                              <ReferenceLine
                                x={selectedTrendPoint.i}
                                stroke="#f59e0b"
                                strokeDasharray="4 3"
                              />
                              <ReferenceDot
                                x={selectedTrendPoint.i}
                                y={selectedTrendPoint.tp}
                                r={5}
                                fill="#f59e0b"
                                stroke="#0f172a"
                                strokeWidth={1.4}
                              />
                            </>
                          )}
                          <Line
                            type="monotone"
                            dataKey="tp"
                            stroke="#60a5fa"
                            dot={false}
                            strokeWidth={2}
                          />
                        </LineChart>
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
                          {selectedScatterPoint && (
                            <Scatter data={[selectedScatterPoint]} fill="#f59e0b" />
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
                              idx === selectedHeatmapIndex ? 'heatmap-cell--selected' : ''
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
