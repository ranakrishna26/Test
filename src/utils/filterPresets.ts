import { DEFAULT_KPI_ID, isKpiId, type KpiId } from '../data/kpis'

const STORAGE_KEY = 'operator-dashboard-global-filter-presets'

export type GlobalFilterSnapshot = {
  timeRange: string
  customTimeRangeStart: string
  customTimeRangeEnd: string
  service: string
  networkMode: 'all' | 'sa' | 'nsa'
  subscriberType: string
  cellAttributes: string
  selectedKpiId: KpiId
}

/** Subset of global filters applied to subscriber cohorts (cell table, drill-down, map). */
export type SubscriberGlobalFilters = Pick<
  GlobalFilterSnapshot,
  | 'timeRange'
  | 'customTimeRangeStart'
  | 'customTimeRangeEnd'
  | 'service'
  | 'networkMode'
  | 'subscriberType'
>

export const ALL_SUBSCRIBER_FILTERS: SubscriberGlobalFilters = {
  timeRange: '24h',
  customTimeRangeStart: '',
  customTimeRangeEnd: '',
  service: 'all',
  networkMode: 'sa',
  subscriberType: 'all',
}

export const DEFAULT_GLOBAL_FILTER_SNAPSHOT: GlobalFilterSnapshot = {
  timeRange: '24h',
  customTimeRangeStart: '',
  customTimeRangeEnd: '',
  service: 'all',
  networkMode: 'sa',
  subscriberType: 'all',
  cellAttributes: '',
  selectedKpiId: DEFAULT_KPI_ID,
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
    typeof x.customTimeRangeStart === 'string' &&
    typeof x.customTimeRangeEnd === 'string' &&
    typeof x.service === 'string' &&
    (x.networkMode === 'all' || x.networkMode === 'sa' || x.networkMode === 'nsa') &&
    typeof x.subscriberType === 'string' &&
    typeof x.cellAttributes === 'string' &&
    isKpiId(x.selectedKpiId)
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

function normalizeSnapshot(x: unknown): GlobalFilterSnapshot | null {
  if (!isRecord(x)) return null
  const networkMode =
    x.networkMode === 'sa' || x.networkMode === 'nsa' || x.networkMode === 'all'
      ? x.networkMode
      : 'sa'
  const timeRange = typeof x.timeRange === 'string' ? x.timeRange : null
  const subscriberType = typeof x.subscriberType === 'string' ? x.subscriberType : null
  const cellAttributes = typeof x.cellAttributes === 'string' ? x.cellAttributes : null
  if (!timeRange || !subscriberType || cellAttributes === null) return null
  const selectedKpiId = isKpiId(x.selectedKpiId) ? x.selectedKpiId : DEFAULT_KPI_ID
  return {
    timeRange,
    customTimeRangeStart: typeof x.customTimeRangeStart === 'string' ? x.customTimeRangeStart : '',
    customTimeRangeEnd: typeof x.customTimeRangeEnd === 'string' ? x.customTimeRangeEnd : '',
    service: typeof x.service === 'string' ? x.service : 'all',
    networkMode,
    subscriberType,
    cellAttributes,
    selectedKpiId,
  }
}

export function loadFilterPresets(): SavedFilterPreset[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const normalized: SavedFilterPreset[] = []
    for (const item of parsed) {
      if (!isRecord(item)) continue
      if (isPreset(item)) {
        normalized.push(item)
        continue
      }
      const filters = normalizeSnapshot(item.filters)
      if (
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.savedAt === 'string' &&
        filters
      ) {
        normalized.push({
          id: item.id,
          name: item.name,
          savedAt: item.savedAt,
          filters,
        })
      }
    }
    return normalized
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
