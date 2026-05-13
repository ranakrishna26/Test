import { useState } from 'react'
import type { SavedFilterPreset } from '../../utils/filterPresets'
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
  selectedKpiId: KpiId
  onSelectedKpiId: (v: KpiId) => void
  presets: SavedFilterPreset[]
  onApplyPreset: (id: string) => void
  onSavePreset: (name: string) => void
  onDeletePreset: (id: string | null) => void
}

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
  selectedKpiId,
  onSelectedKpiId,
  presets,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
}: Props) {
  const [presetSelection, setPresetSelection] = useState('')
  const [saveName, setSaveName] = useState('')
  const kpiGroups = groupedKpiDefinitions()
  const saActive = networkMode !== 'nsa'
  const nsaActive = networkMode !== 'sa'

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

  return (
    <header className="filters-bar">
      <div className="filters-row">
        <div className="filters-primary">
          <label className="filter-item filter-kpi">
            <span>Time range</span>
            <select value={timeRange} onChange={(e) => onTimeRange(e.target.value)}>
              <option value="15m">Last 15 minutes</option>
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          {timeRange === 'custom' && (
            <div className="filter-item custom-time-group">
              <span>Custom dates</span>
              <div className="custom-time-inputs">
                <label>
                  <span>Start</span>
                  <input
                    type="date"
                    value={customTimeRangeStart}
                    onChange={(e) => onCustomTimeRangeStart(e.target.value)}
                  />
                </label>
                <label>
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
          <label className="filter-item">
            <span>Global KPI</span>
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
          </label>
          <label className="filter-item">
            <span>Service</span>
            <select value={service} onChange={(e) => onService(e.target.value)}>
              <option value="all">All</option>
              <option value="data">Data</option>
              <option value="voice">Voice</option>
              <option value="messaging">Messaging</option>
              <option value="iot">IoT</option>
            </select>
          </label>
          <label className="filter-item">
            <span>Subscriber type</span>
            <select value={subscriberType} onChange={(e) => onSubscriberType(e.target.value)}>
              <option value="all">All</option>
              <option value="consumer">Consumer</option>
              <option value="enterprise">Enterprise</option>
              <option value="iot">IoT</option>
              <option value="vip">VIP</option>
            </select>
          </label>
        </div>

        <div className="filters-presets" aria-label="Filter presets">
          <div className="preset-controls-row">
            <label className="filter-item filter-item-compact preset-picker">
            <select
              aria-label="Select a saved filter preset"
              title="Choose saved preset"
              value={presetSelection}
              onChange={(e) => {
                const nextPresetId = e.target.value
                setPresetSelection(nextPresetId)
                if (nextPresetId) onApplyPreset(nextPresetId)
              }}
            >
              <option value="">Preset…</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            </label>
            <div className="preset-icon-actions" role="group" aria-label="Preset actions">
              <button
                type="button"
                className="preset-icon-btn preset-icon-btn-danger"
                aria-label="Delete selected preset"
                title="Delete selected preset"
                disabled={!presetSelection}
                onClick={() => {
                  if (!presetSelection) return
                  onDeletePreset(presetSelection)
                  setPresetSelection('')
                }}
              >
                <span aria-hidden="true">🗑</span>
              </button>
            </div>
          </div>
          <div className="filter-item filter-item-compact preset-save-compact">
            <div className="preset-save-inline">
              <input
                type="text"
                placeholder="Save as…"
                aria-label="Preset name"
                title="Preset name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const n = saveName.trim()
                    if (n) {
                      onSavePreset(n)
                      setSaveName('')
                    }
                  }
                }}
              />
              <button
                type="button"
                className="preset-icon-btn"
                aria-label="Save current filters as preset"
                title="Save current filters as preset"
                onClick={() => {
                  const n = saveName.trim()
                  if (!n) return
                  onSavePreset(n)
                  setSaveName('')
                }}
              >
                <span aria-hidden="true">💾</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
