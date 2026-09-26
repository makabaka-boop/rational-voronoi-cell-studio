import type { Cell, NearestResult } from '../lib/voronoi'
import { ratToNumber, ratToString } from '../lib/rat'
import { colorForId } from './Canvas'

/** 选中单元的精确信息卡片：数据与画布上的多边形来自同一个 Diagram */
export function CellPanel({
  cell,
  onSelect,
}: {
  cell: Cell | null
  onSelect: (id: string) => void
}) {
  if (!cell) {
    return (
      <section className="panel">
        <h2>单元信息</h2>
        <p className="muted">点击站点或单元查看顶点、精确面积与邻接站点。</p>
      </section>
    )
  }
  return (
    <section className="panel">
      <h2>
        <span className="dot" style={{ background: colorForId(cell.site.id) }} />
        站点 {cell.site.id} 的单元
      </h2>
      <dl className="kv">
        <dt>站点坐标</dt>
        <dd>
          ({cell.site.x}, {cell.site.y})
        </dd>

        <dt>精确面积</dt>
        <dd>
          <strong>{ratToString(cell.area)}</strong>
          <span className="muted"> ≈ {ratToNumber(cell.area).toFixed(4)}</span>
        </dd>

        <dt>顶点（精确分数，逆时针）</dt>
        <dd>
          <ol className="vertices">
            {cell.vertices.map((v, i) => (
              <li key={i}>
                ({ratToString(v.x)}, {ratToString(v.y)})
              </li>
            ))}
          </ol>
        </dd>

        <dt>邻接站点（共享正长度边段）</dt>
        <dd>
          {cell.neighbors.length === 0 ? (
            <span className="muted">无</span>
          ) : (
            <div className="chips">
              {cell.neighbors.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="chip"
                  style={{ borderColor: colorForId(n) }}
                  onClick={() => onSelect(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </dd>
      </dl>
    </section>
  )
}

/** 点击查询：命中站点 + 每个站点的平方距离证据 */
export function QueryPanel({ query }: { query: NearestResult | null }) {
  return (
    <section className="panel">
      <h2>边界查询</h2>
      {!query ? (
        <p className="muted">
          在画布空白处点击整数坐标点：归属按平方距离比较；等距时 id 的 ASCII 字节序靠前者胜。
          查询在模型整数坐标系进行，不随 SVG 缩放改变。
        </p>
      ) : (
        <>
          <p>
            查询点 <strong>({query.x}, {query.y})</strong> → 命中{' '}
            <strong style={{ color: colorForId(query.siteId) }}>{query.siteId}</strong>
          </p>
          <table className="evidence">
            <thead>
              <tr>
                <th>站点</th>
                <th>距离证据 Δx²+Δy²</th>
                <th>d²</th>
                <th>判定</th>
              </tr>
            </thead>
            <tbody>
              {query.evidence.map((e) => (
                <tr key={e.siteId} className={e.winner ? 'winner' : ''}>
                  <td>
                    <span className="dot" style={{ background: colorForId(e.siteId) }} />
                    {e.siteId}
                  </td>
                  <td className="mono">
                    ({e.dx >= 0n ? '' : '−'}{abs(e.dx)})²+({e.dy >= 0n ? '' : '−'}
                    {abs(e.dy)})²
                  </td>
                  <td className="mono">{e.d2.toString()}</td>
                  <td>
                    {e.winner
                      ? e.tied
                        ? '◂ 等距，id 字节序胜出'
                        : '◂ 最近'
                      : e.tied
                        ? '并列等距'
                        : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

function abs(v: bigint): string {
  return (v < 0n ? -v : v).toString()
}
