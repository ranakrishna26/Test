import { useState } from 'react'
import type { SavedFilterPreset } from '../../utils/filterPresets'

type Props = {
  timeRange: string
  onTimeRange: (v: string) => void
  subscriberType: string
  onSubscriberType: (v: string) => void
  deviceType: string
  onDeviceType: (v: string) => void
  cellAttributes: string
  onCellAttributes: (v: string) => void
  presets: SavedFilterPreset[]
  onApplyPreset: (id: string) => void
  onSavePreset: (name: string) => void
  onDeletePreset: (id: string) => void
}

export function GlobalFiltersBar({
  timeRange,
  onTimeRange,
  subscriberType,
  onSubscriberType,
  deviceType,
  onDeviceType,
  cellAttributes,
  onCellAttributes,
  presets,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
}: Props) {
  const [loadSelection, setLoadSelection] = useState('')
  const [deleteSelection, setDeleteSelection] = useState('')
  const [saveName, setSaveName] = useState('')

  return (
    <header className="filters-bar">
      <div className="filters-row">
        <div className="filters-primary">
          <label className="filter-item">
            <span>Time range</span>
            <select value={timeRange} onChange={(e) => onTimeRange(e.target.value)}>
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
          <label className="filter-item">
            <span>Subscriber type</span>
            <select value={subscriberType} onChange={(e) => onSubscriberType(e.target.value)}>
              <option value="all">All</option>
              <option value="consumer">Consumer</option>
              <option value="enterprise">Enterprise</option>
              <option value="iot">IoT</option>
            </select>
          </label>
          <label className="filter-item">
            <span>Device type</span>
            <select value={deviceType} onChange={(e) => onDeviceType(e.target.value)}>
              <option value="all">All</option>
              <option value="phone">Handset</option>
              <option value="cpe">CPE</option>
              <option value="module">Module</option>
            </select>
          </label>
          <label className="filter-item filter-cell-attrs">
            <span>Cell attributes</span>
            <input
              type="text"
              placeholder="Band, site, vendor…"
              value={cellAttributes}
              onChange={(e) => onCellAttributes(e.target.value)}
            />
          </label>
        </div>

        <div className="filters-presets" aria-label="Filter presets">
          <label className="filter-item filter-item-compact">
            <span title="Load a saved filter preset">Load</span>
            <select
              aria-label="Load a saved filter preset"
              title="Load saved preset"
              value={loadSelection}
              onChange={(e) => {
                const id = e.target.value
                if (id) onApplyPreset(id)
                setLoadSelection('')
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

          <div className="filter-item filter-item-compact preset-save-compact">
            <span title="Save current filters as a preset">Save as</span>
            <div className="preset-save-inline">
              <input
                type="text"
                placeholder="Name"
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
                className="preset-save-btn"
                title="Save current filters as preset"
                onClick={() => {
                  const n = saveName.trim()
                  if (!n) return
                  onSavePreset(n)
                  setSaveName('')
                }}
              >
                Save
              </button>
            </div>
          </div>

          {presets.length > 0 && (
            <label className="filter-item filter-item-compact">
              <span title="Remove a saved preset">Remove</span>
              <select
                aria-label="Delete a saved filter preset"
                title="Delete saved preset"
                value={deleteSelection}
                onChange={(e) => {
                  const id = e.target.value
                  if (id) {
                    const p = presets.find((x) => x.id === id)
                    if (
                      p &&
                      typeof window !== 'undefined' &&
                      window.confirm(`Remove preset “${p.name}”?`)
                    ) {
                      onDeletePreset(id)
                    }
                  }
                  setDeleteSelection('')
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
          )}
        </div>
      </div>
    </header>
  )
}
