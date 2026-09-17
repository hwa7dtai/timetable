import type { AppData } from '@/domain/types'

import { buildBackupFileName, parseBackup, serializeBackup, type ImportResult } from './backup'
import { createEmptyData } from './defaults'
import { migrateAppData } from './migration'
import { createStorageAdapter, type StorageAdapter } from './storage'

export type LoadIssueKind = 'storage-unavailable' | 'corrupted' | 'unsupported-version'

export interface LoadIssue {
  kind: LoadIssueKind
  message: string
}

export interface LoadResult {
  data: AppData
  issues: LoadIssue[]
}

export interface TimetableRepository {
  /** 底层是否真正可持久化 */
  isPersistent(): boolean
  load(): LoadResult
  save(data: AppData): boolean
  clear(): void
  serialize(data: AppData): string
  backupFileName(now?: Date): string
  importBackup(json: string): ImportResult
}

export function createRepository(storage: StorageAdapter = createStorageAdapter()): TimetableRepository {
  return {
    isPersistent: () => storage.persistent,

    load(): LoadResult {
      const issues: LoadIssue[] = []
      if (!storage.persistent) {
        issues.push({
          kind: 'storage-unavailable',
          message: '当前浏览器无法保存数据，本次录入只保留在内存中，请及时导出备份。',
        })
      }

      const raw = storage.read()
      if (raw === null) {
        return { data: createEmptyData(), issues }
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        storage.preserveCorrupted(raw)
        issues.push({
          kind: 'corrupted',
          message: '本地数据已损坏，无法读取。原始内容已单独保留，你可以尝试导入此前的备份。',
        })
        return { data: createEmptyData(), issues }
      }

      const result = migrateAppData(parsed)
      if (!result.ok) {
        storage.preserveCorrupted(raw)
        issues.push({
          kind: result.reason === 'unsupported-version' ? 'unsupported-version' : 'corrupted',
          message: `${result.message}。原始内容已单独保留，你可以尝试导入此前的备份。`,
        })
        return { data: createEmptyData(), issues }
      }

      return { data: result.data, issues }
    },

    save(data: AppData): boolean {
      return storage.write(JSON.stringify(data))
    },

    clear() {
      storage.remove()
    },

    serialize(data: AppData): string {
      return serializeBackup(data)
    },

    backupFileName(now: Date = new Date()): string {
      return buildBackupFileName(now)
    },

    importBackup(json: string): ImportResult {
      return parseBackup(json)
    },
  }
}
