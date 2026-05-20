import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_GLOBAL_FILTER_SNAPSHOT,
  type SavedFilterPreset,
} from '../../utils/filterPresets'
import { groupedKpiDefinitions, type KpiId } from '../../data/kpis'

type Props = {
  timeRange: string
  onTimeRange: (v: string) => void
  customTimeRangeStart: string
  onCustomTimeRangeStart: (v: string) => void
  customTimeRangeEnd: string
  onCustomTimeRangeEnd: (v: string) => void
  service: string
  onService: (v: string) => void
  subscriberType: string
  onSubscriberType: (v: string) => void
  networkMode: 'all' | 'sa' | 'nsa'
  onNetworkMode: (v: 'all' | 'sa' | 'nsa') => void
  cellAttributes: string
  onCellAttributes: (v: string) => void
  selectedKpiId: KpiId
  onSelectedKpiId: (v: KpiId) => void
  presets: SavedFilterPreset[]
  onApplyPreset: (id: string) => void
  onSavePreset: (name: string) => void
  onDeletePreset: (id: string | null) => void
}

type SecondaryFilterKey = 'cellAttributes'

const SECONDARY_FILTERS: { key: SecondaryFilterKey; label: string }[] = [
  { key: 'cellAttributes', label: 'Cell attributes' },
]

export function GlobalFiltersBar({
  timeRange,
  onTimeRange,
  customTimeRangeStart,
  onCustomTimeRangeStart,
  customTimeRangeEnd,
  onCustomTimeRangeEnd,
  service,
  onService,
  subscriberType,
  onSubscriberType,
  networkMode,
  onNetworkMode,
  cellAttributes,
  onCellAttributes,
  selectedKpiId,
  onSelectedKpiId,
  presets,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
}: Props) {
  const [presetSelection, setPresetSelection] = useState('')
  const [secondaryFilterMenuOpen, setSecondaryFilterMenuOpen] = useState(false)
  const [presetMenuOpen, setPresetMenuOpen] = useState(false)
  const [showSecondaryFilters, setShowSecondaryFilters] = useState<Record<SecondaryFilterKey, boolean>>({
    cellAttributes: false,
  })
  const secondaryMenuRef = useRef<HTMLDivElement | null>(null)
  const presetMenuRef = useRef<HTMLDivElement | null>(null)
  const kpiGroups = groupedKpiDefinitions()
  const defaultKpiId = DEFAULT_GLOBAL_FILTER_SNAPSHOT.selectedKpiId
  const saActive = networkMode !== 'nsa'
  const nsaActive = networkMode !== 'sa'
  const subscriberSelectionCount = subscriberType === 'all' ? 0 : 1
  const serviceSelectionCount = service === 'all' ? 0 : 1
  const isCustomKpi = selectedKpiId !== defaultKpiId
  const enabledSecondaryFilterCount = useMemo(
    () => SECONDARY_FILTERS.filter((item) => showSecondaryFilters[item.key]).length,
    [showSecondaryFilters],
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null
      if (secondaryMenuRef.current && target && !secondaryMenuRef.current.contains(target)) {
        setSecondaryFilterMenuOpen(false)
      }
      if (presetMenuRef.current && target && !presetMenuRef.current.contains(target)) {
        setPresetMenuOpen(false)
      }
    }

    if (!secondaryFilterMenuOpen && !presetMenuOpen) return
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [secondaryFilterMenuOpen, presetMenuOpen])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setSecondaryFilterMenuOpen(false)
      setPresetMenuOpen(false)
    }

    if (!secondaryFilterMenuOpen && !presetMenuOpen) return
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [secondaryFilterMenuOpen, presetMenuOpen])

  useEffect(() => {
    if (cellAttributes.trim()) {
      setShowSecondaryFilters((prev) =>
        prev.cellAttributes ? prev : { ...prev, cellAttributes: true },
      )
    }
  }, [cellAttributes])

  function toggleSaMode() {
    if (saActive && nsaActive) {
      onNetworkMode('nsa')
      return
    }
    if (!saActive && nsaActive) {
      onNetworkMode('all')
      return
    }
    onNetworkMode('sa')
  }

  function toggleNsaMode() {
    if (saActive && nsaActive) {
      onNetworkMode('sa')
      return
    }
    if (saActive && !nsaActive) {
      onNetworkMode('all')
      return
    }
    onNetworkMode('nsa')
  }

  function resetAllFilters() {
    onTimeRange(DEFAULT_GLOBAL_FILTER_SNAPSHOT.timeRange)
    onCustomTimeRangeStart(DEFAULT_GLOBAL_FILTER_SNAPSHOT.customTimeRangeStart)
    onCustomTimeRangeEnd(DEFAULT_GLOBAL_FILTER_SNAPSHOT.customTimeRangeEnd)
    onService(DEFAULT_GLOBAL_FILTER_SNAPSHOT.service)
    onSubscriberType(DEFAULT_GLOBAL_FILTER_SNAPSHOT.subscriberType)
    onNetworkMode(DEFAULT_GLOBAL_FILTER_SNAPSHOT.networkMode)
    onSelectedKpiId(DEFAULT_GLOBAL_FILTER_SNAPSHOT.selectedKpiId)
    onCellAttributes(DEFAULT_GLOBAL_FILTER_SNAPSHOT.cellAttributes)
    setShowSecondaryFilters({ cellAttributes: false })
    setSecondaryFilterMenuOpen(false)
    setPresetMenuOpen(false)
  }

  function savePresetFromIcon() {
    const draft = window.prompt('Preset name (optional):', '')?.trim() ?? ''
    const fallbackName = `Preset ${new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`
    onSavePreset(draft || fallbackName)
  }

  return (
    <header className="filters-bar">
      <div className="filters-top-row">
        <div className="filters-primary">
          <div className="mode-toggle-group" role="group" aria-label="5G mode">
            <div className="mode-toggle-buttons">
              <button
                type="button"
                className={`mode-toggle-btn ${saActive ? 'is-selected' : ''}`}
                onClick={toggleSaMode}
                aria-pressed={saActive}
                title="Filter for 5G SA subscribers"
              >
                5G SA
              </button>
              <button
                type="button"
                className={`mode-toggle-btn ${nsaActive ? 'is-selected' : ''}`}
                onClick={toggleNsaMode}
                aria-pressed={nsaActive}
                title="Filter for 5G NSA subscribers"
              >
                5G NSA
              </button>
            </div>
          </div>
          <div className="filters-chip-actions">
            <div className="filters-primary-action-row">
              <div className="filters-chip-row filters-chip-row-primary" aria-label="Primary global filter chips">
                <label className="filter-chip">
                  <span>Subscriber type</span>
                  <div className="filter-chip-control">
                    <select value={subscriberType} onChange={(e) => onSubscriberType(e.target.value)}>
                      <option value="all">All</option>
                      <option value="consumer">Consumer</option>
                      <option value="enterprise">Enterprise</option>
                      <option value="iot">IoT</option>
                      <option value="vip">VIP</option>
                    </select>
                    {subscriberSelectionCount > 0 && (
                      <span className="filter-chip-badge" aria-label="Selected subscriber type count">
                        {subscriberSelectionCount}
                      </span>
                    )}
                    {subscriberType !== 'all' && (
                      <button
                        type="button"
                        className="filter-chip-clear"
                        aria-label="Clear subscriber type filter"
                        onClick={() => onSubscriberType('all')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </label>
                <label className="filter-chip filter-chip-kpi">
                  <span>KPI</span>
                  <div className="filter-chip-control">
                    <select
                      value={selectedKpiId}
                      onChange={(e) => onSelectedKpiId(e.target.value as KpiId)}
                      aria-label="Global KPI filter"
                    >
                      {kpiGroups.map((group) => (
                        <optgroup key={group.category} label={group.category}>
                          {group.kpis.map((kpi) => (
                            <option key={kpi.id} value={kpi.id}>
                              {kpi.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {isCustomKpi && (
                      <button
                        type="button"
                        className="filter-chip-clear"
                        aria-label="Reset KPI to default"
                        onClick={() => onSelectedKpiId(defaultKpiId)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </label>
                <label className="filter-chip">
                  <span>Service type</span>
                  <div className="filter-chip-control">
                    <select value={service} onChange={(e) => onService(e.target.value)}>
                      <option value="all">All</option>
                      <option value="data">Data</option>
                      <option value="voice">Voice</option>
                      <option value="messaging">Messaging</option>
                      <option value="iot">IoT</option>
                    </select>
                    {serviceSelectionCount > 0 && (
                      <span className="filter-chip-badge" aria-label="Selected service type count">
                        {serviceSelectionCount}
                      </span>
                    )}
                    {service !== 'all' && (
                      <button
                        type="button"
                        className="filter-chip-clear"
                        aria-label="Clear service type filter"
                        onClick={() => onService('all')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </label>
              </div>
              <div className="filters-icon-cluster" role="group" aria-label="Global filter actions">
                <div className="filters-icon-menu-wrap" ref={secondaryMenuRef}>
                  <button
                    type="button"
                    className={`preset-icon-btn ${secondaryFilterMenuOpen ? 'preset-icon-btn-open' : ''}`}
                    title="Show or hide secondary filters"
                    aria-label="Show or hide secondary filters"
                    aria-haspopup="menu"
                    aria-expanded={secondaryFilterMenuOpen}
                    onClick={() => {
                      setSecondaryFilterMenuOpen((prev) => !prev)
                      setPresetMenuOpen(false)
                    }}
                  >
                    <span aria-hidden="true" className="preset-icon-glyph">
                      ⊕
                    </span>
                    {enabledSecondaryFilterCount > 0 && (
                      <span className="filter-chip-badge filters-icon-badge">
                        {enabledSecondaryFilterCount}
                      </span>
                    )}
                  </button>
                  {secondaryFilterMenuOpen && (
                    <div
                      className="filters-dropdown-menu filters-dropdown-menu-secondary"
                      role="menu"
                      aria-label="Secondary filters"
                    >
                      {SECONDARY_FILTERS.map((item) => (
                        <label key={item.key} className="filters-dropdown-check">
                          <input
                            type="checkbox"
                            checked={showSecondaryFilters[item.key]}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setShowSecondaryFilters((prev) => ({
                                ...prev,
                                [item.key]: checked,
                              }))
                              if (!checked && item.key === 'cellAttributes') onCellAttributes('')
                            }}
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="preset-icon-btn preset-icon-btn-danger"
                  title="Reset all filters"
                  aria-label="Reset all filters"
                  onClick={resetAllFilters}
                >
                  <span aria-hidden="true" className="preset-icon-glyph">
                    🗑
                  </span>
                </button>
                <button
                  type="button"
                  className="preset-icon-btn"
                  title="Save current filters as preset"
                  aria-label="Save current filters as preset"
                  onClick={savePresetFromIcon}
                >
                  <span aria-hidden="true" className="preset-icon-glyph">
                    ★
                  </span>
                </button>
                <div className="filters-icon-menu-wrap" ref={presetMenuRef}>
                  <button
                    type="button"
                    className={`preset-icon-btn ${presetMenuOpen ? 'preset-icon-btn-open' : ''}`}
                    title="More preset actions"
                    aria-label="More preset actions"
                    aria-haspopup="menu"
                    aria-expanded={presetMenuOpen}
                    onClick={() => {
                      setPresetMenuOpen((prev) => !prev)
                      setSecondaryFilterMenuOpen(false)
                    }}
                  >
                    <span aria-hidden="true" className="preset-icon-glyph">
                      ⋮
                    </span>
                  </button>
                  {presetMenuOpen && (
                    <div
                      className="filters-dropdown-menu filters-dropdown-menu-presets"
                      role="menu"
                      aria-label="Preset actions menu"
                    >
                      <div className="filters-dropdown-section">
                        <p className="filters-dropdown-heading">Apply preset</p>
                        {presets.length === 0 ? (
                          <p className="filters-dropdown-empty">No saved presets</p>
                        ) : (
                          presets.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              className={`filters-dropdown-action ${
                                presetSelection === preset.id ? 'filters-dropdown-action-active' : ''
                              }`}
                              onClick={() => {
                                setPresetSelection(preset.id)
                                onApplyPreset(preset.id)
                                setPresetMenuOpen(false)
                              }}
                            >
                              {preset.name}
                            </button>
                          ))
                        )}
                      </div>
                      <div className="filters-dropdown-section">
                        <p className="filters-dropdown-heading">Delete preset</p>
                        {presets.length === 0 ? (
                          <p className="filters-dropdown-empty">Nothing to delete</p>
                        ) : (
                          presets.map((preset) => (
                            <button
                              key={`${preset.id}-delete`}
                              type="button"
                              className="filters-dropdown-action filters-dropdown-action-danger"
                              onClick={() => {
                                onDeletePreset(preset.id)
                                if (presetSelection === preset.id) setPresetSelection('')
                                setPresetMenuOpen(false)
                              }}
                            >
                              Delete {preset.name}
                            </button>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        className="filters-dropdown-action"
                        onClick={() => {
                          resetAllFilters()
                          setPresetMenuOpen(false)
                        }}
                      >
                        Reset all filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {showSecondaryFilters.cellAttributes && (
              <div className="filters-chip-row filters-chip-row-secondary" aria-label="Secondary global filter chips">
                <label className="filter-chip filter-chip-secondary">
                  <span>Cell attributes</span>
                  <div className="filter-chip-control">
                    <input
                      type="search"
                      className="filter-chip-input"
                      placeholder="Cell name or ID"
                      value={cellAttributes}
                      onChange={(e) => onCellAttributes(e.target.value)}
                    />
                    {cellAttributes.trim() && (
                      <button
                        type="button"
                        className="filter-chip-clear"
                        aria-label="Clear cell attributes filter"
                        onClick={() => onCellAttributes('')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="filters-time-panel">
          <div className="time-range-strip">
            <label className="filter-chip filter-chip-time">
              <span>Time range</span>
              <div className="filter-chip-control">
                <select value={timeRange} onChange={(e) => onTimeRange(e.target.value)}>
                  <option value="15m">Last 15 minutes</option>
                  <option value="1h">Last 1 hour</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>
            </label>
            {timeRange === 'custom' && (
              <div className="filter-chip filter-chip-time-dates" aria-label="Custom date range">
                <div className="time-range-custom-inputs">
                  <label className="time-range-date-field">
                    <span>Start</span>
                    <input
                      type="date"
                      value={customTimeRangeStart}
                      onChange={(e) => onCustomTimeRangeStart(e.target.value)}
                    />
                  </label>
                  <label className="time-range-date-field">
                    <span>End</span>
                    <input
                      type="date"
                      value={customTimeRangeEnd}
                      onChange={(e) => onCustomTimeRangeEnd(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
