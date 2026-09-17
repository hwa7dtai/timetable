import { describe, expect, it } from 'vitest'

import {
  addDays,
  atMinute,
  daysBetween,
  describeDayOffset,
  formatClockTime,
  formatLocalDate,
  formatMinute,
  isValidDateString,
  isoDayOfWeek,
  mondayOf,
  parseLocalDate,
  parseMinute,
  startOfDay,
} from '@/domain/date'

import { at } from './helpers'

describe('日期解析与格式化', () => {
  it('把 YYYY-MM-DD 解析为本地时区当天 0 点', () => {
    const date = parseLocalDate('2026-09-07')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(8)
    expect(date.getDate()).toBe(7)
    expect(date.getHours()).toBe(0)
  })

  it('不会因为时区把日期偏移一天', () => {
    expect(formatLocalDate(parseLocalDate('2026-01-01'))).toBe('2026-01-01')
    expect(formatLocalDate(parseLocalDate('2026-12-31'))).toBe('2026-12-31')
  })

  it('拒绝非法日期', () => {
    expect(() => parseLocalDate('2026-13-01')).toThrow()
    expect(() => parseLocalDate('2026-02-30')).toThrow()
    expect(() => parseLocalDate('2026-9-7')).toThrow()
    expect(() => parseLocalDate('')).toThrow()
  })

  it('校验日期字符串并正确处理闰年', () => {
    expect(isValidDateString('2024-02-29')).toBe(true)
    expect(isValidDateString('2026-02-29')).toBe(false)
    expect(isValidDateString('2026-04-31')).toBe(false)
    expect(isValidDateString('2026-04-30')).toBe(true)
  })
})

describe('周的计算', () => {
  it('周一为一周的第一天', () => {
    expect(formatLocalDate(mondayOf(parseLocalDate('2026-09-14')))).toBe('2026-09-14')
    expect(formatLocalDate(mondayOf(parseLocalDate('2026-09-17')))).toBe('2026-09-14')
  })

  it('周日归属上一个周一', () => {
    expect(formatLocalDate(mondayOf(parseLocalDate('2026-09-20')))).toBe('2026-09-14')
    expect(isoDayOfWeek(parseLocalDate('2026-09-20'))).toBe(7)
    expect(isoDayOfWeek(parseLocalDate('2026-09-21'))).toBe(1)
  })

  it('计算整天数并跨越月份与年份', () => {
    expect(daysBetween(parseLocalDate('2026-09-07'), parseLocalDate('2026-09-14'))).toBe(7)
    expect(daysBetween(parseLocalDate('2026-09-30'), parseLocalDate('2026-10-01'))).toBe(1)
    expect(daysBetween(parseLocalDate('2026-12-31'), parseLocalDate('2027-01-01'))).toBe(1)
    expect(daysBetween(parseLocalDate('2026-09-14'), parseLocalDate('2026-09-07'))).toBe(-7)
  })

  it('加减天数后仍为当天 0 点', () => {
    const result = addDays(at(2026, 9, 30, 15, 30), 1)
    expect(formatLocalDate(result)).toBe('2026-10-01')
    expect(result.getHours()).toBe(0)
  })

  it('取当天 0 点', () => {
    expect(startOfDay(at(2026, 9, 17, 23, 59, 59)).getDate()).toBe(17)
    expect(startOfDay(at(2026, 9, 17, 23, 59, 59)).getHours()).toBe(0)
  })
})

describe('时刻换算', () => {
  it('分钟数与 HH:mm 互相转换', () => {
    expect(formatMinute(0)).toBe('00:00')
    expect(formatMinute(480)).toBe('08:00')
    expect(formatMinute(1425)).toBe('23:45')
    expect(parseMinute('08:00')).toBe(480)
    expect(parseMinute('23:45')).toBe(1425)
    expect(parseMinute('24:00')).toBeNull()
    expect(parseMinute('8:00')).toBeNull()
    expect(parseMinute('')).toBeNull()
  })

  it('按分钟数构造当天时刻，支持跨天偏移', () => {
    expect(atMinute(at(2026, 9, 17), 480).getHours()).toBe(8)
    const nextDay = atMinute(at(2026, 9, 17), 30, 1)
    expect(nextDay.getDate()).toBe(18)
    expect(nextDay.getMinutes()).toBe(30)
  })

  it('格式化实时时钟', () => {
    expect(formatClockTime(at(2026, 9, 17, 9, 5, 3))).toBe('09:05:03')
  })

  it('生成相对日期描述', () => {
    const now = at(2026, 9, 17, 10, 0)
    expect(describeDayOffset(now, at(2026, 9, 17, 20, 0))).toBe('今天')
    expect(describeDayOffset(now, at(2026, 9, 18, 8, 0))).toBe('明天')
    expect(describeDayOffset(now, at(2026, 9, 19, 8, 0))).toBe('后天')
    expect(describeDayOffset(now, at(2026, 9, 25, 8, 0))).toBe('9 月 25 日')
  })
})
