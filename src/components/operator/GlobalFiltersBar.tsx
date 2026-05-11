import { useState } from 'react'
import type { SavedFilterPreset } from '../../utils/filterPresets'

type Props = {
  timeRange: string
  onTimeRange: (v: string) => void
  customTimeRangeStart: string
  onCustomTimeRangeStart: (v: string) => void
  customTimeRangeEnd: string
  onCustomTimeRangeEnd: (v: string) => void
  technology: string
  onTechnology: (v: string) => void
  service: string
  onService: (v: string) => void
  subscriberType: string
  onSubscriberType: (v: string) => void
  networkMode: 'all' | 'sa' | 'nsa'
  onNetworkMode: (v: 'all' | 'sa' | 'nsa') => void
  presets: SavedFilterPreset[]
  onApplyPreset: (id: string | null) => void
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
  technology,
  onTechnology,
  service,
  onService,
  subscriberType,
  onSubscriberType,
  networkMode,
  onNetworkMode,
  presets,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
}: Props) {
  const [presetSelection, setPresetSelection] = useState('')
  const [saveName, setSaveName] = useState('')

  return (
    <header className="filters-bar">
      <div className="filters-row">
        <div className="filters-primary">
          <label className="filter-item">
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
                className={`mode-toggle-btn ${
                  networkMode === 'all' || networkMode === 'sa' ? 'is-selected' : ''
                }`}
                onClick={() => onNetworkMode(networkMode === 'sa' ? 'all' : 'sa')}
                aria-pressed={networkMode === 'sa'}
                title="Filter for 5G SA subscribers"
              >
                5G SA
              </button>
              <button
                type="button"
                className={`mode-toggle-btn ${
                  networkMode === 'all' || networkMode === 'nsa' ? 'is-selected' : ''
                }`}
                onClick={() => onNetworkMode(networkMode === 'nsa' ? 'all' : 'nsa')}
                aria-pressed={networkMode === 'nsa'}
                title="Filter for 5G NSA subscribers"
              >
                5G NSA
              </button>
            </div>
          </div>
          <label className="filter-item">
            <span>Technology</span>
            <select value={technology} onChange={(e) => onTechnology(e.target.value)}>
              <option value="all">All</option>
              <option value="5g">5G</option>
              <option value="4g">4G</option>
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
              onChange={(e) => setPresetSelection(e.target.value)}
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
                className="preset-icon-btn"
                aria-label="Apply selected preset"
                title="Apply selected preset"
                disabled={!presetSelection}
                onClick={() => onApplyPreset(presetSelection || null)}
              >
                <span aria-hidden="true">⤓</span>
              </button>
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
