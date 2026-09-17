/** 当前数据结构版本，用于迁移 */
export const SCHEMA_VERSION = 1

/** 单双周类型 */
export type WeekParity = 'all' | 'odd' | 'even'

/** 节次时间：一节课的编号与起止时刻，时刻用当天 0 点起的分钟数表示 */
export interface Period {
  /** 节次编号，从 1 开始 */
  index: number
  /** 起始时刻，如 8:00 => 480 */
  startMinute: number
  /** 结束时刻，如 8:45 => 525；小于 startMinute 表示跨过零点 */
  endMinute: number
}

/** 课程：一门课的固定信息 */
export interface Course {
  id: string
  name: string
  teacher: string
  /** 备注，可为空字符串 */
  note: string
}

/** 上课时段：课程在「星期几 + 节次 + 周次范围 + 单双周」上的一次具体安排 */
export interface Session {
  id: string
  courseId: string
  /** 星期几，1 = 周一 …… 7 = 周日 */
  dayOfWeek: number
  /** 起始节次编号 */
  startPeriod: number
  /** 结束节次编号，等于 startPeriod 表示单节 */
  endPeriod: number
  /** 起始周次 */
  weekStart: number
  /** 结束周次 */
  weekEnd: number
  parity: WeekParity
  /** 教室，同一门课的不同时段可以不同 */
  room: string
}

/** 学期设置 */
export interface Semester {
  /** 第 1 周周一的日期，格式 YYYY-MM-DD */
  startDate: string
  /** 总周数，常见 16 / 18 / 20 */
  totalWeeks: number
}

/** 节次时间表 */
export interface PeriodTable {
  id: string
  name: string
  periods: Period[]
}

/** 持久化的完整数据 */
export interface AppData {
  schemaVersion: number
  /** 学期设置，未设置时为 null，此时周次相关功能不可用 */
  semester: Semester | null
  periodTable: PeriodTable
  courses: Course[]
  sessions: Session[]
}

/** 学期状态 */
export type SemesterStatus = 'not-set' | 'before' | 'in-progress' | 'finished'

/** 一次具体的上课发生（把时段落到某个真实日期上） */
export interface SessionOccurrence {
  session: Session
  start: Date
  end: Date
}
