const STORAGE_KEY = 'operator-dashboard-global-filter-presets'

export type GlobalFilterSnapshot = {
  timeRange: string
  subscriberType: string
  deviceType: string
  cellAttributes: string
}

/** Subset of global filters applied to subscriber cohorts (cell table, drill-down, map). */
export type SubscriberGlobalFilters = Pick<
  GlobalFilterSnapshot,
  'timeRange' | 'subscriberType' | 'deviceType'
>

export const ALL_SUBSCRIBER_FILTERS: SubscriberGlobalFilters = {
  timeRange: '24h',
  subscriberType: 'all',
  deviceType: 'all',
}

export type SavedFilterPreset = {
  id: string
  name: string
  savedAt: string
  filters: GlobalFilterSnapshot
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isSnapshot(x: unknown): x is GlobalFilterSnapshot {
  if (!isRecord(x)) return false
  return (
    typeof x.timeRange === 'string' &&
    typeof x.subscriberType === 'string' &&
    typeof x.deviceType === 'string' &&
    typeof x.cellAttributes === 'string'
  )
}

function isPreset(x: unknown): x is SavedFilterPreset {
  if (!isRecord(x)) return false
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.savedAt === 'string' &&
    isSnapshot(x.filters)
  )
}

export function loadFilterPresets(): SavedFilterPreset[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPreset)
  } catch {
    return []
  }
}

export function persistFilterPresets(presets: SavedFilterPreset[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {
    /* quota or private mode */
  }
}

export function newPresetId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
