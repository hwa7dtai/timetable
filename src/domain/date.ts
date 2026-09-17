const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export const MINUTES_PER_DAY = 24 * 60

/** 判断字符串是否为合法的 YYYY-MM-DD 日期（含闰年、月份天数校验） */
export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  )
}

/**
 * 解析 YYYY-MM-DD 为本地时区当天 0 点的 Date。
 * 刻意不使用 new Date(string)，避免被当作 UTC 解析导致日期偏移一天。
 */
export function parseLocalDate(value: string): Date {
  const match = DATE_PATTERN.exec(value)
  if (!match || !isValidDateString(value)) {
    throw new Error(`非法日期：${value}`)
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** 把 Date 格式化为 YYYY-MM-DD */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 取某天 0 点 */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** 在日期上加减天数，返回当天 0 点 */
export function addDays(date: Date, amount: number): Date {
  const result = startOfDay(date)
  result.setDate(result.getDate() + amount)
  return result
}

/** 两个日期相差的整天数（b - a） */
export function daysBetween(a: Date, b: Date): number {
  const diff = startOfDay(b).getTime() - startOfDay(a).getTime()
  return Math.round(diff / 86_400_000)
}

/** 取某天所在周的周一（周一为一周的第一天，周日归属前一个周一） */
export function mondayOf(date: Date): Date {
  const weekday = date.getDay()
  const offset = weekday === 0 ? -6 : 1 - weekday
  return addDays(date, offset)
}

/** 星期几，1 = 周一 …… 7 = 周日 */
export function isoDayOfWeek(date: Date): number {
  const weekday = date.getDay()
  return weekday === 0 ? 7 : weekday
}

/** 把「当天分钟数 + 跨天偏移」换算为具体时刻 */
export function atMinute(day: Date, minute: number, dayOffset: 0 | 1 = 0): Date {
  const result = startOfDay(day)
  result.setDate(result.getDate() + dayOffset)
  result.setMinutes(minute)
  return result
}

/** 把分钟数格式化为 HH:mm */
export function formatMinute(minute: number): string {
  const normalized = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hour = Math.floor(normalized / 60)
  const rest = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/** 解析 HH:mm 为当天分钟数，非法输入返回 null */
export function parseMinute(value: string): number | null {
  const match = TIME_PATTERN.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** 格式化为 HH:mm:ss，用于实时时钟 */
export function formatClockTime(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  return `${hour}:${minute}:${second}`
}

/** 相对今天的中文日期描述，如「今天」「明天」 */
export function describeDayOffset(from: Date, target: Date): string {
  const offset = daysBetween(from, target)
  if (offset === 0) return '今天'
  if (offset === 1) return '明天'
  if (offset === 2) return '后天'
  return `${target.getMonth() + 1} 月 ${target.getDate()} 日`
}
