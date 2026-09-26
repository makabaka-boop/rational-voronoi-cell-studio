/**
 * 用有理数半平面裁切构造矩形区域内的 Voronoi 单元。
 *
 * 站点 i 的单元是矩形与一组半平面的交：
 *   对每个其他站点 j，保留“到 i 的平方距离 ≤ 到 j 的平方距离”的一侧。
 * 设 A=(ax,ay)、B=(bx,by)，展开
 *   |p-A|² ≤ |p-B|²
 *   2(B-A)·p + (|A|²-|B|²) ≤ 0
 * 边界即两站等距线（Voronoi 边）。系数全部为整数，交点用 Rat 精确表示。
 */
import {
  Rat,
  RAT_ZERO,
  rat,
  ratAdd,
  ratCmp,
  ratDiv,
  ratEq,
  ratLe,
  ratMul,
  ratSub,
  ratToString,
} from './rat'

export interface Site {
  id: string
  x: number
  y: number
}

export interface Vertex {
  x: Rat
  y: Rat
}

export interface Cell {
  site: Site
  /** 逆时针排列的多边形顶点（坐标为精确分数） */
  vertices: Vertex[]
  /** 精确面积（平方模型单位） */
  area: Rat
  /** 与本单元共享正长度边段的站点 id，按 ASCII 字节序 */
  neighbors: string[]
}

export interface Diagram {
  width: number
  height: number
  cells: Cell[]
  cellsById: Map<string, Cell>
}

/** 按 ASCII 字节（无符号 8 位）逐字节比较；短串是长串的真前缀时短串在前。 */
export function compareAscii(a: string, b: string): -1 | 0 | 1 {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const ca = a.charCodeAt(i)
    const cb = b.charCodeAt(i)
    if (ca !== cb) return ca < cb ? -1 : 1
  }
  if (a.length === b.length) return 0
  return a.length < b.length ? -1 : 1
}

/** f(p) = 2(B-A)·p + (|A|²-|B|²)；f≤0 表示 p 离 A 不比离 B 远。 */
function bisectorValue(a: Site, b: Site, p: Vertex): Rat {
  const px = p.x
  const py = p.y
  const twoDx = rat(2 * (b.x - a.x))
  const twoDy = rat(2 * (b.y - a.y))
  const constTerm = rat(
    a.x * a.x + a.y * a.y - b.x * b.x - b.y * b.y,
  )
  return ratAdd(ratAdd(ratMul(twoDx, px), ratMul(twoDy, py)), constTerm)
}

/** 线段 S→E 与直线 f=0 的交点；仅在两端点一内一外（或恰在界上）时调用。 */
function intersectBoundary(
  s: Vertex,
  e: Vertex,
  fs: Rat,
  fe: Rat,
): Vertex {
  // 参数 t = f(S)/(f(S)-f(E))，交点 = S + t(E-S)
  const t = ratDiv(fs, ratSub(fs, fe))
  return {
    x: ratAdd(s.x, ratMul(t, ratSub(e.x, s.x))),
    y: ratAdd(s.y, ratMul(t, ratSub(e.y, s.y))),
  }
}

function sameVertex(a: Vertex, b: Vertex): boolean {
  return ratEq(a.x, b.x) && ratEq(a.y, b.y)
}

/**
 * Sutherland–Hodgman：用半平面 f_A,B(p) ≤ 0 裁切凸多边形。
 * 规则包含边界（≤），因此等距线上的点同时属于两侧单元的闭包，
 * 两单元共享的是同一条精确线段，而不是各自猜出来的像素折线。
 */
function clipHalfPlane(poly: Vertex[], a: Site, b: Site): Vertex[] {
  if (poly.length === 0) return poly
  const out: Vertex[] = []
  const pushUnique = (v: Vertex) => {
    const last = out[out.length - 1]
    if (!last || !sameVertex(last, v)) out.push(v)
  }

  for (let i = 0; i < poly.length; i++) {
    const s = poly[i]
    const e = poly[(i + 1) % poly.length]
    const fs = bisectorValue(a, b, s)
    const fe = bisectorValue(a, b, e)
    const sInside = ratLe(fs, RAT_ZERO)
    const eInside = ratLe(fe, RAT_ZERO)

    if (sInside && eInside) {
      pushUnique(e)
    } else if (sInside && !eInside) {
      pushUnique(intersectBoundary(s, e, fs, fe))
    } else if (!sInside && eInside) {
      pushUnique(intersectBoundary(s, e, fs, fe))
      pushUnique(e)
    }
  }

  // 首尾可能因绕环闭合而重复
  if (out.length >= 2 && sameVertex(out[0], out[out.length - 1])) out.pop()
  return out
}

function rectangle(w: number, h: number): Vertex[] {
  return [
    { x: rat(0), y: rat(0) },
    { x: rat(w), y: rat(0) },
    { x: rat(w), y: rat(h) },
    { x: rat(0), y: rat(h) },
  ]
}

/** 鞋带公式：面积 = |Σ(x_k y_{k+1} - x_{k+1} y_k)| / 2，结果仍是精确分数。 */
function polygonArea(vertices: Vertex[]): Rat {
  let twice = RAT_ZERO
  for (let i = 0; i < vertices.length; i++) {
    const p = vertices[i]
    const q = vertices[(i + 1) % vertices.length]
    twice = ratAdd(twice, ratSub(ratMul(p.x, q.y), ratMul(q.x, p.y)))
  }
  const area = ratDiv(twice, rat(2))
  return area[0] < 0n ? [-area[0], area[1]] : area
}

/**
 * 构造整张图。站点按 ASCII 字节序处理，保证裁切顺序与输出完全确定。
 */
export function buildDiagram(
  width: number,
  height: number,
  inputSites: Site[],
): Diagram {
  const sites = [...inputSites].sort((p, q) => compareAscii(p.id, q.id))
  const cells: Cell[] = []

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i]
    let poly = rectangle(width, height)
    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue
      poly = clipHalfPlane(poly, site, sites[j])
    }

    // 邻接判定：j 的等距线若包含单元上 ≥2 个不同顶点，则必有正长度边段
    // 落在该线上（单元是凸的，两点之间全部属于单元闭包）。
    const neighbors: string[] = []
    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue
      let onLine = 0
      let firstOn: Vertex | null = null
      for (const v of poly) {
        if (ratEq(bisectorValue(site, sites[j], v), RAT_ZERO)) {
          if (firstOn && sameVertex(firstOn, v)) continue
          if (!firstOn) firstOn = v
          onLine++
        }
      }
      if (onLine >= 2) neighbors.push(sites[j].id)
    }

    cells.push({
      site,
      vertices: poly,
      area: polygonArea(poly),
      neighbors,
    })
  }

  return {
    width,
    height,
    cells,
    cellsById: new Map(cells.map((c) => [c.site.id, c])),
  }
}

export interface DistanceEvidence {
  siteId: string
  /** 查询点与站点的坐标差 */
  dx: bigint
  dy: bigint
  /** 平方欧氏距离（整数，点与站点均为整数坐标时精确） */
  d2: bigint
  winner: boolean
  /** 与胜者距离相等（平分线上），id 字节序决定归属 */
  tied: boolean
}

export interface NearestResult {
  x: number
  y: number
  siteId: string
  evidence: DistanceEvidence[]
}

/**
 * 最近站点查询：整数坐标点上全程 bigint 平方距离比较，
 * 等距时按站点 id 的 ASCII 字节序取靠前者。SVG 缩放只改变显示，
 * 查询始终在模型整数坐标系进行，归属不会因缩放改变。
 */
export function nearestSite(
  sites: Site[],
  x: number,
  y: number,
): NearestResult {
  const px = BigInt(x)
  const py = BigInt(y)
  const scored = sites.map((s) => {
    const dx = px - BigInt(s.x)
    const dy = py - BigInt(s.y)
    return { siteId: s.id, dx, dy, d2: dx * dx + dy * dy }
  })

  let best = scored[0]
  for (const row of scored.slice(1)) {
    if (row.d2 < best.d2) best = row
    else if (row.d2 === best.d2 && compareAscii(row.siteId, best.siteId) < 0) {
      best = row
    }
  }

  const evidence: DistanceEvidence[] = scored
    .map((row) => ({
      ...row,
      winner: row.siteId === best.siteId,
      tied: row.d2 === best.d2,
    }))
    .sort((a, b) =>
      a.d2 === b.d2
        ? compareAscii(a.siteId, b.siteId)
        : a.d2 < b.d2
          ? -1
          : 1,
    )

  return { x, y, siteId: best.siteId, evidence }
}

/** 输入校验：返回错误信息数组（空数组表示合法）。 */
export function validateSpec(
  width: number,
  height: number,
  sites: Site[],
): string[] {
  const errors: string[] = []
  const isInt1000 = (n: number) => Number.isInteger(n) && n >= 100 && n <= 1000
  if (!isInt1000(width)) errors.push('宽度必须是 100～1000 的整数')
  if (!isInt1000(height)) errors.push('高度必须是 100～1000 的整数')

  if (sites.length < 2) errors.push('至少需要 2 个站点')
  if (sites.length > 30) errors.push('最多 30 个站点')

  const seenIds = new Set<string>()
  const coords = new Set<string>()
  for (const s of sites) {
    if (s.id.length === 0) {
      errors.push('存在空站点 id')
      continue
    }
    if (![...s.id].every((ch) => {
      const c = ch.charCodeAt(0)
      return c >= 33 && c <= 126 // 可打印 ASCII，不含空白
    })) {
      errors.push(`站点 id「${s.id}」只能使用非空白 ASCII 字符`)
    }
    if (seenIds.has(s.id)) errors.push(`站点 id「${s.id}」重复`)
    seenIds.add(s.id)

    if (!Number.isInteger(s.x) || !Number.isInteger(s.y)) {
      errors.push(`站点「${s.id}」坐标必须为整数`)
    } else {
      if (isInt1000(width) && (s.x < 0 || s.x > width)) {
        errors.push(`站点「${s.id}」x=${s.x} 超出区域 [0, ${width}]`)
      }
      if (isInt1000(height) && (s.y < 0 || s.y > height)) {
        errors.push(`站点「${s.id}」y=${s.y} 超出区域 [0, ${height}]`)
      }
      const key = `${s.x},${s.y}`
      if (coords.has(key)) errors.push(`坐标 (${key}) 重合，已被其他站点占用`)
      coords.add(key)
    }
  }
  return errors
}

/** 顶点的精确坐标文本，如 "3/2, 100" */
export function vertexToString(v: Vertex): string {
  return `${ratToString(v.x)}, ${ratToString(v.y)}`
}

/** 测试/调试用：有理数符号比较包装 */
export function isZero(r: Rat): boolean {
  return ratCmp(r, RAT_ZERO) === 0
}
