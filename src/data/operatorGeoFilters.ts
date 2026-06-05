/**
 * Region + London **unit postcode** AOI scoping for the operator dashboard prototype.
 */

import {
  CELL_UNIT_POSTCODES,
  KNOWN_UNIT_POSTCODE_IDS,
  LEGACY_OUTWARD_POSTCODE_IDS,
  OPERATOR_UNIT_POSTCODES,
  expandLegacyDistrictToUnitPostcodes,
} from './operatorUnitPostcodes'

export type OperatorRegion = { id: string; label: string }

export type OperatorUnitPostcode = (typeof OPERATOR_UNIT_POSTCODES)[number]

/** Re-export for callers that only import geo filters. */
export {
  CELL_UNIT_POSTCODES,
  KNOWN_UNIT_POSTCODE_IDS,
  LEGACY_OUTWARD_POSTCODE_IDS,
  OPERATOR_UNIT_POSTCODES,
  expandLegacyDistrictToUnitPostcodes,
  unitPostcodeMatchesLegacyDistrict,
} from './operatorUnitPostcodes'

/** UK regions (reference layout). Placeholder cells use synthetic admin-region tags for AOI demos. */
export const OPERATOR_REGIONS: readonly OperatorRegion[] = [
  { id: 'east_of_england', label: 'East of England' },
  { id: 'east_midlands', label: 'East Midlands' },
  { id: 'london', label: 'London' },
  { id: 'north_east', label: 'North East' },
  { id: 'north_west', label: 'North West' },
  { id: 'south_east', label: 'South East' },
  { id: 'south_west', label: 'South West' },
  { id: 'west_midlands', label: 'West Midlands' },
  { id: 'yorkshire_humber', label: 'Yorkshire and Humber' },
] as const

const KNOWN_REGION_IDS = new Set(OPERATOR_REGIONS.map((r) => r.id))

const PLACEHOLDER_CELL_IDS: readonly string[] = [
  'NR-1021',
  'NR-4478',
  'NR-2201',
  'NR-8851',
  'NR-4103',
  'NR-6002',
  'NR-8842',
  'NR-3305',
  'NR-5520',
  'NR-7710',
  'NR-9934',
  'NR-5588',
  'NR-6612',
  'NR-7744',
  'NR-9093',
  'NR-3110',
  'NR-4220',
  'NR-5330',
  'NR-6440',
  'NR-7550',
  'NR-8660',
]

const ALL_CELL_IDS = new Set(PLACEHOLDER_CELL_IDS)

/**
 * Synthetic UK admin region per NR cell (map stays Greater London; tags drive AOI only).
 * Every OPERATOR_REGIONS id is represented so single-region picks always narrow the cohort.
 */
export const CELL_REGION_ID: Record<string, string> = {
  'NR-1021': 'london',
  'NR-4103': 'london',
  'NR-8842': 'london',
  'NR-6002': 'london',
  'NR-9934': 'london',
  'NR-3305': 'london',
  'NR-6612': 'london',
  'NR-5588': 'london',
  /** Southwark — still Greater London; keeps London ∩ SE-style units non-empty for demos. */
  'NR-6440': 'london',
  'NR-4478': 'north_west',
  'NR-3110': 'north_west',
  'NR-7550': 'south_east',
  'NR-5330': 'east_of_england',
  'NR-8660': 'east_of_england',
  'NR-5520': 'south_west',
  'NR-7710': 'south_west',
  'NR-2201': 'west_midlands',
  'NR-8851': 'east_midlands',
  'NR-4220': 'east_midlands',
  'NR-7744': 'north_east',
  'NR-9093': 'yorkshire_humber',
}

export function normalizeRegionSelection(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const out: string[] = []
  for (const x of ids) {
    if (typeof x !== 'string' || !KNOWN_REGION_IDS.has(x)) continue
    if (!out.includes(x)) out.push(x)
  }
  return out
}

/**
 * Normalizes saved AOI postcode ids: full unit postcodes (e.g. `E1 6AN`) plus migration from
 * legacy outward-only chips (`NW`, `EC`, …).
 */
export function normalizePostcodeSelection(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const out: string[] = []
  for (const x of ids) {
    if (typeof x !== 'string' || !x.trim()) continue
    const trimmed = x.trim()
    if (KNOWN_UNIT_POSTCODE_IDS.has(trimmed)) {
      if (!out.includes(trimmed)) out.push(trimmed)
      continue
    }
    if (LEGACY_OUTWARD_POSTCODE_IDS.has(trimmed)) {
      for (const id of expandLegacyDistrictToUnitPostcodes(trimmed)) {
        if (!out.includes(id)) out.push(id)
      }
    }
  }
  return out
}

function intersectSets(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>()
  for (const id of a) if (b.has(id)) out.add(id)
  return out
}

function cellMatchesSelectedPostcodes(cellId: string, selectedUnitPostcodes: readonly string[]): boolean {
  const units = CELL_UNIT_POSTCODES[cellId]
  if (!units?.length) return false
  return units.some((u) => selectedUnitPostcodes.includes(u))
}

/**
 * Cells matching selected regions ∩ selected unit postcodes.
 * - No region and no postcode selected → `null` (no geographic restriction).
 * - Any selection active → a `Set` of cell ids (possibly empty if nothing matches).
 */
export function unionCellIdsForGeoSelection(
  regionIds: readonly string[],
  postcodeIds: readonly string[],
): Set<string> | null {
  if (!regionIds.length && !postcodeIds.length) return null

  let pool = ALL_CELL_IDS

  if (regionIds.length) {
    const r = new Set<string>()
    for (const id of ALL_CELL_IDS) {
      const reg = CELL_REGION_ID[id]
      if (reg && regionIds.includes(reg)) r.add(id)
    }
    pool = intersectSets(pool, r)
  }

  if (postcodeIds.length) {
    const p = new Set<string>()
    for (const id of ALL_CELL_IDS) {
      if (cellMatchesSelectedPostcodes(id, postcodeIds)) p.add(id)
    }
    pool = intersectSets(pool, p)
  }

  return pool
}
