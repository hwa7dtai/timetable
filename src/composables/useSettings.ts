import { formatLocalDate, mondayOf, parseLocalDate } from '@/domain/date'
import type { Semester } from '@/domain/types'

import { useTimetable } from './useTimetable'

/**
 * 学期与节次时间表的读写。
 * 学期起始日统一归一到该周周一，与「第 1 周周一」的定义保持一致。
 */
export function useSettings() {
  const { semester, periodTable, setSemester, setPeriodTable } = useTimetable()

  function normalizeStartDate(date: string): string {
    return formatLocalDate(mondayOf(parseLocalDate(date)))
  }

  function saveSemester(startDate: string, totalWeeks: number) {
    const value: Semester = {
      startDate: normalizeStartDate(startDate),
      totalWeeks,
    }
    setSemester(value)
  }

  return {
    semester,
    periodTable,
    saveSemester,
    clearSemester: () => setSemester(null),
    setPeriodTable,
    normalizeStartDate,
  }
}
