import { describe, expect, it } from 'vitest'
import {
  rat,
  ratAdd,
  ratDiv,
  ratEq,
  ratMul,
  ratSub,
  ratToString,
} from './rat'

describe('Rat 有理数', () => {
  it('约分并保持分母为正', () => {
    expect(ratToString(rat(6, 4))).toBe('3/2')
    expect(ratToString(rat(-3, -6))).toBe('1/2')
    expect(ratToString(rat(2, -4))).toBe('-1/2')
    expect(ratToString(rat(0, 9))).toBe('0')
  })

  it('四则运算精确', () => {
    expect(ratToString(ratAdd(rat(1, 3), rat(1, 6)))).toBe('1/2')
    expect(ratToString(ratSub(rat(2), rat(1, 2)))).toBe('3/2')
    expect(ratToString(ratMul(rat(3, 7), rat(2, 5)))).toBe('6/35')
    expect(ratToString(ratDiv(rat(1, 3), rat(2, 3)))).toBe('1/2')
  })

  it('相等性不依赖表示形式', () => {
    expect(ratEq(rat(2, 4), rat(1, 2))).toBe(true)
    expect(ratEq(rat(-1, 2), rat(1, -2))).toBe(true)
  })
})
