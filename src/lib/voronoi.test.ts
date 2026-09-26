import { describe, expect, it } from 'vitest'
import {
  Cell,
  Diagram,
  Site,
  Vertex,
  buildDiagram,
  compareAscii,
  nearestSite,
  validateSpec,
} from './voronoi'
import { Rat, rat, ratAdd, ratCmp, ratSub, ratMul, ratToString } from './rat'

// ---- 测试用精确几何工具（与产品代码同样使用有理数） ----

/** 叉积 (B-A) × (P-A)；顶点逆时针排列时内部点恒 ≥ 0 */
function cross(a: Vertex, b: Vertex, p: Vertex): Rat {
  return ratSub(
    ratMul(ratSub(b.x, a.x), ratSub(p.y, a.y)),
    ratMul(ratSub(b.y, a.y), ratSub(p.x, a.x)),
  )
}

function pointInConvex(vertices: Vertex[], p: Vertex): boolean {
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]
    const b = vertices[(i + 1) % vertices.length]
    if (ratCmp(cross(a, b, p), rat(0)) < 0) return false
  }
  return true
}

function build(w: number, h: number, sites: Site[]): Diagram {
  const errors = validateSpecForBuild(w, h, sites)
  expect(errors).toEqual([])
  return buildDiagram(w, h, sites)
}

// 小区域不做 100～1000 的尺寸限制，只检查站点合法性
function validateSpecForBuild(w: number, h: number, sites: Site[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const coords = new Set<string>()
  for (const s of sites) {
    if (ids.has(s.id)) errors.push(`重复 id ${s.id}`)
    ids.add(s.id)
    const key = `${s.x},${s.y}`
    if (coords.has(key)) errors.push(`重合坐标 ${key}`)
    coords.add(key)
    if (s.x < 0 || s.x > w || s.y < 0 || s.y > h) errors.push(`越界 ${key}`)
  }
  return errors
}

/**
 * 穷举区域内每个整数查询点：
 *  - nearestSite 选出的胜者单元必须（闭包）包含该点；
 *  - 所有并列最小距离站点的单元都必须包含该点（等距线共享）；
 *  - 距离更大的站点单元绝不能包含该点（不重不漏）。
 */
function exhaustivelyCheck(diagram: Diagram, sites: Site[]) {
  const { width: w, height: h } = diagram
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x <= w; x++) {
      const p = { x: rat(x), y: rat(y) }
      const result = nearestSite(sites, x, y)
      const winnerCell = diagram.cellsById.get(result.siteId)
      expect(winnerCell, `(${x},${y}) 胜者单元存在`).toBeTruthy()
      expect(
        pointInConvex(winnerCell!.vertices, p),
        `(${x},${y}) 应在胜者 ${result.siteId} 的单元内`,
      ).toBe(true)

      for (const row of result.evidence) {
        const cell = diagram.cellsById.get(row.siteId)!
        const inside = pointInConvex(cell.vertices, p)
        if (row.tied) {
          expect(inside, `(${x},${y}) 等距站点 ${row.siteId} 单元也应包含该点`).toBe(true)
        } else {
          expect(inside, `(${x},${y}) 更远站点 ${row.siteId} 单元不应包含该点`).toBe(false)
        }
      }
    }
  }
}

function expectArea(cell: Cell | undefined, text: string) {
  expect(cell).toBeTruthy()
  expect(ratToString(cell!.area)).toBe(text)
}

function vertexKeys(cell: Cell): Set<string> {
  return new Set(cell.vertices.map((v) => `${ratToString(v.x)}|${ratToString(v.y)}`))
}

// ---- 用例 ----

describe('双站点平分线', () => {
  const sites: Site[] = [
    { id: 'A', x: 1, y: 1 },
    { id: 'B', x: 3, y: 1 },
  ]
  const diagram = build(4, 4, sites)

  it('两单元面积相等且平分矩形', () => {
    expectArea(diagram.cellsById.get('A'), '8')
    expectArea(diagram.cellsById.get('B'), '8')
    expect(diagram.cellsById.get('A')!.neighbors).toEqual(['B'])
    expect(diagram.cellsById.get('B')!.neighbors).toEqual(['A'])
  })

  it('共享边顶点精确为 x=2 的整数坐标', () => {
    const a = vertexKeys(diagram.cellsById.get('A')!)
    const b = vertexKeys(diagram.cellsById.get('B')!)
    for (const key of ['2|0', '2|4']) {
      expect(a.has(key)).toBe(true)
      expect(b.has(key)).toBe(true)
    }
  })

  it('穷举 5×5 整数查询点；等距线上 A 以字节序胜出', () => {
    exhaustivelyCheck(diagram, sites)
    for (let y = 0; y <= 4; y++) {
      const r = nearestSite(sites, 2, y)
      expect(r.siteId).toBe('A')
      expect(r.evidence.filter((e) => e.tied).map((e) => e.siteId).sort()).toEqual(['A', 'B'])
    }
    expect(nearestSite(sites, 0, 0).siteId).toBe('A')
    expect(nearestSite(sites, 4, 4).siteId).toBe('B')
  })

  it('100×100 区域穷举，面积各为 5000', () => {
    const big: Site[] = [
      { id: 'L', x: 20, y: 50 },
      { id: 'R', x: 80, y: 50 },
    ]
    const d = build(100, 100, big)
    expectArea(d.cellsById.get('L'), '5000')
    expectArea(d.cellsById.get('R'), '5000')
    exhaustivelyCheck(d, big)
  }, 30000)

  it('平分线落在半整数坐标时顶点是精确分数', () => {
    const half: Site[] = [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 1, y: 0 },
    ]
    const d = build(3, 3, half)
    const keys = vertexKeys(d.cellsById.get('A')!)
    expect(keys.has('1/2|0')).toBe(true)
    expect(keys.has('1/2|3')).toBe(true)
    expectArea(d.cellsById.get('A'), '3/2')
    exhaustivelyCheck(d, half)
  })
})

describe('共线站点', () => {
  const sites: Site[] = [
    { id: 'A', x: 1, y: 2 },
    { id: 'B', x: 3, y: 2 },
    { id: 'C', x: 5, y: 2 },
  ]
  const diagram = build(6, 4, sites)

  it('两条平分线 x=2、x=4 切出三个等面积矩形条', () => {
    expectArea(diagram.cellsById.get('A'), '8')
    expectArea(diagram.cellsById.get('B'), '8')
    expectArea(diagram.cellsById.get('C'), '8')
  })

  it('邻接只在相邻条之间，A 与 C 仅点/不接触', () => {
    expect(diagram.cellsById.get('A')!.neighbors).toEqual(['B'])
    expect(diagram.cellsById.get('B')!.neighbors).toEqual(['A', 'C'])
    expect(diagram.cellsById.get('C')!.neighbors).toEqual(['B'])
  })

  it('穷举全部整数查询点，等距按字节序', () => {
    exhaustivelyCheck(diagram, sites)
    expect(nearestSite(sites, 2, 0).siteId).toBe('A') // A/B 等距
    expect(nearestSite(sites, 4, 4).siteId).toBe('B') // B/C 等距
  })
})

describe('角落裁切单元', () => {
  const sites: Site[] = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 40, y: 40 },
  ]
  const diagram = build(100, 100, sites)

  it('角站点单元为精确三角形 x+y≤40，面积 800', () => {
    const a = diagram.cellsById.get('A')!
    expect(a.vertices).toHaveLength(3)
    expect(vertexKeys(a)).toEqual(new Set(['0|0', '40|0', '0|40']))
    expectArea(a, '800')
    expect(a.neighbors).toEqual(['B'])
  })

  it('另一单元补满矩形，面积 9200，无裂缝无重叠', () => {
    expectArea(diagram.cellsById.get('B'), '9200')
  })

  it('穷举查询点', () => {
    exhaustivelyCheck(diagram, sites)
    // (20,20) 在等距线上：800 = 400+400
    const tied = nearestSite(sites, 20, 20)
    expect(tied.siteId).toBe('A')
    expect(tied.evidence.every((e) => e.tied)).toBe(true)
  }, 30000)
})

describe('多站点小区域穷举', () => {
  it('四角站点：中心整数点四站点等距', () => {
    const sites: Site[] = [
      { id: 'NW', x: 0, y: 0 },
      { id: 'SE', x: 4, y: 4 },
      { id: 'NE', x: 4, y: 0 },
      { id: 'SW', x: 0, y: 4 },
    ]
    const d = build(4, 4, sites)
    exhaustivelyCheck(d, sites)
    const center = nearestSite(sites, 2, 2)
    expect(center.evidence.every((e) => e.tied)).toBe(true)
    expect(center.siteId).toBe('NE') // 字节序：NE < NW < SE < SW
  })

  it('面积守恒：单元面积之和恒等于矩形面积', () => {
    const configs: Site[][] = [
      [
        { id: 'a', x: 1, y: 1 },
        { id: 'b', x: 4, y: 3 },
      ],
      [
        { id: '1', x: 0, y: 0 },
        { id: '2', x: 3, y: 1 },
        { id: '3', x: 1, y: 4 },
        { id: '4', x: 4, y: 4 },
      ],
      [
        { id: 'x', x: 2, y: 2 },
        { id: 'y', x: 2, y: 5 },
        { id: 'z', x: 5, y: 2 },
        { id: 'w', x: 5, y: 5 },
        { id: 'c', x: 0, y: 6 },
      ],
    ]
    for (const sites of configs) {
      const d = build(6, 7, sites)
      exhaustivelyCheck(d, sites)
      const sum = d.cells.reduce((acc, c) => ratAdd(acc, c.area), rat(0))
      expect(ratToString(sum)).toBe('42')

      // 邻接关系对称
      for (const cell of d.cells) {
        for (const n of cell.neighbors) {
          expect(d.cellsById.get(n)!.neighbors).toContain(cell.site.id)
        }
      }
    }
  })

  it('不对称双站点穷举（无整数等距点）', () => {
    const sites: Site[] = [
      { id: 'p', x: 1, y: 1 },
      { id: 'q', x: 4, y: 3 },
    ]
    const d = build(6, 5, sites)
    exhaustivelyCheck(d, sites)
    expect(ratToString(d.cells.reduce((acc, c) => ratAdd(acc, c.area), rat(0)))).toBe('30')
  })
})

describe('真实尺寸（100 起步）抽样穷举', () => {
  it('100×100 多站点：逐整数点核对归属与单元包含关系', () => {
    const sites: Site[] = [
      { id: 'a', x: 12, y: 88 },
      { id: 'b', x: 80, y: 20 },
      { id: 'c', x: 50, y: 55 },
      { id: 'd', x: 90, y: 95 },
      { id: 'e', x: 5, y: 5 },
    ]
    const d = build(100, 100, sites)
    exhaustivelyCheck(d, sites)
    const sum = d.cells.reduce((acc, c) => ratAdd(acc, c.area), rat(0))
    expect(ratToString(sum)).toBe('10000')
  }, 30000)
})

describe('等距归属与字节序', () => {
  it('compareAscii 按无符号字节比较', () => {
    expect(compareAscii('A', 'B')).toBe(-1)
    expect(compareAscii('A', 'a')).toBe(-1) // 65 < 97
    expect(compareAscii('ab', 'abc')).toBe(-1)
    expect(compareAscii('a0', 'aA')).toBe(-1) // '0'(48) < 'A'(65)
  })

  it('等距时 id 字节序靠前者胜出，与声明顺序无关', () => {
    const sites: Site[] = [
      { id: 'b', x: 0, y: 0 },
      { id: 'A', x: 2, y: 0 },
    ]
    // x=1 等距；'A'(65) < 'b'(98)
    expect(nearestSite(sites, 1, 0).siteId).toBe('A')
    const reversed = [...sites].reverse()
    expect(nearestSite(reversed, 1, 0).siteId).toBe('A')
  })
})

describe('输入校验', () => {
  const good = (): Site[] => [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 50, y: 50 },
  ]

  it('接受合法规格', () => {
    expect(validateSpec(100, 1000, good())).toEqual([])
    expect(validateSpec(1000, 100, good())).toEqual([])
  })

  it('拒绝越界宽高', () => {
    expect(validateSpec(99, 100, good()).length).toBeGreaterThan(0)
    expect(validateSpec(1001, 100, good()).length).toBeGreaterThan(0)
    expect(validateSpec(100.5, 100, good()).length).toBeGreaterThan(0)
  })

  it('拒绝站点数量越界', () => {
    expect(validateSpec(100, 100, [good()[0]]).join(' ')).toContain('至少')
    const many = Array.from({ length: 31 }, (_, i) => ({
      id: `s${i}`,
      x: (i * 3) % 100,
      y: (i * 7) % 100,
    }))
    // 去掉可能的重合后仍有 31 个 → 数量错误优先存在
    expect(validateSpec(100, 100, many).join(' ')).toContain('30')
  })

  it('拒绝重复 id、非 ASCII id、重合坐标与越界坐标', () => {
    expect(
      validateSpec(100, 100, [
        { id: 'A', x: 1, y: 1 },
        { id: 'A', x: 2, y: 2 },
      ]).join(' '),
    ).toContain('重复')

    expect(
      validateSpec(100, 100, [
        { id: 'A', x: 1, y: 1 },
        { id: '站', x: 2, y: 2 },
      ]).join(' '),
    ).toContain('ASCII')

    expect(
      validateSpec(100, 100, [
        { id: 'A', x: 1, y: 1 },
        { id: 'B', x: 1, y: 1 },
      ]).join(' '),
    ).toContain('重合')

    expect(
      validateSpec(100, 100, [
        { id: 'A', x: -1, y: 1 },
        { id: 'B', x: 2, y: 2 },
      ]).join(' '),
    ).toContain('超出')
  })
})
