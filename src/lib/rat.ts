/**
 * 精确有理数运算（分子/分母均为 bigint，分母恒为正）。
 *
 * Voronoi 半平面裁切会反复求线段与等距线的交点，交点坐标一般是分数。
 * 为了让“平分边界属于谁”“两条边是否真正共线”这类判断不产生浮点误差，
 * 编辑器与测试中的全部几何计算都使用这一类型。
 */
export type Rat = readonly [bigint, bigint] // [分子, 正分母]

function bigintAbs(a: bigint): bigint {
  return a < 0n ? -a : a
}

function gcd(a: bigint, b: bigint): bigint {
  let x = bigintAbs(a)
  let y = bigintAbs(b)
  while (y !== 0n) {
    const t = x % y
    x = y
    y = t
  }
  return x === 0n ? 1n : x
}

/** 0、1 等常量 */
export const RAT_ZERO: Rat = [0n, 1n]
export const RAT_ONE: Rat = [1n, 1n]

/** 由分子、分母构造约分后的有理数；分母为 0 视为程序错误。 */
export function rat(num: bigint | number | Rat, den: bigint | number = 1): Rat {
  if (typeof num !== 'bigint' && typeof num !== 'number') {
    // 已是 Rat
    return [num[0], num[1]]
  }
  let n = BigInt(num)
  let d = BigInt(den)
  if (d === 0n) throw new Error('有理数分母不能为 0')
  if (d < 0n) {
    n = -n
    d = -d
  }
  if (n === 0n) return [0n, 1n]
  const g = gcd(n, d)
  return [n / g, d / g]
}

/** 加法 (a/b)+(c/d) */
export function ratAdd(a: Rat, b: Rat): Rat {
  return rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1])
}

/** 减法 (a/b)-(c/d) */
export function ratSub(a: Rat, b: Rat): Rat {
  return rat(a[0] * b[1] - b[0] * a[1], a[1] * b[1])
}

/** 乘法 */
export function ratMul(a: Rat, b: Rat): Rat {
  return rat(a[0] * b[0], a[1] * b[1])
}

/** 除法；除数为 0 抛错 */
export function ratDiv(a: Rat, b: Rat): Rat {
  if (b[0] === 0n) throw new Error('除数为 0')
  return rat(a[0] * b[1], a[1] * b[0])
}

/** 取负 */
export function ratNeg(a: Rat): Rat {
  return [-a[0], a[1]]
}

/** 比较：返回 -1 / 0 / 1 */
export function ratCmp(a: Rat, b: Rat): -1 | 0 | 1 {
  const lhs = a[0] * b[1]
  const rhs = b[0] * a[1]
  if (lhs < rhs) return -1
  if (lhs > rhs) return 1
  return 0
}

export function ratEq(a: Rat, b: Rat): boolean {
  return ratCmp(a, b) === 0
}

export function ratLt(a: Rat, b: Rat): boolean {
  return ratCmp(a, b) < 0
}

export function ratLe(a: Rat, b: Rat): boolean {
  return ratCmp(a, b) <= 0
}

/** "p/q"（分母为 1 时只输出整数部分） */
export function ratToString(a: Rat): string {
  return a[1] === 1n ? `${a[0]}` : `${a[0]}/${a[1]}`
}

/** 仅用于 SVG / 列表展示的近似值，从不参与归属判定 */
export function ratToNumber(a: Rat): number {
  return Number(a[0]) / Number(a[1])
}

/** 取出（已约分的）分子与正分母 */
export function ratParts(a: Rat): { num: bigint; den: bigint } {
  return { num: a[0], den: a[1] }
}
