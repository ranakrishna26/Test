import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ALL_SUBSCRIBER_FILTERS } from '../../utils/filterPresets'
import {
  CELLS,
  cellById,
  mapCellSummaryLines,
  neighborSet,
  subscriberFootprint,
  type Cell,
  type SubscriberGlobalFilters,
} from '../../data/placeholderNetwork'

type MapMode = 'all' | 'cellFocus' | 'subscriberFocus'

type ViewBox = { x: number; y: number; w: number; h: number }

type Props = {
  mode: MapMode
  selectedCellId: string | null
  subscriberImsi: string | null
  /** When in subscriber session view, cell used to filter the session table (map sync). */
  sessionTableCellFilter?: string | null
  showHoverKpis: boolean
  /** Compact embedded map (subscriber session view) */
  embed?: 'full' | 'compact'
  /** Global filters for map tooltips (must match cell table / drill-down). */
  subscriberGlobalFilters?: SubscriberGlobalFilters
  onCellSelect?: (cellId: string) => void
  /** Click on map canvas outside cells (e.g. clears session table cell filter). */
  onMapBackgroundClick?: () => void
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function viewBoxForCellIds(ids: Set<string>): ViewBox {
  if (ids.size >= CELLS.length) return { x: 0, y: 0, w: 100, h: 100 }
  if (ids.size === 0) return { x: 0, y: 0, w: 100, h: 100 }
  const cells = CELLS.filter((c) => ids.has(c.id))
  if (cells.length === 0) return { x: 0, y: 0, w: 100, h: 100 }
  const pad = 8
  const label = 9
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of cells) {
    minX = Math.min(minX, c.mapX - 6)
    maxX = Math.max(maxX, c.mapX + 6)
    minY = Math.min(minY, c.mapY - 6)
    maxY = Math.max(maxY, c.mapY + label)
  }
  let x = minX - pad
  let y = minY - pad
  let w = maxX - minX + pad * 2
  let h = maxY - minY + pad * 2
  w = clamp(w, 18, 100)
  h = clamp(h, 18, 100)
  x = clamp(x, 0, 100 - w)
  y = clamp(y, 0, 100 - h)
  return { x, y, w, h }
}

function zoomAroundPoint(
  vb: ViewBox,
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  factor: number,
): ViewBox {
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return vb
  const fx = clamp((clientX - rect.left) / rect.width, 0, 1)
  const fy = clamp((clientY - rect.top) / rect.height, 0, 1)
  const focusX = vb.x + fx * vb.w
  const focusY = vb.y + fy * vb.h
  const newW = clamp(vb.w * factor, 12, 100)
  const newH = clamp(vb.h * factor, 12, 100)
  let nx = focusX - fx * newW
  let ny = focusY - fy * newH
  nx = clamp(nx, 0, 100 - newW)
  ny = clamp(ny, 0, 100 - newH)
  return { x: nx, y: ny, w: newW, h: newH }
}

export function OperatorMap({
  mode,
  selectedCellId,
  subscriberImsi,
  sessionTableCellFilter,
  showHoverKpis: _showHoverKpis,
  embed = 'full',
  subscriberGlobalFilters,
  onCellSelect,
  onMapBackgroundClick,
}: Props) {
  void _showHoverKpis
  const compact = embed === 'compact'
  const filters = subscriberGlobalFilters ?? ALL_SUBSCRIBER_FILTERS

  const svgRef = useRef<SVGSVGElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const viewBoxRef = useRef<ViewBox>({ x: 0, y: 0, w: 100, h: 100 })

  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, w: 100, h: 100 })

  useLayoutEffect(() => {
    viewBoxRef.current = viewBox
  }, [viewBox])

  const [hover, setHover] = useState<{
    cell: Cell
    left: number
    top: number
  } | null>(null)

  const { direct, all } = useMemo(
    () =>
      subscriberImsi
        ? subscriberFootprint(subscriberImsi)
        : { direct: new Set<string>(), all: new Set<string>() },
    [subscriberImsi],
  )

  const neighborLinks = useMemo(() => {
    const seen = new Set<string>()
    const lines: {
      x1: number
      y1: number
      x2: number
      y2: number
      key: string
      idA: string
      idB: string
    }[] = []
    for (const a of CELLS) {
      for (const nid of a.neighborIds) {
        const b = cellById(nid)
        if (!b) continue
        const key = [a.id, b.id].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)
        lines.push({
          key,
          idA: a.id,
          idB: b.id,
          x1: a.mapX,
          y1: a.mapY,
          x2: b.mapX,
          y2: b.mapY,
        })
      }
    }
    return lines
  }, [])

  const layer = useCallback(
    (cellId: string): 'primary' | 'secondary' | 'faded' => {
      if (mode === 'all') return 'primary'

      if (mode === 'cellFocus' && selectedCellId) {
        const n = neighborSet(selectedCellId)
        if (cellId === selectedCellId) return 'primary'
        if (n.has(cellId)) return 'secondary'
        return 'faded'
      }

      if (mode === 'subscriberFocus' && subscriberImsi && all.size) {
        if (direct.has(cellId)) return 'primary'
        if (all.has(cellId)) return 'secondary'
        return 'faded'
      }

      return 'primary'
    },
    [mode, selectedCellId, subscriberImsi, direct, all],
  )

  const fitIds = useMemo(() => {
    if (mode === 'all') return new Set(CELLS.map((c) => c.id))
    if (mode === 'cellFocus' && selectedCellId) return neighborSet(selectedCellId)
    if (mode === 'subscriberFocus' && all.size) return all
    return new Set(CELLS.map((c) => c.id))
  }, [mode, selectedCellId, all])

  useEffect(() => {
    startTransition(() => {
      setViewBox(viewBoxForCellIds(fitIds))
    })
  }, [fitIds])

  const resetView = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: 100, h: 100 })
  }, [])

  const fitView = useCallback(() => {
    setViewBox(viewBoxForCellIds(fitIds))
  }, [fitIds])

  const zoomStep = useCallback((inOrOut: 'in' | 'out') => {
    const el = svgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const factor = inOrOut === 'in' ? 0.82 : 1 / 0.82
    setViewBox((vb) => zoomAroundPoint(vb, el, cx, cy, factor))
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const zoomOut = e.deltaY > 0
      const factor = zoomOut ? 1.07 : 1 / 1.07
      setViewBox((vb) => zoomAroundPoint(vb, el, e.clientX, e.clientY, factor))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    let start: { cx: number; cy: number; vb: ViewBox } | null = null

    const onPointerDown = (e: PointerEvent) => {
      if (!e.altKey || e.button !== 0) return
      e.preventDefault()
      start = { cx: e.clientX, cy: e.clientY, vb: { ...viewBoxRef.current } }
      svg.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!start) return
      const rect = svg.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const dx = e.clientX - start.cx
      const dy = e.clientY - start.cy
      const vb0 = start.vb
      const nx = clamp(vb0.x - (dx / rect.width) * vb0.w, 0, 100 - vb0.w)
      const ny = clamp(vb0.y - (dy / rect.height) * vb0.h, 0, 100 - vb0.h)
      const next = { x: nx, y: ny, w: vb0.w, h: vb0.h }
      setViewBox(next)
      start = { cx: e.clientX, cy: e.clientY, vb: next }
    }

    const endPan = (e: PointerEvent) => {
      if (start) {
        try {
          svg.releasePointerCapture(e.pointerId)
        } catch {
          /* not captured */
        }
        start = null
      }
    }

    svg.addEventListener('pointerdown', onPointerDown)
    svg.addEventListener('pointermove', onPointerMove)
    svg.addEventListener('pointerup', endPan)
    svg.addEventListener('pointercancel', endPan)
    return () => {
      svg.removeEventListener('pointerdown', onPointerDown)
      svg.removeEventListener('pointermove', onPointerMove)
      svg.removeEventListener('pointerup', endPan)
      svg.removeEventListener('pointercancel', endPan)
    }
  }, [])

  const legendText = useMemo(() => {
    if (mode === 'all') return 'All sectors · click a cell or table row to open subscribers'
    if (mode === 'cellFocus') return 'Blue = selected · gray = neighbour · faded = other · map or table drives the same cell'
    if (sessionTableCellFilter)
      return 'Subscriber footprint · hover for KPIs · cell click filters sessions · empty area shows all sessions'
    return 'Subscriber footprint · hover for KPIs · click a cell to filter sessions on that cell'
  }, [mode, sessionTableCellFilter])

  function updateHoverFromEvent(cell: Cell, e: React.MouseEvent) {
    const shell = shellRef.current
    if (!shell) return
    const r = shell.getBoundingClientRect()
    setHover({
      cell,
      left: clamp(e.clientX - r.left + 12, 8, r.width - 168),
      top: clamp(e.clientY - r.top + 12, 8, r.height - 130),
    })
  }

  const vbString = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`

  return (
    <div className={`map-shell ${compact ? 'map-shell--embed' : ''}`} ref={shellRef}>
      <div className={`map-toolbar ${compact ? 'map-toolbar--embed' : ''}`}>
        <span className="map-toolbar-title">{compact ? 'Map' : 'RAN footprint'}</span>
        <div className="map-toolbar-actions">
          <button type="button" className="map-tool-btn" title="Zoom in" onClick={() => zoomStep('in')}>
            +
          </button>
          <button type="button" className="map-tool-btn" title="Zoom out" onClick={() => zoomStep('out')}>
            −
          </button>
          <button type="button" className="map-tool-btn" title="Fit current focus" onClick={fitView}>
            Fit
          </button>
          <button type="button" className="map-tool-btn" title="Reset zoom & pan" onClick={resetView}>
            Reset
          </button>
        </div>
      </div>

      <div className="map-svg-wrap">
        <svg
          ref={svgRef}
          className="map-svg"
          viewBox={vbString}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Radio network cell map. Use wheel to zoom, Alt drag to pan."
        >
          <defs>
            <pattern id="map-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="var(--map-grid)"
                strokeWidth="0.12"
                opacity="0.5"
              />
            </pattern>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="url(#map-grid)" pointerEvents="none" />
          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            fill="transparent"
            className="map-sky-catcher"
            onClick={(e) => {
              e.stopPropagation()
              onMapBackgroundClick?.()
            }}
          />

          {neighborLinks.map((ln) => {
            const dim = layer(ln.idA) === 'faded' && layer(ln.idB) === 'faded'
            return (
              <line
                key={ln.key}
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2}
                y2={ln.y2}
                className={`map-link ${dim ? 'faded' : ''}`}
                pointerEvents="none"
              />
            )
          })}

          {CELLS.map((c) => {
            const lyr = layer(c.id)
            const title = mapCellSummaryLines(c, filters).join('\n')
            const selected =
              mode === 'cellFocus' && selectedCellId === c.id ? ' map-cell--selected' : ''
            const sessionFilterRing =
              mode === 'subscriberFocus' && sessionTableCellFilter === c.id
                ? ' map-cell--session-filter'
                : ''
            return (
              <g
                key={c.id}
                className={`map-cell map-cell--${lyr}${selected}${sessionFilterRing}`}
                transform={`translate(${c.mapX},${c.mapY})`}
                onClick={(e) => {
                  if (e.altKey) return
                  e.stopPropagation()
                  onCellSelect?.(c.id)
                }}
                onMouseEnter={(e) => updateHoverFromEvent(c, e)}
                onMouseMove={(e) => updateHoverFromEvent(c, e)}
                onMouseLeave={() => setHover(null)}
                role={onCellSelect ? 'button' : undefined}
                tabIndex={onCellSelect ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onCellSelect && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onCellSelect(c.id)
                  }
                }}
              >
                <title>{title}</title>
                <circle className="map-cell-hit" r="6" />
                {selected ? <circle className="map-selected-ring" r="7.5" /> : null}
                {sessionFilterRing ? (
                  <circle className="map-session-filter-ring" r="8.2" />
                ) : null}
                <polygon className="map-sector" points="0,-5 4.2,2.6 -4.2,2.6" />
                <text y="9" className="map-cell-name" textAnchor="middle">
                  {c.name}
                </text>
                <text y="12.5" className="map-cell-id" textAnchor="middle">
                  {c.id}
                </text>
              </g>
            )
          })}
        </svg>

        {hover && (
          <div
            className="map-hover-card"
            style={{ left: hover.left, top: hover.top }}
            role="tooltip"
          >
            <ul className="map-hover-list">
              {mapCellSummaryLines(hover.cell, filters).map((line, i) => (
                <li key={`${hover.cell.id}-${i}`}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={`map-footer ${compact ? 'map-footer--embed' : ''}`}>
        <span className="map-legend">{legendText}</span>
        {!compact && (
          <span className="map-hint">Wheel zoom · Alt+drag pan · Enter selects focused cell</span>
        )}
      </div>
    </div>
  )
}
