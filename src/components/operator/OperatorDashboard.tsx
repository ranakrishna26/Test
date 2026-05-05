import { type ReactNode, useEffect, useMemo, useState } from 'react'
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

function CellMetricWithImpact({
  primary,
  affected,
  total,
  showRatio,
}: {
  primary: ReactNode
  affected: number
  total: number
  showRatio: boolean
}) {
  return (
    <span className="metric-with-impact">
      <span className="metric-with-impact__primary">{primary}</span>
      {showRatio && total > 0 && (
        <span className="metric-with-impact__context">
          {' '}
          {affected}/{total}
        </span>
      )}
    </span>
  )
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
  const [tableImsiSearch, setTableImsiSearch] = useState('')

  const [comparePeriodB, setComparePeriodB] = useState<ComparePeriodOption>('7d')
  const [customRangeStart, setCustomRangeStart] = useState('')
  const [customRangeEnd, setCustomRangeEnd] = useState('')

  const ranked = useMemo(() => rankedCells(activeTab), [activeTab])

  const subscriberRows = useMemo(() => {
    if (!selectedCellId) return []
    let rows = subscribersForFootprint(selectedCellId)
    if (tableImsiSearch.trim())
      rows = rows.filter((s) => matchImsi(tableImsiSearch, s.imsi))
    return sortSubscribersByTab(rows, activeTab)
  }, [selectedCellId, activeTab, tableImsiSearch])

  const imsiQuickMatches = useMemo(() => {
    const q = tableImsiSearch.trim()
    if (!q) return []
    return SUBSCRIBERS.filter((s) => matchImsi(q, s.imsi)).slice(0, 8)
  }, [tableImsiSearch])

  const sessions = useMemo(
    () => (selectedImsi ? getSessions(selectedImsi) : []),
    [selectedImsi],
  )

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

  function selectCellFromTable(cellId: string) {
    setSelectedCellId(cellId)
    setSelectedImsi(null)
    setView('subscribers')
  }

  function selectCellFromMap(cellId: string) {
    if (view !== 'cells') return
    selectCellFromTable(cellId)
  }

  function backToCells() {
    setView('cells')
    setSelectedCellId(null)
    setSelectedImsi(null)
    setTableImsiSearch('')
  }

  function backToSubscribers() {
    setView('subscribers')
    setSelectedImsi(null)
  }

  function backFromSessions() {
    if (selectedCellId) backToSubscribers()
    else backToCells()
  }

  function openSubscriber(imsi: string) {
    setSelectedImsi(imsi)
    setView('sessions')
  }

  function openSubscriberFromGlobal(imsi: string) {
    setSelectedCellId(null)
    setSelectedImsi(imsi)
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
                <div className="table-scroll">
                  {activeTab === 'failure' && (
                    <table className="minimal-table">
                      <thead>
                        <tr>
                          <th>Cell name</th>
                          <th>Cell ID</th>
                          <th>Setup / access failures</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked.map((c) => {
                          const m = cellTableFailureMetrics(c)
                          return (
                            <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
                              <td>{c.name}</td>
                              <td className="muted">{c.id}</td>
                              <td>
                                <CellMetricWithImpact
                                  primary={`${m.value} ${m.value === 1 ? 'failure' : 'failures'}`}
                                  affected={m.affected}
                                  total={m.total}
                                  showRatio={m.fromAnchors}
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
                          <th>Call drops</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked.map((c) => {
                          const m = cellTableCallDropMetrics(c)
                          return (
                            <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
                              <td>{c.name}</td>
                              <td className="muted">{c.id}</td>
                              <td>
                                <CellMetricWithImpact
                                  primary={`${m.value} ${m.value === 1 ? 'drop' : 'drops'}`}
                                  affected={m.affected}
                                  total={m.total}
                                  showRatio={m.fromAnchors}
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
                          <th>DL throughput</th>
                          <th>UL throughput</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked.map((c) => {
                          const dl = cellTablePayloadDlMetrics(c)
                          const ul = cellTablePayloadUlMetrics(c)
                          const dlMbps =
                            Number.isInteger(dl.value) || dl.value % 1 === 0
                              ? String(dl.value)
                              : dl.value.toFixed(1)
                          const ulMbps =
                            Number.isInteger(ul.value) || ul.value % 1 === 0
                              ? String(ul.value)
                              : ul.value.toFixed(1)
                          return (
                            <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
                              <td>{c.name}</td>
                              <td className="muted">{c.id}</td>
                              <td>
                                <CellMetricWithImpact
                                  primary={`${dlMbps} Mbps`}
                                  affected={dl.affected}
                                  total={dl.total}
                                  showRatio={dl.fromAnchors}
                                />
                              </td>
                              <td>
                                <CellMetricWithImpact
                                  primary={`${ulMbps} Mbps`}
                                  affected={ul.affected}
                                  total={ul.total}
                                  showRatio={ul.fromAnchors}
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
                          <th>HO success %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked.map((c) => {
                          const m = cellTableHoPctMetrics(c)
                          return (
                            <tr key={c.id} onClick={() => selectCellFromTable(c.id)}>
                              <td>{c.name}</td>
                              <td className="muted">{c.id}</td>
                              <td>{c.totalHandovers.toLocaleString()}</td>
                              <td>
                                <CellMetricWithImpact
                                  primary={`${m.value.toFixed(1)}%`}
                                  affected={m.affected}
                                  total={m.total}
                                  showRatio={m.fromAnchors}
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
                <button type="button" className="back-link" onClick={backToCells}>
                  ← Back to cell tables
                </button>
                <p className="context-line">
                  Subscribers on selected cell and neighbours · sorted worst first (
                  {tabHeadlineLabel(activeTab)})
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
                <button type="button" className="back-link" onClick={backFromSessions}>
                  ←{' '}
                  {selectedCellId ? 'Back to subscriber list' : 'Back to cell tables'}
                </button>
                <p className="context-line mono">Subscriber {selectedImsi}</p>
                <div className="table-scroll">
                  <table className="minimal-table session-table">
                    <thead>
                      <tr>
                        <th>Session ID</th>
                        <th>Signal quality</th>
                        <th>Throughput</th>
                        <th>Connectivity</th>
                        <th>Packet metrics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id}>
                          <td className="mono">{s.id}</td>
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
                showHoverKpis={view === 'sessions'}
                embed={view === 'sessions' ? 'compact' : 'full'}
                onCellSelect={selectCellFromMap}
              />
            </div>

            {view === 'sessions' && selectedImsi && (
              <div className="session-analytics-scroll">
                <div className="charts-block">
                  <h3 className="block-title">Session charts</h3>
                  <div className="chart-grid">
                    <figure className="chart-fig">
                      <figcaption>Trend · throughput by session order</figcaption>
                      <ResponsiveContainer width="100%" height={220}>
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
                      <ResponsiveContainer width="100%" height={220}>
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
                      <ResponsiveContainer width="100%" height={300}>
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
