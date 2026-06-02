/**
 * Session inspector: for each global KPI lens, which other KPIs are shown as correlated.
 * Aligned with operator correlation guidance (attach ↔ RRC ↔ RF ↔ mobility ↔ throughput ↔ OTA).
 *
 * DL/UL SINR in the product map to `signal_disnr` / `signal_uisnr` (dISNR / uISNR in synthetic data).
 */
import { KPI_BY_ID, sessionKpiBand, type KpiId, type KpiStateBand } from './kpis'

/** KPIs correlated with the lens (lens itself omitted in `correlatedKpiIdsForLens`). */
const CORRELATED_BY_LENS: Record<KpiId, readonly KpiId[]> = {
  connectivity_attach_success_pct: [
    'connectivity_nr_rrc_setup_success_pct',
    'signal_rsrp',
    'signal_rsrq',
    'signal_disnr',
    'signal_uisnr',
    'reliability_rlf_count',
  ],
  connectivity_nr_rrc_setup_success_pct: [
    'connectivity_attach_success_pct',
    'signal_rsrp',
    'signal_rsrq',
    'signal_disnr',
    'signal_uisnr',
    'signal_bler',
    'signal_cqi',
  ],
  reliability_rlf_count: [
    'signal_rsrp',
    'signal_rsrq',
    'signal_disnr',
    'signal_uisnr',
    'signal_bler',
    'signal_cqi',
    'reliability_5g_ho_success_pct',
    'packet_ota_drops',
  ],
  reliability_x2_xn1_setup_success_pct: [
    'reliability_5g_ho_success_pct',
    'reliability_irat_hos',
    'signal_rsrp',
    'signal_rsrq',
    'signal_disnr',
    'signal_uisnr',
  ],
  reliability_5g_ho_success_pct: [
    'reliability_x2_xn1_setup_success_pct',
    'reliability_irat_hos',
    'signal_rsrp',
    'signal_rsrq',
    'signal_disnr',
    'signal_uisnr',
    'reliability_rlf_count',
  ],
  reliability_irat_hos: [
    'reliability_5g_ho_success_pct',
    'reliability_x2_xn1_setup_success_pct',
    'signal_rsrp',
    'signal_rsrq',
    'signal_disnr',
    'signal_uisnr',
    'throughput_dl_mbps',
    'throughput_ul_mbps',
  ],
  signal_rsrp: [
    'signal_rsrq',
    'signal_disnr',
    'signal_uisnr',
    'signal_cqi',
    'throughput_dl_mbps',
    'throughput_ul_mbps',
    'reliability_5g_ho_success_pct',
    'reliability_rlf_count',
  ],
  signal_rsrq: [
    'signal_rsrp',
    'signal_disnr',
    'signal_uisnr',
    'signal_bler',
    'signal_cqi',
    'throughput_dl_mbps',
    'throughput_ul_mbps',
    'reliability_5g_ho_success_pct',
  ],
  signal_disnr: [
    'signal_rsrq',
    'signal_cqi',
    'signal_bler',
    'throughput_dl_mbps',
    'packet_ota_delay_ms',
    'packet_ota_drops',
  ],
  signal_uisnr: [
    'signal_rsrq',
    'signal_bler',
    'throughput_ul_mbps',
    'packet_ota_delay_ms',
    'packet_ota_drops',
  ],
  signal_bler: [
    'signal_disnr',
    'signal_uisnr',
    'signal_cqi',
    'throughput_dl_mbps',
    'throughput_ul_mbps',
    'packet_ota_delay_ms',
    'packet_ota_drops',
  ],
  signal_cqi: [
    'signal_disnr',
    'signal_uisnr',
    'signal_rsrp',
    'signal_rsrq',
    'signal_bler',
    'throughput_dl_mbps',
  ],
  throughput_dl_mbps: [
    'signal_rsrp',
    'signal_rsrq',
    'signal_disnr',
    'signal_cqi',
    'signal_bler',
    'packet_ota_delay_ms',
    'packet_ota_drops',
  ],
  throughput_ul_mbps: [
    'signal_uisnr',
    'signal_rsrq',
    'signal_bler',
    'packet_ota_delay_ms',
    'packet_ota_drops',
  ],
  packet_ota_delay_ms: [
    'throughput_dl_mbps',
    'throughput_ul_mbps',
    'signal_bler',
    'signal_disnr',
    'signal_uisnr',
    'packet_ota_drops',
  ],
  packet_ota_drops: [
    'reliability_rlf_count',
    'signal_bler',
    'signal_disnr',
    'signal_uisnr',
    'throughput_dl_mbps',
    'throughput_ul_mbps',
    'packet_ota_delay_ms',
  ],
}

export function correlatedKpiIdsForLens(lensKpiId: KpiId): KpiId[] {
  const list = CORRELATED_BY_LENS[lensKpiId]
  if (!list?.length) return []
  return [...new Set(list)].filter((id) => id !== lensKpiId)
}

function bandSeverity(band: KpiStateBand): number {
  if (band === 'breached') return 2
  if (band === 'nearBreach') return 1
  return 0
}

function bandLabel(band: KpiStateBand): string {
  if (band === 'breached') return 'out of band'
  if (band === 'nearBreach') return 'borderline'
  return 'within target'
}

/**
 * One short sentence from this session’s lens + correlated KPI values (session thresholds).
 */
export function correlatedSessionSummary(lensKpiId: KpiId, valueFor: (id: KpiId) => number): string {
  const lensMeta = KPI_BY_ID[lensKpiId]
  const lensBand = sessionKpiBand(lensKpiId, valueFor(lensKpiId))
  const correlateIds = correlatedKpiIdsForLens(lensKpiId)

  if (correlateIds.length === 0) {
    return `${lensMeta.label} is ${bandLabel(lensBand)} on this session (no correlates configured).`
  }

  const correlateRows = correlateIds.map((id) => ({
    id,
    label: KPI_BY_ID[id].label,
    band: sessionKpiBand(id, valueFor(id)),
  }))
  correlateRows.sort((a, b) => bandSeverity(b.band) - bandSeverity(a.band) || a.label.localeCompare(b.label))

  const stressed = correlateRows.filter((r) => r.band !== 'meetsTarget')
  const worstTwo = stressed.slice(0, 2).map((r) => `${r.label} (${bandLabel(r.band)})`)

  if (lensBand === 'meetsTarget' && stressed.length === 0) {
    return `${lensMeta.label} and correlated metrics are within session targets.`
  }

  if (lensBand !== 'meetsTarget' && stressed.length > 0) {
    const verb = stressed.length === 1 ? 'stands out' : 'stand out'
    return `${lensMeta.label} is ${bandLabel(lensBand)}; among correlates, ${worstTwo.join(' and ')} ${verb}.`
  }

  if (lensBand === 'meetsTarget' && stressed.length > 0) {
    const tail = stressed.length === 1 ? 'suggests related stress' : 'suggest related stress'
    return `${lensMeta.label} is ${bandLabel(lensBand)}, but ${worstTwo.join(' and ')} ${tail}.`
  }

  return `${lensMeta.label} is ${bandLabel(lensBand)}; correlated metrics are within target.`
}

