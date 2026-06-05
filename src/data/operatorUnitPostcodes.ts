/**
 * London-style **unit postcodes** (outward + space + inward) for AOI demo data.
 * Format matches what people type (e.g. E1 6AN); values are synthetic, not Royal Mail validated.
 */

export type OperatorUnitPostcode = { id: string; label: string; hint: string }

/** Outward sector + inward half — unique strings used as stable filter ids. */
const U = (outward: string, inward: string): string => `${outward} ${inward}`

/**
 * Unit postcodes anchored to each NR cell (non-overlapping lists so filters map cleanly to sites).
 */
export const CELL_UNIT_POSTCODES: Record<string, readonly string[]> = {
  'NR-1021': [
    U('NW1', '6BT'),
    U('NW1', '8QX'),
    U('W2', '1HQ'),
    U('W2', '2FF'),
    U('NW8', '3DE'),
    U('W1', '4AA'),
    U('NW1', '2RH'),
    U('W2', '5JB'),
  ],
  'NR-4478': [
    U('NW8', '7DE'),
    U('NW10', '4AS'),
    U('NW6', '1ZX'),
    U('NW2', '9LM'),
    U('NW3', '5QR'),
    U('NW10', '8GH'),
    U('NW8', '2NP'),
    U('NW6', '6CD'),
  ],
  'NR-2201': [
    U('NW1', '3EF'),
    U('W1U', '3CC'),
    U('W1T', '2EE'),
    U('NW1', '7JK'),
    U('W1G', '8ST'),
    U('NW3', '4UV'),
    U('W1', '9WX'),
    U('NW1', '1YZ'),
  ],
  'NR-8851': [
    U('N7', '0DS'),
    U('N1', '6ER'),
    U('N1', '9GU'),
    U('NW1', '4BC'),
    U('N1', '3OP'),
    U('NW5', '2QR'),
    U('N19', '5MN'),
    U('N1', '8KL'),
  ],
  'NR-4103': [
    U('W1K', '4AA'),
    U('W1J', '7BB'),
    U('W1', '2CC'),
    U('W1C', '3DD'),
    U('W1S', '6EE'),
    U('W1H', '9FF'),
    U('W1', '5GG'),
    U('W1K', '1HH'),
  ],
  'NR-6002': [
    U('W1B', '2JJ'),
    U('W1F', '4KK'),
    U('W1D', '6LL'),
    U('W1', '8MM'),
    U('W1B', '3NN'),
    U('W1F', '7PP'),
    U('W1D', '9QQ'),
    U('W1', '1RR'),
  ],
  'NR-8842': [
    U('W1D', '5SS'),
    U('W1F', '8TT'),
    U('W1', '4UU'),
    U('W1C', '2VV'),
    U('W1S', '6WW'),
    U('W1', '7XX'),
    U('W1D', '3YY'),
    U('W1F', '9ZZ'),
  ],
  'NR-3305': [
    U('W1T', '2AB'),
    U('W1W', '5CD'),
    U('W1', '6EF'),
    U('W1P', '8GH'),
    U('W1T', '4IJ'),
    U('W1W', '7KL'),
    U('W1', '9MN'),
    U('W1P', '1OP'),
  ],
  'NR-5520': [
    U('W1J', '3QR'),
    U('W1K', '6ST'),
    U('W1S', '8UV'),
    U('W1J', '2WX'),
    U('W1K', '5YZ'),
    U('W1S', '7AB'),
    U('W1J', '9CD'),
    U('W1K', '4EF'),
  ],
  'NR-7710': [
    U('W1K', '8GH'),
    U('W1J', '1IJ'),
    U('W1S', '3KL'),
    U('W1K', '6MN'),
    U('W1J', '8OP'),
    U('W1S', '2QR'),
    U('W1K', '5ST'),
    U('W1J', '7UV'),
  ],
  'NR-9934': [
    U('W1D', '4WX'),
    U('W1F', '6YZ'),
    U('W1', '8AB'),
    U('W1D', '2CD'),
    U('W1F', '5EF'),
    U('W1', '7GH'),
    U('W1D', '9IJ'),
    U('W1F', '1KL'),
  ],
  'NR-5588': [
    U('WC1', '2MN'),
    U('WC2', '4OP'),
    U('WC1E', '6QR'),
    U('WC2B', '8ST'),
    U('WC1', '3UV'),
    U('WC2', '5WX'),
    U('WC1N', '7YZ'),
    U('WC2E', '9AB'),
  ],
  'NR-6612': [
    U('EC1', '2CD'),
    U('EC1M', '4EF'),
    U('EC1R', '6GH'),
    U('EC1V', '8IJ'),
    U('EC1', '3KL'),
    U('EC1M', '5MN'),
    U('EC1R', '7OP'),
    U('EC1V', '9QR'),
  ],
  'NR-7744': [
    U('EC2', '2ST'),
    U('EC2Y', '4UV'),
    U('EC2M', '6WX'),
    U('EC2N', '8YZ'),
    U('EC2', '3AB'),
    U('EC2Y', '5CD'),
    U('EC2M', '7EF'),
    U('EC2N', '9GH'),
  ],
  'NR-9093': [
    U('EC2', '4IJ'),
    U('EC3', '6KL'),
    U('EC3A', '8MN'),
    U('EC3M', '2OP'),
    U('EC2', '5QR'),
    U('EC3', '7ST'),
    U('EC3A', '9UV'),
    U('EC3M', '3WX'),
  ],
  'NR-3110': [
    U('W1J', '6YZ'),
    U('SW1', '2AA'),
    U('W1K', '2CD'),
    U('W2', '4EF'),
    U('W1J', '7GH'),
    U('SW1', '9IJ'),
    U('W1K', '3KL'),
    U('W2', '5MN'),
  ],
  'NR-4220': [
    U('N1', '4OP'),
    U('NW1', '6QR'),
    U('N7', '8ST'),
    U('N1', '2UV'),
    U('NW1', '5WX'),
    U('N7', '7YZ'),
    U('N1', '9AB'),
    U('NW1', '1CD'),
  ],
  'NR-5330': [
    U('E1', '6AN'),
    U('E2', '8DY'),
    U('E1', '4EF'),
    U('E8', '6GH'),
    U('E1', '7IJ'),
    U('E2', '9KL'),
    U('E1', '3MN'),
    U('E8', '5OP'),
  ],
  'NR-6440': [
    U('SE1', '8XX'),
    U('SE1', '7RT'),
    U('SE16', '5HP'),
    U('SE1', '6QR'),
    U('SE1', '4ST'),
    U('SE16', '8UV'),
    U('SE1', '9WX'),
    U('SE16', '2YZ'),
  ],
  'NR-7550': [
    U('SW1', '6AN'),
    U('SW1E', '5DH'),
    U('SW1', '8AB'),
    U('SW1W', '9QQ'),
    U('SW1', '4CD'),
    U('SW1E', '7EF'),
    U('SW1W', '3GH'),
    U('SW1', '5IJ'),
  ],
  'NR-8660': [
    U('E1', '8KL'),
    U('E2', '6MN'),
    U('EC2A', '4OP'),
    U('E1', '2QR'),
    U('E2', '8ST'),
    U('EC2A', '6UV'),
    U('E1', '4WX'),
    U('E2', '2YZ'),
  ],
}

const _all = [...new Set(Object.values(CELL_UNIT_POSTCODES).flat())].sort()

export const OPERATOR_UNIT_POSTCODES: readonly OperatorUnitPostcode[] = _all.map((label) => {
  const outward = label.split(/\s+/)[0] ?? label
  return {
    id: label,
    label,
    hint: `${outward} district`,
  }
})

export const KNOWN_UNIT_POSTCODE_IDS = new Set(OPERATOR_UNIT_POSTCODES.map((p) => p.id))

/** Legacy single-letter / pair outward chips from an earlier UI build. */
export const LEGACY_OUTWARD_POSTCODE_IDS = new Set(['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC'])

export function unitPostcodeMatchesLegacyDistrict(label: string, legacyId: string): boolean {
  const outward = (label.split(/\s+/)[0] ?? '').toUpperCase()
  switch (legacyId) {
    case 'EC':
      return outward.startsWith('EC')
    case 'NW':
      return outward.startsWith('NW')
    case 'SE':
      return outward.startsWith('SE')
    case 'SW':
      return outward.startsWith('SW')
    case 'WC':
      return outward.startsWith('WC')
    case 'N':
      return /^N\d/.test(outward) && !outward.startsWith('NW')
    case 'E':
      return /^E\d/.test(outward) && !outward.startsWith('EC')
    case 'W':
      return /^W\d/.test(outward) && !outward.startsWith('WC')
    default:
      return false
  }
}

export function expandLegacyDistrictToUnitPostcodes(legacyId: string): string[] {
  if (!LEGACY_OUTWARD_POSTCODE_IDS.has(legacyId)) return []
  return OPERATOR_UNIT_POSTCODES.filter((p) => unitPostcodeMatchesLegacyDistrict(p.label, legacyId)).map(
    (p) => p.id,
  )
}
