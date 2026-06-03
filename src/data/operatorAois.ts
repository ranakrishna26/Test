/**
 * Areas of interest (AOI) for the London demo footprint — each maps to NR cell IDs.
 * Used by global filters to scope subscribers, cell rankings, sessions, and the map.
 */

export type OperatorAoi = {
  id: string
  /** Compact district-style name for menus and chips */
  label: string
  /** Longer footprint hint for tooltips */
  hint: string
  cellIds: readonly string[]
}

/** Eight non-overlapping AOIs covering all placeholder cells (LDN cluster). */
export const OPERATOR_AOIS: readonly OperatorAoi[] = [
  {
    id: 'aoi-paddington',
    label: 'Paddington',
    hint: 'Paddington gateway and Hyde Park edge',
    cellIds: ['NR-1021', 'NR-4478'],
  },
  {
    id: 'aoi-marylebone-euston',
    label: 'Marylebone',
    hint: 'Marylebone and Euston corridor',
    cellIds: ['NR-2201', 'NR-8851'],
  },
  {
    id: 'aoi-marble-regent',
    label: 'West End',
    hint: 'Marble Arch and Regent Street core',
    cellIds: ['NR-4103', 'NR-6002'],
  },
  {
    id: 'aoi-oxford-fitzrovia',
    label: 'Fitzrovia',
    hint: 'Oxford Circus and Fitzrovia',
    cellIds: ['NR-8842', 'NR-3305'],
  },
  {
    id: 'aoi-bond-mayfair',
    label: 'Mayfair',
    hint: 'Bond Street and Mayfair',
    cellIds: ['NR-5520', 'NR-7710'],
  },
  {
    id: 'aoi-soho-holborn',
    label: 'Soho',
    hint: 'Soho and Holborn',
    cellIds: ['NR-9934', 'NR-5588'],
  },
  {
    id: 'aoi-farringdon-barbican',
    label: 'Clerkenwell',
    hint: 'Farringdon and Barbican',
    cellIds: ['NR-6612', 'NR-7744'],
  },
  {
    id: 'aoi-city-liverpool',
    label: 'Square Mile',
    hint: 'City of London financial district; Liverpool Street gateway',
    cellIds: ['NR-9093'],
  },
] as const

const KNOWN_AOI_IDS = new Set(OPERATOR_AOIS.map((a) => a.id))

const CELL_IDS_BY_AOI = new Map<string, ReadonlySet<string>>(
  OPERATOR_AOIS.map((a) => [a.id, new Set(a.cellIds)]),
)

/** When no AOIs are selected, no geographic restriction (entire network). */
export function unionCellIdsForAoiSelection(selectedAoiIds: readonly string[]): Set<string> | null {
  if (!selectedAoiIds.length) return null
  const out = new Set<string>()
  for (const id of selectedAoiIds) {
    const set = CELL_IDS_BY_AOI.get(id)
    if (set) for (const cid of set) out.add(cid)
  }
  return out.size ? out : null
}

export function isKnownAoiId(id: string): boolean {
  return KNOWN_AOI_IDS.has(id)
}

export function normalizeAoiSelection(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const out: string[] = []
  for (const x of ids) {
    if (typeof x !== 'string' || !isKnownAoiId(x)) continue
    if (!out.includes(x)) out.push(x)
  }
  return out
}
