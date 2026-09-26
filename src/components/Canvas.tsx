import { useCallback, useRef, useState } from 'react'
import type { Diagram, NearestResult, Site } from '../lib/voronoi'
import { ratToNumber } from '../lib/rat'

interface CanvasProps {
  diagram: Diagram
  sites: Site[]
  selectedId: string | null
  query: NearestResult | null
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => boolean
  onQuery: (x: number, y: number) => void
}

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
  '#ec4899', '#f43f5e', '#84cc16', '#10b981', '#0ea5e9',
]

/** 颜色只由 id 决定，拖动/重排不会串色 */
export function colorForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** 屏幕像素 → SVG 模型坐标（viewBox 坐标系），与缩放完全解耦 */
function toModel(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
  return { x: pt.x, y: pt.y }
}

export function Canvas({
  diagram,
  sites,
  selectedId,
  query,
  onSelect,
  onMove,
  onQuery,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const dragStart = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null)

  const clampInt = (x: number, y: number) => ({
    x: Math.max(0, Math.min(diagram.width, Math.round(x))),
    y: Math.max(0, Math.min(diagram.height, Math.round(y))),
  })

  const hitTest = useCallback(
    (mx: number, my: number): string | null => {
      const svg = svgRef.current
      if (!svg) return null
      // 命中半径按屏幕 9px 换算回模型单位
      const rect = svg.getBoundingClientRect()
      const radius = (9 * diagram.width) / rect.width
      let best: string | null = null
      let bestD = Infinity
      for (const s of sites) {
        const d = (s.x - mx) ** 2 + (s.y - my) ** 2
        if (d <= radius * radius && d < bestD) {
          best = s.id
          bestD = d
        }
      }
      return best
    },
    [sites, diagram.width],
  )

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    svg.setPointerCapture(e.pointerId)
    const m = toModel(svg, e.clientX, e.clientY)
    const hit = hitTest(m.x, m.y)
    if (hit) {
      const site = sites.find((s) => s.id === hit)!
      setDragId(hit)
      onSelect(hit)
      dragStart.current = { px: e.clientX, py: e.clientY, x: site.x, y: site.y, moved: false }
    } else {
      dragStart.current = { px: e.clientX, py: e.clientY, x: m.x, y: m.y, moved: false }
    }
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    const drag = dragStart.current
    if (!svg || !drag || !dragId) return
    if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) < 3) return
    drag.moved = true
    const m = toModel(svg, e.clientX, e.clientY)
    const p = clampInt(m.x, m.y)
    onMove(dragId, p.x, p.y) // App 负责拒绝重合/越界
  }

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    const drag = dragStart.current
    if (svg && drag && !drag.moved) {
      if (dragId) {
        // 单击站点：查询点取站点整数坐标（证据中该站点 d²=0）
        const site = sites.find((s) => s.id === dragId)
        if (site) onQuery(site.x, site.y)
      } else {
        // 空白点击：吸附到整数查询点求最近站点
        const m = toModel(svg, e.clientX, e.clientY)
        const p = clampInt(m.x, m.y)
        onQuery(p.x, p.y)
      }
    }
    setDragId(null)
    dragStart.current = null
  }

  const { width: w, height: h } = diagram
  const markerR = Math.max(w, h) / 110
  const fontSize = Math.max(w, h) / 42

  return (
    <div className="canvas-wrap" style={{ aspectRatio: `${w} / ${h}` }}>
      <svg
        ref={svgRef}
        className="canvas"
        viewBox={`0 0 ${w} ${h}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* 单元多边形：顶点坐标是精确分数，邻接边共享同一组分数坐标，
            无论怎么缩放都不会出现裂缝或重叠 */}
        {diagram.cells.map((cell) => {
          const points = cell.vertices
            .map((v) => `${ratToNumber(v.x)},${ratToNumber(v.y)}`)
            .join(' ')
          const isWinner = query?.siteId === cell.site.id
          return (
            <polygon
              key={cell.site.id}
              points={points}
              fill={colorForId(cell.site.id)}
              fillOpacity={isWinner ? 0.42 : 0.16}
              stroke={selectedId === cell.site.id ? '#0f172a' : '#475569'}
              strokeWidth={selectedId === cell.site.id ? 1.6 : 0.7}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}

        {/* 查询点 */}
        {query && (
          <g>
            <line
              x1={query.x - markerR * 1.8} y1={query.y}
              x2={query.x + markerR * 1.8} y2={query.y}
              stroke="#0f172a" strokeWidth={1.2} vectorEffect="non-scaling-stroke"
            />
            <line
              x1={query.x} y1={query.y - markerR * 1.8}
              x2={query.x} y2={query.y + markerR * 1.8}
              stroke="#0f172a" strokeWidth={1.2} vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={query.x} cy={query.y}
              r={markerR * 0.5} fill="#0f172a"
            />
          </g>
        )}

        {/* 站点 */}
        {sites.map((s) => (
          <g key={s.id} style={{ cursor: dragId === s.id ? 'grabbing' : 'grab' }}>
            <circle
              cx={s.x} cy={s.y} r={markerR}
              fill={colorForId(s.id)}
              stroke={selectedId === s.id ? '#0f172a' : '#ffffff'}
              strokeWidth={selectedId === s.id ? 2 : 1.4}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={s.x + markerR * 1.4}
              y={s.y - markerR * 1.4}
              fontSize={fontSize}
              className="site-label"
            >
              {s.id}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
