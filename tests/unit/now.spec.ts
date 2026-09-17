import { describe, expect, it } from 'vitest'

import {
  getCurrentSession,
  getCurrentSessionOccurrence,
  getNextSession,
  getNextSessionOccurrence,
  getPeriodRange,
  getRemainingMinutes,
  getSemesterStatus,
  getTodayOccurrences,
  getTodaySessions,
} from '@/domain/now'

import {
  at,
  makeCourse,
  makeData,
  makePeriodTable,
  makeSemester,
  makeSession,
  TEST_PERIOD_TABLE,
} from './helpers'

/** 周一第 1-2 节（08:00-09:40）的一门课 */
const mondayData = makeData()

/** 周四第 3-4 节（10:00-11:40）的一门课 */
const thursdayData = makeData({
  courses: [makeCourse({ id: 'c2', name: '大学物理' })],
  sessions: [
    makeSession({ id: 's2', courseId: 'c2', dayOfWeek: 4, startPeriod: 3, endPeriod: 4 }),
  ],
})

describe('学期状态', () => {
  it('未设置学期', () => {
    expect(getSemesterStatus(makeData({ semester: null }), at(2026, 9, 17))).toBe('not-set')
  })

  it('尚未开学', () => {
    expect(getSemesterStatus(mondayData, at(2026, 9, 6))).toBe('before')
  })

  it('学期进行中', () => {
    expect(getSemesterStatus(mondayData, at(2026, 9, 17))).toBe('in-progress')
  })

  it('学期已结束', () => {
    expect(getSemesterStatus(mondayData, at(2027, 1, 11))).toBe('finished')
  })
})

describe('节次时刻换算', () => {
  it('取节次起止时刻', () => {
    expect(getPeriodRange(TEST_PERIOD_TABLE, 1, 2)).toEqual({
      start: { dayOffset: 0, minute: 480 },
      end: { dayOffset: 0, minute: 580 },
    })
  })

  it('节次不存在时返回 null', () => {
    expect(getPeriodRange(TEST_PERIOD_TABLE, 1, 99)).toBeNull()
    expect(getPeriodRange(TEST_PERIOD_TABLE, 3, 2)).toBeNull()
  })

  it('结束时刻早于起始时刻时判定为跨零点', () => {
    const table = makePeriodTable([
      { index: 1, startMinute: 1380, endMinute: 1425 }, // 23:00 - 23:45
      { index: 2, startMinute: 5, endMinute: 50 }, // 次日 00:05 - 00:50
    ])
    expect(getPeriodRange(table, 1, 2)).toEqual({
      start: { dayOffset: 0, minute: 1380 },
      end: { dayOffset: 1, minute: 50 },
    })
  })
})

describe('今日课程', () => {
  it('按当天星期筛选时段', () => {
    expect(getTodaySessions(thursdayData, at(2026, 9, 17, 9, 0))).toHaveLength(1)
    expect(getTodaySessions(mondayData, at(2026, 9, 17, 9, 0))).toHaveLength(0)
  })

  it('未设置学期或学期已结束时没有今日课程', () => {
    expect(getTodaySessions(makeData({ semester: null }), at(2026, 9, 17))).toEqual([])
    expect(getTodaySessions(mondayData, at(2027, 2, 1))).toEqual([])
  })

  it('给出今天的真实起止时刻', () => {
    const occurrences = getTodayOccurrences(thursdayData, at(2026, 9, 17, 9, 0))
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0].start.getHours()).toBe(10)
    expect(occurrences[0].end.getHours()).toBe(11)
    expect(occurrences[0].end.getMinutes()).toBe(40)
  })
})

describe('当前正在上的课', () => {
  it('恰好在上课开始时刻算正在上课', () => {
    const occurrence = getCurrentSessionOccurrence(mondayData, at(2026, 9, 14, 8, 0, 0))
    expect(occurrence?.session.id).toBe('s1')
  })

  it('上课中间算正在上课', () => {
    expect(getCurrentSession(mondayData, at(2026, 9, 14, 8, 30))?.id).toBe('s1')
    expect(getCurrentSession(mondayData, at(2026, 9, 14, 9, 39, 59))?.id).toBe('s1')
  })

  it('恰好在下课时刻算已下课', () => {
    expect(getCurrentSession(mondayData, at(2026, 9, 14, 9, 40, 0))).toBeNull()
  })

  it('两节课之间的空档没有正在上的课', () => {
    expect(getCurrentSession(mondayData, at(2026, 9, 14, 9, 50))).toBeNull()
  })

  it('今天没课时没有正在上的课', () => {
    expect(getCurrentSession(mondayData, at(2026, 9, 17, 9, 0))).toBeNull()
  })

  it('单双周不匹配的周次不显示课程', () => {
    const oddOnly = makeData({
      sessions: [makeSession({ parity: 'odd' })],
    })
    // 2026-09-14 是第 2 周（双周），单周课不开课
    expect(getCurrentSession(oddOnly, at(2026, 9, 14, 8, 30))).toBeNull()
    // 2026-09-21 是第 3 周（单周）
    expect(getCurrentSession(oddOnly, at(2026, 9, 21, 8, 30))?.id).toBe('s1')
  })

  it('识别跨零点的晚课', () => {
    const table = makePeriodTable([
      { index: 1, startMinute: 1380, endMinute: 1425 },
      { index: 2, startMinute: 5, endMinute: 50 },
    ])
    const data = makeData({
      periodTable: table,
      sessions: [makeSession({ dayOfWeek: 1, startPeriod: 1, endPeriod: 2 })],
    })

    // 周一 23:10 正在上课
    expect(getCurrentSession(data, at(2026, 9, 14, 23, 10))?.id).toBe('s1')
    // 周二 00:10 仍在同一次课中
    expect(getCurrentSession(data, at(2026, 9, 15, 0, 10))?.id).toBe('s1')
    // 周二 00:55 已经下课
    expect(getCurrentSession(data, at(2026, 9, 15, 0, 55))).toBeNull()
  })
})

describe('剩余分钟数', () => {
  const session = makeSession()

  it('刚上课时按整段时长计算', () => {
    expect(getRemainingMinutes(mondayData, session, at(2026, 9, 14, 8, 0))).toBe(100)
  })

  it('上课中间向上取整', () => {
    expect(getRemainingMinutes(mondayData, session, at(2026, 9, 14, 9, 39, 1))).toBe(1)
  })

  it('已经下课时为 0', () => {
    expect(getRemainingMinutes(mondayData, session, at(2026, 9, 14, 9, 40))).toBe(0)
    expect(getRemainingMinutes(mondayData, session, at(2026, 9, 14, 12, 0))).toBe(0)
  })

  it('跨零点晚课按次日结束时刻计算', () => {
    const table = makePeriodTable([
      { index: 1, startMinute: 1380, endMinute: 1425 },
      { index: 2, startMinute: 5, endMinute: 50 },
    ])
    const data = makeData({
      periodTable: table,
      sessions: [makeSession({ dayOfWeek: 1, startPeriod: 1, endPeriod: 2 })],
    })
    expect(getRemainingMinutes(data, data.sessions[0], at(2026, 9, 15, 0, 10))).toBe(40)
  })
})

describe('下一节课', () => {
  it('找到当天之后的课', () => {
    const occurrence = getNextSessionOccurrence(mondayData, at(2026, 9, 14, 7, 0))
    expect(occurrence?.session.id).toBe('s1')
    expect(occurrence?.start.getHours()).toBe(8)
    expect(occurrence?.start.getDate()).toBe(14)
  })

  it('正在上课时返回下一次上课的时间', () => {
    const occurrence = getNextSessionOccurrence(mondayData, at(2026, 9, 14, 8, 30))
    expect(occurrence?.start.getDate()).toBe(21)
  })

  it('跳过单双周不匹配的周次', () => {
    // 周二第 1-2 节，仅单周上课
    const data = makeData({
      sessions: [
        makeSession({ dayOfWeek: 2, parity: 'odd' }),
      ],
    })
    // 2026-09-15 是第 2 周（双周），下一次上课应在第 3 周的周二
    const occurrence = getNextSessionOccurrence(data, at(2026, 9, 15, 12, 0))
    expect(occurrence?.start.getDate()).toBe(22)
    expect(occurrence?.start.getMonth()).toBe(8)
  })

  it('跨天查找下一节课', () => {
    const data = makeData({
      courses: [makeCourse({ id: 'c2', name: '大学物理' })],
      sessions: [makeSession({ id: 's2', courseId: 'c2', dayOfWeek: 3, startPeriod: 3, endPeriod: 4 })],
    })
    const occurrence = getNextSessionOccurrence(data, at(2026, 9, 14, 20, 0))
    expect(occurrence?.start.getDate()).toBe(16)
    expect(occurrence?.start.getHours()).toBe(10)
  })

  it('尚未开学时返回学期第一节课', () => {
    const occurrence = getNextSessionOccurrence(mondayData, at(2026, 9, 1, 9, 0))
    expect(occurrence?.start.getDate()).toBe(7)
    expect(occurrence?.start.getMonth()).toBe(8)
  })

  it('学期结束后没有下一节课', () => {
    expect(getNextSession(mondayData, at(2027, 2, 1))).toBeNull()
  })

  it('学期内完全没有课时返回 null', () => {
    const empty = makeData({ courses: [], sessions: [] })
    expect(getNextSession(empty, at(2026, 9, 14, 7, 0))).toBeNull()
  })

  it('未设置学期时返回 null', () => {
    expect(getNextSession(makeData({ semester: null }), at(2026, 9, 14, 7, 0))).toBeNull()
  })

  it('学期最后一周之后不再向后查找', () => {
    const shortSemester = makeData({ semester: makeSemester({ totalWeeks: 1 }) })
    // 第 1 周周一 08:00 下课后，学期已经结束
    expect(getNextSession(shortSemester, at(2026, 9, 7, 10, 0))).toBeNull()
  })
})
