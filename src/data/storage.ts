export const DATA_KEY = 'timetable:data'
export const CORRUPTED_KEY = 'timetable:data.corrupted'

export interface StorageAdapter {
  /** 底层是否真正可持久化，false 表示降级为仅内存模式 */
  readonly persistent: boolean
  read(): string | null
  write(value: string): boolean
  remove(): void
  /** 把损坏的原始内容单独留存，避免直接丢掉用户数据 */
  preserveCorrupted(value: string): void
}

function createMemoryBackend(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const memory = new Map<string, string>()
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
  }
}

function detectLocalStorage(): boolean {
  try {
    const probeKey = '__timetable_probe__'
    globalThis.localStorage.setItem(probeKey, '1')
    globalThis.localStorage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

/**
 * localStorage 适配器。
 * 隐私模式或存储被禁用时降级为仅内存模式，由 persistent 标记告知调用方，
 * 使界面可以持续提示用户「数据无法保存，请及时导出备份」。
 */
export function createStorageAdapter(): StorageAdapter {
  const usable = typeof globalThis.localStorage !== 'undefined' && detectLocalStorage()
  const backend = usable ? globalThis.localStorage : createMemoryBackend()

  return {
    persistent: usable,
    read() {
      try {
        return backend.getItem(DATA_KEY)
      } catch {
        return null
      }
    },
    write(value: string) {
      try {
        backend.setItem(DATA_KEY, value)
        return true
      } catch {
        // 配额写满等异常：不中断用户操作，由上层提示
        return false
      }
    },
    remove() {
      try {
        backend.removeItem(DATA_KEY)
      } catch {
        // 忽略：清空失败时上层会给出提示
      }
    },
    preserveCorrupted(value: string) {
      try {
        backend.setItem(CORRUPTED_KEY, value)
      } catch {
        // 忽略：留存失败不影响主流程
      }
    },
  }
}
