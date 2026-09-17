import { matchesParity } from './week'
import type { Session } from './types'

export interface Conflict {
  /** 与当前时段冲突的已有时段 */
  session: Session
  /** 冲突的具体周次列表，用于向用户解释 */
  weeks: number[]
  /** 是否属于同一门课程内部的时段重叠 */
  sameCourse: boolean
}

export interface DetectConflictOptions {
  /** 编辑已有课程时排除自身，避免「与自己冲突」 */
  excludeSessionId?: string
}

/**
 * 检测一个时段与已有全部时段的冲突。
 * 口径：星期几相同 + 节次有交集 + 周次区间有交集 + 单双周条件同时满足。
 */
export function detectConflicts(
  candidate: Session,
  existing: readonly Session[],
  options: DetectConflictOptions = {},
): Conflict[] {
  const conflicts: Conflict[] = []

  for (const session of existing) {
    if (options.excludeSessionId && session.id === options.excludeSessionId) continue
    const weeks = findOverlappingWeeks(candidate, session)
    if (weeks.length === 0) continue
    conflicts.push({
      session,
      weeks,
      sameCourse: session.courseId === candidate.courseId,
    })
  }

  return conflicts
}

/**
 * 求两个时段真正同时开课的周次。
 *
 * 注意不能简化为「周次区间相交」：例如 A 是第 1~2 周单周课、B 是第 2~3 周双周课，
 * 区间交集是第 2 周，但第 2 周是双周，A 并不开课，实际不冲突。
 * 因此逐周枚举，区间上限不超过一学期周数，性能无意义，正确性优先。
 */
export function findOverlappingWeeks(a: Session, b: Session): number[] {
  if (a.dayOfWeek !== b.dayOfWeek) return []

  // 节次无交集
  const start = Math.max(a.startPeriod, b.startPeriod)
  const end = Math.min(a.endPeriod, b.endPeriod)
  if (start > end) return []

  const firstWeek = Math.max(a.weekStart, b.weekStart)
  const lastWeek = Math.min(a.weekEnd, b.weekEnd)
  if (firstWeek > lastWeek) return []

  const weeks: number[] = []
  for (let week = firstWeek; week <= lastWeek; week += 1) {
    if (matchesParity(week, a.parity) && matchesParity(week, b.parity)) {
      weeks.push(week)
    }
  }
  return weeks
}
