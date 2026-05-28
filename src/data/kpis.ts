export type KpiCategory =
  | 'Connectivity'
  | 'Reliability'
  | 'Signal'
  | 'Throughput'
  | 'Packet Transmission'

export type KpiDirection = 'higher_is_better' | 'lower_is_better'

export type KpiId =
  | 'connectivity_attach_success_pct'
  | 'connectivity_nr_rrc_setup_success_pct'
  | 'reliability_rlf_count'
  | 'reliability_x2_xn1_setup_success_pct'
  | 'reliability_5g_ho_success_pct'
  | 'reliability_irat_hos'
  | 'signal_rsrp'
  | 'signal_rsrq'
  | 'signal_disnr'
  | 'signal_uisnr'
  | 'signal_bler'
  | 'signal_cqi'
  | 'throughput_dl_mbps'
  | 'throughput_ul_mbps'
  | 'packet_ota_delay_ms'
  | 'packet_ota_drops'

export type KpiThresholds = {
  good: number
  warning: number
}

export type KpiDefinition = {
  id: KpiId
  label: string
  category: KpiCategory
  unit: string
  direction: KpiDirection
  thresholds?: KpiThresholds
  decimals?: number
}

export type KpiDistributionBin = {
  min: number
  max: number
  label: string
}

export const KPI_DEFINITIONS = [
  {
    id: 'connectivity_attach_success_pct',
    label: 'Attach Succ%',
    category: 'Connectivity',
    unit: '%',
    direction: 'higher_is_better',
    thresholds: { good: 98, warning: 95 },
    decimals: 1,
  },
  {
    id: 'connectivity_nr_rrc_setup_success_pct',
    label: 'NR RRC Setup Succ%',
    category: 'Connectivity',
    unit: '%',
    direction: 'higher_is_better',
    thresholds: { good: 98, warning: 94.5 },
    decimals: 1,
  },
  {
    id: 'reliability_rlf_count',
    label: 'Radio Link Failure (RLF) count',
    category: 'Reliability',
    unit: 'count',
    direction: 'lower_is_better',
    thresholds: { good: 8, warning: 18 },
    decimals: 0,
  },
  {
    id: 'reliability_x2_xn1_setup_success_pct',
    label: 'X2/Xn1 Setup Succ%',
    category: 'Reliability',
    unit: '%',
    direction: 'higher_is_better',
    thresholds: { good: 97.5, warning: 94 },
    decimals: 1,
  },
  {
    id: 'reliability_5g_ho_success_pct',
    label: '5G HO Succ%',
    category: 'Reliability',
    unit: '%',
    direction: 'higher_is_better',
    thresholds: { good: 96.5, warning: 92 },
    decimals: 1,
  },
  {
    id: 'reliability_irat_hos',
    label: 'IRAT HOs',
    category: 'Reliability',
    unit: 'count',
    direction: 'lower_is_better',
    thresholds: { good: 120, warning: 220 },
    decimals: 0,
  },
  {
    id: 'signal_rsrp',
    label: 'RSRP',
    category: 'Signal',
    unit: 'dBm',
    direction: 'higher_is_better',
    thresholds: { good: -95, warning: -105 },
    decimals: 1,
  },
  {
    id: 'signal_rsrq',
    label: 'RSRQ',
    category: 'Signal',
    unit: 'dB',
    direction: 'higher_is_better',
    thresholds: { good: -10, warning: -14 },
    decimals: 1,
  },
  {
    id: 'signal_disnr',
    label: 'dISNR',
    category: 'Signal',
    unit: 'dB',
    direction: 'higher_is_better',
    thresholds: { good: 12, warning: 7 },
    decimals: 1,
  },
  {
    id: 'signal_uisnr',
    label: 'uISNR',
    category: 'Signal',
    unit: 'dB',
    direction: 'higher_is_better',
    thresholds: { good: 10, warning: 6 },
    decimals: 1,
  },
  {
    id: 'signal_bler',
    label: 'BLER',
    category: 'Signal',
    unit: '%',
    direction: 'lower_is_better',
    thresholds: { good: 4, warning: 8 },
    decimals: 1,
  },
  {
    id: 'signal_cqi',
    label: 'CQI',
    category: 'Signal',
    unit: 'index',
    direction: 'higher_is_better',
    thresholds: { good: 10, warning: 7 },
    decimals: 1,
  },
  {
    id: 'throughput_dl_mbps',
    label: 'DL Throughput',
    category: 'Throughput',
    unit: 'Mbps',
    direction: 'higher_is_better',
    thresholds: { good: 45, warning: 20 },
    decimals: 1,
  },
  {
    id: 'throughput_ul_mbps',
    label: 'UL Throughput',
    category: 'Throughput',
    unit: 'Mbps',
    direction: 'higher_is_better',
    thresholds: { good: 12, warning: 6 },
    decimals: 1,
  },
  {
    id: 'packet_ota_delay_ms',
    label: 'OTA Packet Delay',
    category: 'Packet Transmission',
    unit: 'ms',
    direction: 'lower_is_better',
    thresholds: { good: 30, warning: 65 },
    decimals: 1,
  },
  {
    id: 'packet_ota_drops',
    label: 'OTA Packet Drops',
    category: 'Packet Transmission',
    unit: 'count',
    direction: 'lower_is_better',
    thresholds: { good: 2, warning: 6 },
    decimals: 1,
  },
] as const satisfies readonly KpiDefinition[]

export const DEFAULT_KPI_ID: KpiId = 'reliability_rlf_count'

export type TabKpiLens = 'callDrop' | 'failure' | 'payload' | 'handover'

export const TAB_DEFAULT_KPI: Record<TabKpiLens, KpiId> = {
  callDrop: 'packet_ota_drops',
  failure: 'connectivity_nr_rrc_setup_success_pct',
  payload: 'throughput_dl_mbps',
  handover: 'reliability_5g_ho_success_pct',
}

export function tabDefaultKpi(tab: TabKpiLens): KpiId {
  return TAB_DEFAULT_KPI[tab]
}

export const KPI_CATEGORY_ORDER: KpiCategory[] = [
  'Connectivity',
  'Reliability',
  'Signal',
  'Throughput',
  'Packet Transmission',
]

export const KPI_BY_ID: Record<KpiId, KpiDefinition> = Object.fromEntries(
  KPI_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<KpiId, KpiDefinition>

export function isKpiId(value: unknown): value is KpiId {
  return typeof value === 'string' && value in KPI_BY_ID
}

export function groupedKpiDefinitions(): { category: KpiCategory; kpis: KpiDefinition[] }[] {
  return KPI_CATEGORY_ORDER.map((category) => ({
    category,
    kpis: KPI_DEFINITIONS.filter((definition) => definition.category === category),
  }))
}

export function formatKpiValueByDefinition(definition: KpiDefinition, value: number): string {
  const decimals = definition.decimals ?? 1
  const formatted =
    definition.unit === 'count' || definition.unit === 'index'
      ? value.toFixed(Math.max(0, definition.decimals ?? 0))
      : value.toFixed(decimals)
  if (definition.unit === '%') return `${formatted}%`
  if (definition.unit === 'count' || definition.unit === 'index') return formatted
  return `${formatted} ${definition.unit}`
}

export function kpiDistributionBins(kpiId: KpiId): KpiDistributionBin[] {
  switch (kpiId) {
    case 'connectivity_attach_success_pct':
    case 'connectivity_nr_rrc_setup_success_pct':
    case 'reliability_x2_xn1_setup_success_pct':
    case 'reliability_5g_ho_success_pct':
      return [
        { min: 0, max: 80, label: '<80%' },
        { min: 80, max: 90, label: '80-89.9%' },
        { min: 90, max: 95, label: '90-94.9%' },
        { min: 95, max: 98, label: '95-97.9%' },
        { min: 98, max: 100.01, label: '>=98%' },
      ]
    case 'signal_bler':
      return [
        { min: 0, max: 2, label: '0-1.9%' },
        { min: 2, max: 5, label: '2-4.9%' },
        { min: 5, max: 10, label: '5-9.9%' },
        { min: 10, max: 20, label: '10-19.9%' },
        { min: 20, max: 40, label: '20-39.9%' },
        { min: 40, max: Number.POSITIVE_INFINITY, label: '>=40%' },
      ]
    case 'reliability_rlf_count':
    case 'reliability_irat_hos':
    case 'packet_ota_drops':
      return [
        { min: 0, max: 1, label: '0' },
        { min: 1, max: 2, label: '1' },
        { min: 2, max: 4, label: '2-3' },
        { min: 4, max: 8, label: '4-7' },
        { min: 8, max: 16, label: '8-15' },
        { min: 16, max: Number.POSITIVE_INFINITY, label: '>=16' },
      ]
    case 'signal_rsrp':
      return [
        { min: Number.NEGATIVE_INFINITY, max: -115, label: '<-115 dBm' },
        { min: -115, max: -105, label: '-115 to -105' },
        { min: -105, max: -98, label: '-105 to -98' },
        { min: -98, max: -92, label: '-98 to -92' },
        { min: -92, max: -85, label: '-92 to -85' },
        { min: -85, max: Number.POSITIVE_INFINITY, label: '>=-85 dBm' },
      ]
    case 'signal_rsrq':
      return [
        { min: Number.NEGATIVE_INFINITY, max: -15, label: '<-15 dB' },
        { min: -15, max: -12, label: '-15 to -12' },
        { min: -12, max: -10, label: '-12 to -10' },
        { min: -10, max: -8, label: '-10 to -8' },
        { min: -8, max: -6, label: '-8 to -6' },
        { min: -6, max: Number.POSITIVE_INFINITY, label: '>=-6 dB' },
      ]
    case 'signal_disnr':
    case 'signal_uisnr':
      return [
        { min: Number.NEGATIVE_INFINITY, max: 0, label: '<0 dB' },
        { min: 0, max: 5, label: '0-4.9 dB' },
        { min: 5, max: 10, label: '5-9.9 dB' },
        { min: 10, max: 15, label: '10-14.9 dB' },
        { min: 15, max: 20, label: '15-19.9 dB' },
        { min: 20, max: Number.POSITIVE_INFINITY, label: '>=20 dB' },
      ]
    case 'signal_cqi':
      return [
        { min: Number.NEGATIVE_INFINITY, max: 4, label: '<4' },
        { min: 4, max: 7, label: '4-6' },
        { min: 7, max: 10, label: '7-9' },
        { min: 10, max: 12, label: '10-11' },
        { min: 12, max: Number.POSITIVE_INFINITY, label: '>=12' },
      ]
    case 'throughput_dl_mbps':
      return [
        { min: 0, max: 10, label: '0-9.9 Mbps' },
        { min: 10, max: 25, label: '10-24.9 Mbps' },
        { min: 25, max: 50, label: '25-49.9 Mbps' },
        { min: 50, max: 80, label: '50-79.9 Mbps' },
        { min: 80, max: Number.POSITIVE_INFINITY, label: '>=80 Mbps' },
      ]
    case 'throughput_ul_mbps':
      return [
        { min: 0, max: 3, label: '0-2.9 Mbps' },
        { min: 3, max: 8, label: '3-7.9 Mbps' },
        { min: 8, max: 15, label: '8-14.9 Mbps' },
        { min: 15, max: 25, label: '15-24.9 Mbps' },
        { min: 25, max: Number.POSITIVE_INFINITY, label: '>=25 Mbps' },
      ]
    case 'packet_ota_delay_ms':
      return [
        { min: 0, max: 20, label: '<20 ms' },
        { min: 20, max: 40, label: '20-39 ms' },
        { min: 40, max: 60, label: '40-59 ms' },
        { min: 60, max: 90, label: '60-89 ms' },
        { min: 90, max: Number.POSITIVE_INFINITY, label: '>=90 ms' },
      ]
    default:
      return [{ min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY, label: 'All values' }]
  }
}

export type KpiStateBand = 'meetsTarget' | 'nearBreach' | 'breached'

/**
 * Per-session / per-pixel thresholds — tighter than cell cohort totals so a single
 * bad session reads as warning or bad on the map (e.g. RLF 3–4 is not "good").
 */
export const SESSION_KPI_THRESHOLDS: Partial<Record<KpiId, KpiThresholds>> = {
  connectivity_attach_success_pct: { good: 96, warning: 90 },
  connectivity_nr_rrc_setup_success_pct: { good: 96, warning: 90 },
  reliability_rlf_count: { good: 1, warning: 3 },
  reliability_x2_xn1_setup_success_pct: { good: 96, warning: 90 },
  reliability_5g_ho_success_pct: { good: 95, warning: 88 },
  reliability_irat_hos: { good: 0, warning: 1 },
  signal_rsrp: { good: -98, warning: -108 },
  signal_rsrq: { good: -11, warning: -15 },
  signal_disnr: { good: 10, warning: 6 },
  signal_uisnr: { good: 9, warning: 5 },
  signal_bler: { good: 1.5, warning: 3.5 },
  signal_cqi: { good: 9, warning: 6 },
  throughput_dl_mbps: { good: 35, warning: 18 },
  throughput_ul_mbps: { good: 10, warning: 5 },
  packet_ota_delay_ms: { good: 35, warning: 55 },
  packet_ota_drops: { good: 1, warning: 3 },
}

function bandFromThresholds(
  direction: KpiDirection,
  value: number,
  thresholds: KpiThresholds,
): KpiStateBand {
  if (direction === 'higher_is_better') {
    if (value >= thresholds.good) return 'meetsTarget'
    if (value >= thresholds.warning) return 'nearBreach'
    return 'breached'
  }
  if (value <= thresholds.good) return 'meetsTarget'
  if (value <= thresholds.warning) return 'nearBreach'
  return 'breached'
}

/** KPI band for one session row or map pixel (not cell-level aggregates). */
export function sessionKpiBand(kpiId: KpiId, value: number): KpiStateBand {
  const meta = KPI_BY_ID[kpiId]
  const thresholds = SESSION_KPI_THRESHOLDS[kpiId] ?? meta.thresholds
  if (!thresholds) return 'nearBreach'
  return bandFromThresholds(meta.direction, value, thresholds)
}
