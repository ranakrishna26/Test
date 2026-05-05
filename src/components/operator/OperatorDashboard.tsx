import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
  { id: 'failure', label: 'Failure type' },
  { id: 'callDrop', label: 'Call drop' },
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

  const [activeTab, setActiveTab] = useState<TableTab>('failure')
  const [view, setView] = useState<View>('cells')
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
  const [selectedImsi, setSelectedImsi] = useState<string | null>(null)
  /** STATE 3: filter session table to one cell (map click); cleared on background click or navigation. */
  const [sessionCellFilter, setSessionCellFilter] = useState<string | null>(null)
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
    () => sessions.map((s, i) => ({ i, tp: s.throughputMbps })),
    [sessions],
  )
  const scatterData = useMemo(
    () => sessions.map((s) => ({ x: s.signalQuality, y: s.throughputMbps, id: s.id })),
    [sessions],
  )
  const heatmap = useMemo(() => heatmapData(sessions), [sessions])

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
      return
    }
    setSessionCellFilter(null)
    setSelectedCellId(cellId)
    setSelectedImsi(null)
    setView('subscribers')
  }

  function handleMapBackgroundClick() {
    if (view === 'sessions' && selectedImsi) setSessionCellFilter(null)
  }

  function selectCellFromTable(cellId: string) {
    setSelectedCellId(cellId)
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setView('subscribers')
  }

  function backToCells() {
    setView('cells')
    setSelectedCellId(null)
    setSelectedImsi(null)
    setSessionCellFilter(null)
    setTableImsiSearch('')
  }

  function backToSubscribers() {
    setView('subscribers')
    setSelectedImsi(null)
    setSessionCellFilter(null)
  }

  function openSubscriber(imsi: string) {
    setSelectedImsi(imsi)
    setSessionCellFilter(null)
    setView('sessions')
  }

  function openSubscriberFromGlobal(imsi: string) {
    setSelectedCellId(null)
    setSelectedImsi(imsi)
    setSessionCellFilter(null)
    setView('sessions')
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
        cellAttributes={cellAttributes}
        onCellAttributes={setCellAttributes}
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
                          <th>Cell name</th>
                          <th>Cell ID</th>
                          <th>With issue / in cohort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const m = cellTableFailureMetrics(c, subscriberGlobalFilters)
                          return (
                            <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
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
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  {activeTab === 'callDrop' && (
                    <table className="minimal-table">
                      <thead>
                        <tr>
                          <th>Cell name</th>
                          <th>Cell ID</th>
                          <th>With issue / in cohort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const m = cellTableCallDropMetrics(c, subscriberGlobalFilters)
                          return (
                            <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
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
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  {activeTab === 'payload' && (
                    <table className="minimal-table">
                      <thead>
                        <tr>
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
                          return (
                            <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
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
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  {activeTab === 'handover' && (
                    <table className="minimal-table">
                      <thead>
                        <tr>
                          <th>Cell name</th>
                          <th>Cell ID</th>
                          <th>Total handovers</th>
                          <th>With issue / in cohort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanked.map((c) => {
                          const m = cellTableHoPctMetrics(c, subscriberGlobalFilters)
                          return (
                            <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
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
                        <th>Packet metrics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr
                          key={s.id}
                          className={
                            sessionCellFilter && s.cellId === sessionCellFilter
                              ? 'session-row--cell-focus'
                              : undefined
                          }
                        >
                          <td className="mono">{s.id}</td>
                          <td className="muted">
                            {s.cellName} <span className="mono">({s.cellId})</span>
                          </td>
                          <td>{s.signalQuality.toFixed(2)}</td>
                          <td>{s.throughputMbps} Mbps</td>
                          <td>{s.connectivity}</td>
                          <td>{s.packetLossPct.toFixed(2)}% loss</td>
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
                  <div className="chart-grid">
                    <figure className="chart-fig">
                      <figcaption>Trend · throughput by session order</figcaption>
                      <ResponsiveContainer
                        width="100%"
                        height={220}
                        initialDimension={{ width: 360, height: 220 }}
                      >
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
                          <XAxis dataKey="i" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} unit=" Mbps" />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="tp"
                            stroke="#2563eb"
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
                          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
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
                          <Scatter data={scatterData} fill="#0d9488" />
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
                            className="heatmap-cell"
                            title={cell.label}
                            style={{
                              opacity: 0.35 + (cell.v / 3) * 0.65,
                              background: `hsl(220, 45%, ${100 - cell.v * 18}%)`,
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
                          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fill: '#374151' }}
                            axisLine={{ stroke: '#e5e7eb' }}
                          />
                          <YAxis tick={{ fontSize: 11 }} axisLine={{ stroke: '#e5e7eb' }} />
                          <Tooltip
                            cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }}
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
                              <Cell key={i} fill={i === 0 ? '#2563eb' : '#64748b'} />
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
