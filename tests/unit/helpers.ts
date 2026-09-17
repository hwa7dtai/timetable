import {
  SCHEMA_VERSION,
  type AppData,
  type Course,
  type PeriodTable,
  type Semester,
  type Session,
} from '@/domain/types'

/** 周一的日期，作为所有测试的学期锚点 */
export const SEMESTER_START = '2026-09-07'

/** 测试用节次时间表：4 节课，时间固定且可预期 */
export const TEST_PERIOD_TABLE: PeriodTable = {
  id: 'test',
  name: '测试作息',
  periods: [
    { index: 1, startMinute: 480, endMinute: 525 }, // 08:00 - 08:45
    { index: 2, startMinute: 535, endMinute: 580 }, // 08:55 - 09:40
    { index: 3, startMinute: 600, endMinute: 645 }, // 10:00 - 10:45
    { index: 4, startMinute: 655, endMinute: 700 }, // 10:55 - 11:40
  ],
}

export function makePeriodTable(periods: PeriodTable['periods']): PeriodTable {
  return { id: 'test', name: '测试作息', periods }
}

export function makeSemester(overrides: Partial<Semester> = {}): Semester {
  return { startDate: SEMESTER_START, totalWeeks: 18, ...overrides }
}

export function makeCourse(overrides: Partial<Course> = {}): Course {
  return { id: 'c1', name: '高等数学', teacher: '张老师', note: '', ...overrides }
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    courseId: 'c1',
    dayOfWeek: 1,
    startPeriod: 1,
    endPeriod: 2,
    weekStart: 1,
    weekEnd: 18,
    parity: 'all',
    room: '三教302',
    ...overrides,
  }
}

export function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    semester: makeSemester(),
    periodTable: structuredClone(TEST_PERIOD_TABLE),
    courses: [makeCourse()],
    sessions: [makeSession()],
    ...overrides,
  }
}

/** 构造本地时间，避免测试里出现时区歧义 */
export function at(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, second)
}
