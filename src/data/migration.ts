import { isValidDateString } from '@/domain/date'
import { SCHEMA_VERSION, type AppData, type Course, type Period, type Session, type WeekParity } from '@/domain/types'

export type ParseFailureReason = 'invalid-json' | 'invalid-shape' | 'unsupported-version'

export type MigrateResult =
  | { ok: true; data: AppData }
  | { ok: false; reason: ParseFailureReason; message: string }

const PARITIES: readonly WeekParity[] = ['all', 'odd', 'even']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isOptionalString(value: unknown): value is string {
  return typeof value === 'string'
}

function parsePeriod(value: unknown): Period | null {
  if (!isRecord(value)) return null
  if (!isInteger(value.index, 1, 99)) return null
  if (!isInteger(value.startMinute, 0, 1439)) return null
  if (!isInteger(value.endMinute, 0, 1439)) return null
  return { index: value.index, startMinute: value.startMinute, endMinute: value.endMinute }
}

function parseCourse(value: unknown): Course | null {
  if (!isRecord(value)) return null
  if (!isNonEmptyString(value.id)) return null
  if (!isNonEmptyString(value.name)) return null
  return {
    id: value.id,
    name: value.name,
    teacher: isOptionalString(value.teacher) ? value.teacher : '',
    note: isOptionalString(value.note) ? value.note : '',
  }
}

function parseSession(value: unknown): Session | null {
  if (!isRecord(value)) return null
  if (!isNonEmptyString(value.id)) return null
  if (!isNonEmptyString(value.courseId)) return null
  if (!isInteger(value.dayOfWeek, 1, 7)) return null
  if (!isInteger(value.startPeriod, 1, 99)) return null
  if (!isInteger(value.endPeriod, 1, 99)) return null
  if (value.startPeriod > value.endPeriod) return null
  if (!isInteger(value.weekStart, 1, 60)) return null
  if (!isInteger(value.weekEnd, 1, 60)) return null
  if (value.weekStart > value.weekEnd) return null
  if (!PARITIES.includes(value.parity as WeekParity)) return null

  return {
    id: value.id,
    courseId: value.courseId,
    dayOfWeek: value.dayOfWeek,
    startPeriod: value.startPeriod,
    endPeriod: value.endPeriod,
    weekStart: value.weekStart,
    weekEnd: value.weekEnd,
    parity: value.parity as WeekParity,
    room: isOptionalString(value.room) ? value.room : '',
  }
}

function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

/** 校验并规整任意来源的数据；无法规整时返回失败原因 */
export function validateAppData(value: unknown): MigrateResult {
  if (!isRecord(value)) {
    return { ok: false, reason: 'invalid-shape', message: '数据不是合法的对象' }
  }
  if (typeof value.schemaVersion !== 'number') {
    return { ok: false, reason: 'invalid-shape', message: '缺少数据结构版本号' }
  }

  const semesterValue = value.semester
  let semester: AppData['semester'] = null
  if (semesterValue !== null && semesterValue !== undefined) {
    if (!isRecord(semesterValue)) {
      return { ok: false, reason: 'invalid-shape', message: '学期设置格式不正确' }
    }
    if (!isValidDateString(String(semesterValue.startDate ?? ''))) {
      return { ok: false, reason: 'invalid-shape', message: '学期起始日期不正确' }
    }
    if (!isInteger(semesterValue.totalWeeks, 1, 60)) {
      return { ok: false, reason: 'invalid-shape', message: '学期总周数不正确' }
    }
    semester = {
      startDate: String(semesterValue.startDate),
      totalWeeks: semesterValue.totalWeeks,
    }
  }

  const periodTableValue = value.periodTable
  if (!isRecord(periodTableValue)) {
    return { ok: false, reason: 'invalid-shape', message: '缺少节次时间表' }
  }
  if (!Array.isArray(periodTableValue.periods)) {
    return { ok: false, reason: 'invalid-shape', message: '节次时间表格式不正确' }
  }
  const periods: Period[] = []
  for (const item of periodTableValue.periods) {
    const period = parsePeriod(item)
    if (!period) {
      return { ok: false, reason: 'invalid-shape', message: '存在非法的节次时间' }
    }
    periods.push(period)
  }
  if (periods.length === 0) {
    return { ok: false, reason: 'invalid-shape', message: '节次时间表不能为空' }
  }

  if (!Array.isArray(value.courses)) {
    return { ok: false, reason: 'invalid-shape', message: '课程列表格式不正确' }
  }
  const courses: Course[] = []
  for (const item of value.courses) {
    const course = parseCourse(item)
    if (!course) {
      return { ok: false, reason: 'invalid-shape', message: '存在非法的课程数据' }
    }
    courses.push(course)
  }

  if (!Array.isArray(value.sessions)) {
    return { ok: false, reason: 'invalid-shape', message: '上课时段格式不正确' }
  }
  const courseIds = new Set(courses.map((course) => course.id))
  const sessions: Session[] = []
  for (const item of value.sessions) {
    const session = parseSession(item)
    if (!session) {
      return { ok: false, reason: 'invalid-shape', message: '存在非法的上课时段' }
    }
    // 严格校验：宁可报告问题，也不静默丢弃用户数据
    if (!courseIds.has(session.courseId)) {
      return {
        ok: false,
        reason: 'invalid-shape',
        message: '存在引用了不存在课程的上课时段',
      }
    }
    sessions.push(session)
  }

  return {
    ok: true,
    data: {
      schemaVersion: SCHEMA_VERSION,
      semester,
      periodTable: {
        id: isNonEmptyString(periodTableValue.id) ? periodTableValue.id : 'default',
        name: isNonEmptyString(periodTableValue.name) ? periodTableValue.name : '默认作息',
        periods: periods.sort((a, b) => a.index - b.index),
      },
      courses: dedupeById(courses),
      sessions: dedupeById(sessions),
    },
  }
}

/**
 * 把任意版本的原始数据迁移到当前版本。
 * 版本高于当前程序时拒绝载入，避免静默损坏用户数据。
 */
export function migrateAppData(value: unknown): MigrateResult {
  if (!isRecord(value) || typeof value.schemaVersion !== 'number') {
    return { ok: false, reason: 'invalid-shape', message: '数据缺少版本号' }
  }

  if (value.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'unsupported-version',
      message: `数据版本（${value.schemaVersion}）高于当前支持的版本（${SCHEMA_VERSION}）`,
    }
  }

  if (value.schemaVersion < 1) {
    return {
      ok: false,
      reason: 'unsupported-version',
      message: `无法识别的数据版本（${value.schemaVersion}）`,
    }
  }

  // 目前只有版本 1，后续版本在此逐级迁移
  return validateAppData(value)
}
