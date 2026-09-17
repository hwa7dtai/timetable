import { daysBetween, mondayOf, parseLocalDate } from './date'
import type { Semester, Session, WeekParity } from './types'

/** 判断某个周次是否满足单双周条件 */
export function matchesParity(week: number, parity: WeekParity): boolean {
  if (parity === 'all') return true
  if (parity === 'odd') return week % 2 === 1
  return week % 2 === 0
}

/** 判断某个时段在第 N 周是否开课 */
export function isActiveInWeek(session: Session, week: number): boolean {
  return (
    week >= session.weekStart && week <= session.weekEnd && matchesParity(week, session.parity)
  )
}

/**
 * 把时段展开为实际开课的周次列表。
 * 例如「第 1~16 周，单周」=> 1、3、5……15。
 * 区间上限不超过一学期的周数，逐周判断以保证可读性与正确性。
 */
export function expandWeeks(session: Session): number[] {
  const weeks: number[] = []
  for (let week = session.weekStart; week <= session.weekEnd; week += 1) {
    if (matchesParity(week, session.parity)) {
      weeks.push(week)
    }
  }
  return weeks
}

/**
 * 计算某个日期属于第几周。
 * 周次 = (该日期所在周的周一 - 第 1 周周一) / 7 + 1
 * 返回值小于 1 表示尚未开学，大于总周数表示学期已结束。
 */
export function getWeekIndex(date: Date, semester: Semester): number {
  const start = parseLocalDate(semester.startDate)
  const weeks = Math.round(daysBetween(start, mondayOf(date)) / 7)
  return weeks + 1
}

/** 判断周次是否落在学期范围内 */
export function isWeekInSemester(week: number, semester: Semester): boolean {
  return week >= 1 && week <= semester.totalWeeks
}
