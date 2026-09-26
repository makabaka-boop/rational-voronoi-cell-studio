import { useMemo, useState } from 'react'
import { Canvas } from './components/Canvas'
import { CellPanel, QueryPanel } from './components/Panels'
import { SitePanel } from './components/SitePanel'
import {
  Diagram,
  NearestResult,
  Site,
  buildDiagram,
  nearestSite,
  validateSpec,
} from './lib/voronoi'
import { RAT_ZERO, ratAdd, ratToString } from './lib/rat'

interface Size {
  width: number
  height: number
}

const DEFAULT_SIZE: Size = { width: 400, height: 260 }

const DEFAULT_SITES: Site[] = [
  { id: 'A', x: 80, y: 70 },
  { id: 'B', x: 300, y: 90 },
  { id: 'C', x: 200, y: 200 },
  { id: 'D', x: 350, y: 230 },
]

export default function App() {
  const [sizeDraft, setSizeDraft] = useState<Size>(DEFAULT_SIZE)
  const [size, setSize] = useState<Size>(DEFAULT_SIZE)
  const [sites, setSites] = useState<Site[]>(DEFAULT_SITES)
  const [selectedId, setSelectedId] = useState<string | null>('A')
  const [query, setQuery] = useState<NearestResult | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)

  const errors = useMemo(
    () => validateSpec(size.width, size.height, sites),
    [size, sites],
  )

  // 图形与列表共用的唯一计算结果
  const diagram: Diagram | null = useMemo(
    () => (errors.length === 0 ? buildDiagram(size.width, size.height, sites) : null),
    [size, sites, errors],
  )

  const flash = (msg: string | null) => {
    setBlocked((cur) => {
      if (cur === msg) return cur
      if (msg) window.setTimeout(() => setBlocked((c) => (c === msg ? null : c)), 2600)
      return msg
    })
  }

  const applySize = () => {
    const { width, height } = sizeDraft
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || width > 1000 || height < 100 || height > 1000) {
      flash('宽高必须是 100～1000 的整数')
      return
    }
    setSize({ width, height })
    // 收缩区域时把越界站点夹回边界
    setSites((prev) => prev.map((s) => ({
      ...s,
      x: Math.min(s.x, width),
      y: Math.min(s.y, height),
    })))
    setQuery(null)
  }

  const occupied = (x: number, y: number, except?: string) =>
    sites.some((s) => s.id !== except && s.x === x && s.y === y)

  const addSite = (s: Site): boolean => {
    if (sites.some((t) => t.id === s.id) || occupied(s.x, s.y)) return false
    setSites((prev) => [...prev, s])
    setSelectedId(s.id)
    return true
  }

  const updateSite = (id: string, x: number, y: number): boolean => {
    if (occupied(x, y, id)) {
      flash(`坐标 (${x},${y}) 已被其他站点占用，已拒绝`)
      return false
    }
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, x, y } : s)))
    return true
  }

  const deleteSite = (id: string) => {
    setSites((prev) => prev.filter((s) => s.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // 画布点击查询：与列表渲染使用同一批站点数据
  const runQuery = (x: number, y: number) => {
    setQuery(nearestSite(sites, x, y))
  }

  // 查询点/选中站点移动后，证据表实时重算，保证图形与文字同源
  const liveQuery = useMemo(() => {
    if (!query) return null
    const next = nearestSite(sites, query.x, query.y)
    return next
  }, [query, sites])

  const selectedCell = diagram && selectedId ? diagram.cellsById.get(selectedId) ?? null : null
  const totalArea = diagram
    ? ratToString(diagram.cells.reduce((acc, c) => ratAdd(acc, c.area), RAT_ZERO))
    : null

  return (
    <div className="app">
      <header className="topbar">
        <h1>Voronoi Cells 站点编辑器</h1>
        <div className="size-form">
          区域
          <label>
            宽
            <input
              type="number" min={100} max={1000}
              value={sizeDraft.width}
              onChange={(e) => setSizeDraft((d) => ({ ...d, width: Number(e.target.value) }))}
            />
          </label>
          <label>
            高
            <input
              type="number" min={100} max={1000}
              value={sizeDraft.height}
              onChange={(e) => setSizeDraft((d) => ({ ...d, height: Number(e.target.value) }))}
            />
          </label>
          <button type="button" onClick={applySize}>应用区域</button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setSize(DEFAULT_SIZE)
              setSizeDraft(DEFAULT_SIZE)
              setSites(DEFAULT_SITES)
              setSelectedId('A')
              setQuery(null)
            }}
          >
            重置示例
          </button>
        </div>
      </header>

      {errors.length > 0 && (
        <div className="errors">
          {errors.map((e, i) => (
            <div key={i}>✗ {e}</div>
          ))}
        </div>
      )}

      <main className="layout">
        <div className="left">
          {diagram ? (
            <>
              <Canvas
                diagram={diagram}
                sites={sites}
                selectedId={selectedId}
                query={liveQuery}
                onSelect={setSelectedId}
                onMove={updateSite}
                onQuery={runQuery}
              />
              <p className="hint">
                拖动站点（吸附整数坐标，重合被拒绝）· 点击空白查询最近站点 ·
                单元边界是精确等距线，缩放无裂缝/重叠 ·
                单元面积合计 = {totalArea}
              </p>
            </>
          ) : (
            <div className="canvas-broken">输入不合法，无法构图</div>
          )}
        </div>
        <aside className="right">
          <SitePanel
            sites={sites}
            width={size.width}
            height={size.height}
            selectedId={selectedId}
            blocked={blocked}
            onSelect={setSelectedId}
            onAdd={addSite}
            onUpdate={updateSite}
            onDelete={deleteSite}
          />
          <CellPanel cell={selectedCell} onSelect={setSelectedId} />
          <QueryPanel query={liveQuery} />
        </aside>
      </main>
    </div>
  )
}
