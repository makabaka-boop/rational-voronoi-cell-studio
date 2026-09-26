import { useEffect, useState } from 'react'
import type { Site } from '../lib/voronoi'
import { colorForId } from './Canvas'

interface SitePanelProps {
  sites: Site[]
  width: number
  height: number
  selectedId: string | null
  blocked: string | null
  onSelect: (id: string) => void
  onAdd: (s: Site) => boolean
  onUpdate: (id: string, x: number, y: number) => boolean
  onDelete: (id: string) => void
}

export function SitePanel({
  sites,
  width,
  height,
  selectedId,
  blocked,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
}: SitePanelProps) {
  const [id, setId] = useState('')
  const [x, setX] = useState('0')
  const [y, setY] = useState('0')
  const [err, setErr] = useState<string | null>(null)

  const add = () => {
    const xx = Number(x)
    const yy = Number(y)
    if (!id.trim()) return setErr('id 不能为空')
    if (!/^[\x21-\x7e]+$/.test(id)) return setErr('id 只能使用非空白 ASCII 字符')
    if (!Number.isInteger(xx) || !Number.isInteger(yy) || xx < 0 || xx > width || yy < 0 || yy > height) {
      return setErr(`坐标必须是 [0,${width}] × [0,${height}] 内的整数`)
    }
    if (sites.length >= 30) return setErr('最多 30 个站点')
    if (!onAdd({ id, x: xx, y: yy })) return setErr(`无法添加：id 重复或坐标 (${xx},${yy}) 已被占用`)
    setId('')
    setX('0')
    setY('0')
    setErr(null)
  }

  return (
    <section className="panel">
      <h2>站点（{sites.length}/30）</h2>
      {blocked && <p className="warn">⚠ {blocked}</p>}
      <table className="sites">
        <thead>
          <tr>
            <th>id</th>
            <th>x</th>
            <th>y</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr
              key={s.id}
              className={s.id === selectedId ? 'selected' : ''}
              onClick={() => onSelect(s.id)}
            >
              <td>
                <span className="dot" style={{ background: colorForId(s.id) }} />
                <span className="mono">{s.id}</span>
              </td>
              <td>
                <IntInput
                  value={s.x}
                  min={0}
                  max={width}
                  onCommit={(v) => onUpdate(s.id, v, s.y)}
                />
              </td>
              <td>
                <IntInput
                  value={s.y}
                  min={0}
                  max={height}
                  onCommit={(v) => onUpdate(s.id, s.x, v)}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="del"
                  disabled={sites.length <= 2}
                  title={sites.length <= 2 ? '至少保留 2 个站点' : '删除'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(s.id)
                  }}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="add-form">
        <input
          placeholder="ASCII id"
          value={id}
          onChange={(e) => setId(e.target.value)}
          size={6}
          maxLength={16}
        />
        <input
          aria-label="x"
          type="number"
          value={x}
          min={0}
          max={width}
          onChange={(e) => setX(e.target.value)}
          size={4}
        />
        <input
          aria-label="y"
          type="number"
          value={y}
          min={0}
          max={height}
          onChange={(e) => setY(e.target.value)}
          size={4}
        />
        <button type="button" onClick={add}>
          添加
        </button>
      </div>
      {err && <p className="warn">{err}</p>}
    </section>
  )
}

function IntInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number
  min: number
  max: number
  onCommit: (v: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)
  // 外部状态（如拖动、删除）变化时同步显示，但不打断正在编辑的输入
  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])
  const commit = () => {
    setFocused(false)
    const v = Number(text)
    if (Number.isInteger(v) && v >= min && v <= max) {
      onCommit(v)
    } else {
      setText(String(value))
    }
  }
  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      size={4}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        e.stopPropagation()
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}
