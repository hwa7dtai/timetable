import type { AppData } from '@/domain/types'

import { migrateAppData, type ParseFailureReason } from './migration'

export type ImportErrorReason = ParseFailureReason

export type ImportResult =
  | { ok: true; data: AppData }
  | { ok: false; reason: ImportErrorReason; message: string }

export interface BackupFile extends AppData {
  exportedAt: string
}

/** 导出为字符串。导出内容始终携带 exportedAt，便于用户识别备份时间。 */
export function serializeBackup(data: AppData, now: Date = new Date()): string {
  const backup: BackupFile = { ...data, exportedAt: now.toISOString() }
  return JSON.stringify(backup, null, 2)
}

/** 解析导入的备份内容，依次校验：可解析 → 结构合法 → 版本可识别 */
export function parseBackup(json: string): ImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'invalid-json', message: '文件内容不是合法的 JSON' }
  }

  return migrateAppData(raw)
}

/** 生成导出文件名，如 timetable-backup-20260917-093012.json */
export function buildBackupFileName(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `timetable-backup-${date}-${time}.json`
}
