import { describe, expect, it } from 'vitest'

import { expandWeeks, getWeekIndex, isActiveInWeek, isWeekInSemester, matchesParity } from '@/domain/week'

import { at, makeSemester, makeSession } from './helpers'

const semester = makeSemester()

describe('单双周判定', () => {
  it('每周、单周、双周', () => {
    expect([1, 2, 3, 4].map((week) => matchesParity(week, 'all'))).toEqual([true, true, true, true])
    expect([1, 2, 3, 4].map((week) => matchesParity(week, 'odd'))).toEqual([
      true,
      false,
      true,
      false,
    ])
    expect([1, 2, 3, 4].map((week) => matchesParity(week, 'even'))).toEqual([
      false,
      true,
      false,
      true,
    ])
  })
})

describe('展开周次', () => {
  it('第 1~16 周单周课展开为 1、3、5……15', () => {
    const weeks = expandWeeks(
      makeSession({ weekStart: 1, weekEnd: 16, parity: 'odd' }),
    )
    expect(weeks).toEqual([1, 3, 5, 7, 9, 11, 13, 15])
  })

  it('第 1~16 周双周课展开为 2、4、6……16', () => {
    const weeks = expandWeeks(
      makeSession({ weekStart: 1, weekEnd: 16, parity: 'even' }),
    )
    expect(weeks).toEqual([2, 4, 6, 8, 10, 12, 14, 16])
  })

  it('每周课展开为完整区间', () => {
    expect(expandWeeks(makeSession({ weekStart: 10, weekEnd: 13, parity: 'all' }))).toEqual([
      10, 11, 12, 13,
    ])
  })

  it('单周区间内没有符合条件的周次时返回空数组', () => {
    expect(expandWeeks(makeSession({ weekStart: 2, weekEnd: 2, parity: 'odd' }))).toEqual([])
  })
})

describe('周次计算', () => {
  it('学期起始日为第 1 周', () => {
    expect(getWeekIndex(at(2026, 9, 7), semester)).toBe(1)
  })

  it('同一周的周日仍属于第 1 周', () => {
    expect(getWeekIndex(at(2026, 9, 13), semester)).toBe(1)
  })

  it('下一周的周一进入第 2 周', () => {
    expect(getWeekIndex(at(2026, 9, 14), semester)).toBe(2)
    expect(getWeekIndex(at(2026, 9, 20), semester)).toBe(2)
  })

  it('开学前返回小于 1 的周次', () => {
    // 第 1 周是 2026-09-07 起，前一周为第 0 周，再前一周为第 -1 周
    expect(getWeekIndex(at(2026, 9, 6), semester)).toBe(0)
    expect(getWeekIndex(at(2026, 8, 31), semester)).toBe(0)
    // 08-30 是周日，归属上一周（08-24 起），因此是第 -1 周
    expect(getWeekIndex(at(2026, 8, 30), semester)).toBe(-1)
    expect(getWeekIndex(at(2026, 8, 24), semester)).toBe(-1)
  })

  it('跨年与学期末尾', () => {
    expect(getWeekIndex(at(2027, 1, 4), semester)).toBe(18)
    expect(getWeekIndex(at(2027, 1, 10), semester)).toBe(18)
    expect(getWeekIndex(at(2027, 1, 11), semester)).toBe(19)
  })

  it('判断周次是否在学期范围内', () => {
    expect(isWeekInSemester(1, semester)).toBe(true)
    expect(isWeekInSemester(18, semester)).toBe(true)
    expect(isWeekInSemester(0, semester)).toBe(false)
    expect(isWeekInSemester(19, semester)).toBe(false)
  })
})

describe('时段在某周是否开课', () => {
  it('同时受周次区间与单双周约束', () => {
    const session = makeSession({ weekStart: 1, weekEnd: 16, parity: 'odd' })
    expect(isActiveInWeek(session, 1)).toBe(true)
    expect(isActiveInWeek(session, 2)).toBe(false)
    expect(isActiveInWeek(session, 17)).toBe(false)
    expect(isActiveInWeek(session, 0)).toBe(false)
  })
})
