import { addDays, atMinute, daysBetween, isoDayOfWeek, parseLocalDate, startOfDay } from './date'
import { getSessionsOfDay } from './schedule'
import { getWeekIndex, isWeekInSemester } from './week'
import type {
  AppData,
  PeriodTable,
  SemesterStatus,
  Session,
  SessionOccurrence,
} from './types'

export interface PeriodRange {
  start: { dayOffset: 0 | 1; minute: number }
  end: { dayOffset: 0 | 1; minute: number }
}

/** 判断学期状态：未设置 / 未开学 / 进行中 / 已结束 */
export function getSemesterStatus(data: AppData, now: Date): SemesterStatus {
  if (!data.semester) return 'not-set'
  const week = getWeekIndex(now, data.semester)
  if (week < 1) return 'before'
  if (week > data.semester.totalWeeks) return 'finished'
  return 'in-progress'
}

/**
 * 某段节次当天的起止时刻。
 * 结束节次的结束时刻若不晚于起始节次的开始时刻，说明该时段跨过了零点（如 23:00 的晚课）。
 */
export function getPeriodRange(
  periodTable: PeriodTable,
  startPeriod: number,
  endPeriod: number,
): PeriodRange | null {
  if (startPeriod > endPeriod) return null

  const first = periodTable.periods.find((period) => period.index === startPeriod)
  const last = periodTable.periods.find((period) => period.index === endPeriod)
  if (!first || !last) return null

  const dayOffset: 0 | 1 = last.endMinute <= first.startMinute ? 1 : 0

  return {
    start: { dayOffset: 0, minute: first.startMinute },
    end: { dayOffset, minute: last.endMinute },
  }
}

/** 把时段落到某个具体日期上，得到真实的起止时刻 */
export function getSessionOccurrenceOn(
  day: Date,
  periodTable: PeriodTable,
  session: Session,
): SessionOccurrence | null {
  const range = getPeriodRange(periodTable, session.startPeriod, session.endPeriod)
  if (!range) return null

  return {
    session,
    start: atMinute(day, range.start.minute, range.start.dayOffset),
    end: atMinute(day, range.end.minute, range.end.dayOffset),
  }
}

/** 今天与昨天的全部上课发生，用于正确识别跨零点的当前课 */
function getRecentOccurrences(data: AppData, now: Date): SessionOccurrence[] {
  const semester = data.semester
  if (!semester) return []

  const occurrences: SessionOccurrence[] = []
  for (const offset of [0, -1]) {
    const day = addDays(now, offset)
    const week = getWeekIndex(day, semester)
    if (!isWeekInSemester(week, semester)) continue

    for (const session of getSessionsOfDay(data, week, isoDayOfWeek(day))) {
      const occurrence = getSessionOccurrenceOn(day, data.periodTable, session)
      if (occurrence) occurrences.push(occurrence)
    }
  }
  return occurrences
}

/** 今日全部时段（按星期与节次排序） */
export function getTodaySessions(data: AppData, now: Date): Session[] {
  const semester = data.semester
  if (!semester) return []

  const week = getWeekIndex(now, semester)
  if (!isWeekInSemester(week, semester)) return []

  return getSessionsOfDay(data, week, isoDayOfWeek(now))
}

/** 今日全部时段对应的真实起止时刻 */
export function getTodayOccurrences(data: AppData, now: Date): SessionOccurrence[] {
  const day = startOfDay(now)
  return getTodaySessions(data, now)
    .map((session) => getSessionOccurrenceOn(day, data.periodTable, session))
    .filter((occurrence): occurrence is SessionOccurrence => occurrence !== null)
}

/**
 * 当前正在上的课。
 * 边界约定：恰好等于开始时刻算「正在上」，恰好等于结束时刻算「已下课」。
 */
export function getCurrentSessionOccurrence(
  data: AppData,
  now: Date,
): SessionOccurrence | null {
  const time = now.getTime()
  return (
    getRecentOccurrences(data, now).find(
      (occurrence) => occurrence.start.getTime() <= time && time < occurrence.end.getTime(),
    ) ?? null
  )
}

/** 当前正在上的课，无则返回 null */
export function getCurrentSession(data: AppData, now: Date): Session | null {
  return getCurrentSessionOccurrence(data, now)?.session ?? null
}

/** 距离下课还剩多少分钟，向上取整，最小为 0 */
export function getRemainingMinutes(data: AppData, session: Session, now: Date): number {
  const time = now.getTime()
  const occurrence =
    getRecentOccurrences(data, now).find(
      (item) => item.session.id === session.id && item.start.getTime() <= time,
    ) ?? getSessionOccurrenceOn(startOfDay(now), data.periodTable, session)

  if (!occurrence) return 0
  return Math.max(0, Math.ceil((occurrence.end.getTime() - time) / 60_000))
}

/**
 * 下一节课，可跨天、跨周。
 * 尚未开学时返回学期第一节课，学期结束后返回 null。
 */
export function getNextSessionOccurrence(
  data: AppData,
  now: Date,
): SessionOccurrence | null {
  const semester = data.semester
  if (!semester) return null

  const semesterStart = parseLocalDate(semester.startDate)
  const lastDay = addDays(semesterStart, semester.totalWeeks * 7 - 1)
  const time = now.getTime()

  let cursor = startOfDay(now)
  if (cursor.getTime() < semesterStart.getTime()) cursor = semesterStart

  const maxDays = daysBetween(cursor, lastDay) + 1
  for (let index = 0; index < maxDays; index += 1) {
    const day = addDays(cursor, index)
    const week = getWeekIndex(day, semester)
    if (!isWeekInSemester(week, semester)) continue

    for (const session of getSessionsOfDay(data, week, isoDayOfWeek(day))) {
      const occurrence = getSessionOccurrenceOn(day, data.periodTable, session)
      if (occurrence && occurrence.start.getTime() > time) return occurrence
    }
  }

  return null
}

/** 下一节课的时段，无则返回 null */
export function getNextSession(data: AppData, now: Date): Session | null {
  return getNextSessionOccurrence(data, now)?.session ?? null
}
