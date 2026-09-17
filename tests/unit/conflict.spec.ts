import { describe, expect, it } from 'vitest'

import { detectConflicts, findOverlappingWeeks } from '@/domain/conflict'

import { makeSession } from './helpers'

describe('冲突检测', () => {
  it('同星期、节次重叠、周次重叠且都开课时判定为冲突', () => {
    const existing = makeSession({ id: 'a', weekStart: 1, weekEnd: 18 })
    const candidate = makeSession({ id: 'b', courseId: 'c2', weekStart: 1, weekEnd: 18 })
    const conflicts = detectConflicts(candidate, [existing])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].session.id).toBe('a')
    expect(conflicts[0].weeks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
  })

  it('单周课与双周课在同一时间不算冲突', () => {
    const odd = makeSession({ id: 'a', weekStart: 1, weekEnd: 16, parity: 'odd' })
    const even = makeSession({ id: 'b', courseId: 'c2', weekStart: 1, weekEnd: 16, parity: 'even' })
    expect(detectConflicts(even, [odd])).toEqual([])
  })

  it('周次区间相交但奇偶不匹配时不算冲突', () => {
    // 第 1~2 周单周课只在第 1 周上课；第 2~3 周双周课只在第 2 周上课
    const odd = makeSession({ id: 'a', weekStart: 1, weekEnd: 2, parity: 'odd' })
    const even = makeSession({ id: 'b', courseId: 'c2', weekStart: 2, weekEnd: 3, parity: 'even' })
    expect(findOverlappingWeeks(odd, even)).toEqual([])
  })

  it('单周课与每周课在重叠的奇数周冲突，并给出具体周次', () => {
    const odd = makeSession({ id: 'a', weekStart: 1, weekEnd: 5, parity: 'odd' })
    const all = makeSession({ id: 'b', courseId: 'c2', weekStart: 3, weekEnd: 6, parity: 'all' })
    expect(findOverlappingWeeks(odd, all)).toEqual([3, 5])
  })

  it('节次部分重叠也算冲突', () => {
    const a = makeSession({ id: 'a', startPeriod: 1, endPeriod: 2 })
    const b = makeSession({ id: 'b', courseId: 'c2', startPeriod: 2, endPeriod: 3 })
    expect(detectConflicts(b, [a])).toHaveLength(1)
  })

  it('节次完全不重叠不算冲突', () => {
    const a = makeSession({ id: 'a', startPeriod: 1, endPeriod: 2 })
    const b = makeSession({ id: 'b', courseId: 'c2', startPeriod: 3, endPeriod: 4 })
    expect(detectConflicts(b, [a])).toEqual([])
  })

  it('星期不同不算冲突', () => {
    const a = makeSession({ id: 'a', dayOfWeek: 1 })
    const b = makeSession({ id: 'b', courseId: 'c2', dayOfWeek: 2 })
    expect(detectConflicts(b, [a])).toEqual([])
  })

  it('周次区间不相交不算冲突', () => {
    const a = makeSession({ id: 'a', weekStart: 1, weekEnd: 8 })
    const b = makeSession({ id: 'b', courseId: 'c2', weekStart: 9, weekEnd: 16 })
    expect(detectConflicts(b, [a])).toEqual([])
  })

  it('编辑时可以排除自身', () => {
    const self = makeSession({ id: 'a' })
    expect(detectConflicts(self, [self], { excludeSessionId: 'a' })).toEqual([])
  })

  it('同一门课程的时段重叠会被标记出来', () => {
    const a = makeSession({ id: 'a', courseId: 'c1', startPeriod: 1, endPeriod: 2 })
    const b = makeSession({ id: 'b', courseId: 'c1', startPeriod: 2, endPeriod: 3 })
    const conflicts = detectConflicts(b, [a])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].sameCourse).toBe(true)
  })

  it('不同课程的时段重叠不会被标记为同课程', () => {
    const a = makeSession({ id: 'a', courseId: 'c1' })
    const b = makeSession({ id: 'b', courseId: 'c2' })
    expect(detectConflicts(b, [a])[0].sameCourse).toBe(false)
  })

  it('可以同时检出多个冲突对象', () => {
    const a = makeSession({ id: 'a', courseId: 'c1' })
    const b = makeSession({ id: 'b', courseId: 'c2' })
    const candidate = makeSession({ id: 'c', courseId: 'c3' })
    expect(detectConflicts(candidate, [a, b])).toHaveLength(2)
  })
})
