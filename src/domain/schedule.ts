import { getCourseById } from './courses'
import { isActiveInWeek } from './week'
import type { AppData, Course, Session } from './types'

/** 时段的排序：先按星期，再按节次 */
export function compareSessions(a: Session, b: Session): number {
  if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
  if (a.startPeriod !== b.startPeriod) return a.startPeriod - b.startPeriod
  if (a.endPeriod !== b.endPeriod) return a.endPeriod - b.endPeriod
  return a.id.localeCompare(b.id)
}

export function sortSessions<T extends Session>(sessions: readonly T[]): T[] {
  return [...sessions].sort(compareSessions)
}

/** 取某周的全部时段（已按星期与节次排序） */
export function getSessionsOfWeek(data: AppData, week: number): Session[] {
  return sortSessions(data.sessions.filter((session) => isActiveInWeek(session, week)))
}

/** 取某天（星期几 + 周次）的全部时段 */
export function getSessionsOfDay(data: AppData, week: number, dayOfWeek: number): Session[] {
  return getSessionsOfWeek(data, week).filter((session) => session.dayOfWeek === dayOfWeek)
}

/** 节次范围的展示文案，如「第 3-4 节」「第 5 节」 */
export function formatPeriodLabel(startPeriod: number, endPeriod: number): string {
  return startPeriod === endPeriod
    ? `第 ${startPeriod} 节`
    : `第 ${startPeriod}-${endPeriod} 节`
}

/** 周次的展示文案，如「第 1-16 周单周」 */
export function formatWeekLabel(session: Session): string {
  const parityLabel = session.parity === 'all' ? '' : session.parity === 'odd' ? '单周' : '双周'
  const range =
    session.weekStart === session.weekEnd
      ? `第 ${session.weekStart} 周`
      : `第 ${session.weekStart}-${session.weekEnd} 周`
  return parityLabel ? `${range}${parityLabel}` : range
}

/** 星期几的中文名称 */
export const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const

export function formatWeekday(dayOfWeek: number): string {
  return WEEKDAY_NAMES[dayOfWeek - 1] ?? `周${dayOfWeek}`
}

/** 取时段的课程，课程被删除时返回 undefined */
export function getSessionCourse(data: AppData, session: Session): Course | undefined {
  return getCourseById(data, session.courseId)
}
