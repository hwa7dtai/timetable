import { SCHEMA_VERSION, type AppData, type Period, type PeriodTable } from '@/domain/types'

/** 内置的通用节次时间表，可在设置页按本校实际时间修改 */
export const DEFAULT_PERIODS: readonly Period[] = [
  { index: 1, startMinute: 8 * 60, endMinute: 8 * 60 + 45 },
  { index: 2, startMinute: 8 * 60 + 55, endMinute: 9 * 60 + 40 },
  { index: 3, startMinute: 10 * 60, endMinute: 10 * 60 + 45 },
  { index: 4, startMinute: 10 * 60 + 55, endMinute: 11 * 60 + 40 },
  { index: 5, startMinute: 14 * 60, endMinute: 14 * 60 + 45 },
  { index: 6, startMinute: 14 * 60 + 55, endMinute: 15 * 60 + 40 },
  { index: 7, startMinute: 16 * 60, endMinute: 16 * 60 + 45 },
  { index: 8, startMinute: 16 * 60 + 55, endMinute: 17 * 60 + 40 },
  { index: 9, startMinute: 19 * 60, endMinute: 19 * 60 + 45 },
  { index: 10, startMinute: 19 * 60 + 55, endMinute: 20 * 60 + 40 },
  { index: 11, startMinute: 20 * 60 + 50, endMinute: 21 * 60 + 35 },
]

/** 每次调用返回独立副本，避免调用方修改共享的默认值 */
export function createDefaultPeriodTable(): PeriodTable {
  return {
    id: 'default',
    name: '默认作息',
    periods: DEFAULT_PERIODS.map((period) => ({ ...period })),
  }
}

/** 一份全新的空数据 */
export function createEmptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    semester: null,
    periodTable: createDefaultPeriodTable(),
    courses: [],
    sessions: [],
  }
}

/** 常见的总周数选项 */
export const TOTAL_WEEK_OPTIONS = [16, 17, 18, 19, 20] as const
