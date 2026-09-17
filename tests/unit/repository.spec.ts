import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRepository } from '@/data/repository'
import { createStorageAdapter, type StorageAdapter } from '@/data/storage'

import { makeData } from './helpers'

interface FakeStorage {
  adapter: StorageAdapter
  preserved: string[]
  value: () => string | null
}

function createFakeStorage(initial: string | null = null, persistent = true): FakeStorage {
  let current = initial
  const preserved: string[] = []
  return {
    adapter: {
      persistent,
      read: () => current,
      write: (next: string) => {
        current = next
        return true
      },
      remove: () => {
        current = null
      },
      preserveCorrupted: (raw: string) => {
        preserved.push(raw)
      },
    },
    preserved,
    value: () => current,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('仓库读取', () => {
  it('没有本地数据时返回一份空数据', () => {
    const storage = createFakeStorage()
    const result = createRepository(storage.adapter).load()

    expect(result.issues).toEqual([])
    expect(result.data.courses).toEqual([])
    expect(result.data.sessions).toEqual([])
    expect(result.data.semester).toBeNull()
    expect(result.data.periodTable.periods.length).toBeGreaterThan(0)
  })

  it('保存后可以完整读回', () => {
    const storage = createFakeStorage()
    const repository = createRepository(storage.adapter)
    const data = makeData()

    expect(repository.save(data)).toBe(true)
    const result = repository.load()

    expect(result.issues).toEqual([])
    expect(result.data.courses).toEqual(data.courses)
    expect(result.data.sessions).toEqual(data.sessions)
  })

  it('数据损坏时保留原始内容并给出提示', () => {
    const storage = createFakeStorage('{ 坏掉的内容')
    const result = createRepository(storage.adapter).load()

    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].kind).toBe('corrupted')
    expect(storage.preserved).toEqual(['{ 坏掉的内容'])
    expect(result.data.courses).toEqual([])
  })

  it('数据版本过高时拒绝载入并保留原始内容', () => {
    const storage = createFakeStorage(JSON.stringify({ ...makeData(), schemaVersion: 99 }))
    const result = createRepository(storage.adapter).load()

    expect(result.issues[0].kind).toBe('unsupported-version')
    expect(storage.preserved).toHaveLength(1)
  })

  it('存储不可用时提示仅内存模式', () => {
    const storage = createFakeStorage(null, false)
    const result = createRepository(storage.adapter).load()

    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].kind).toBe('storage-unavailable')
  })
})

describe('仓库写入', () => {
  it('清空后读取为空数据', () => {
    const storage = createFakeStorage()
    const repository = createRepository(storage.adapter)
    repository.save(makeData())
    repository.clear()

    expect(storage.value()).toBeNull()
    expect(repository.load().data.courses).toEqual([])
  })

  it('写入失败时返回 false', () => {
    const storage = createFakeStorage()
    storage.adapter.write = () => false
    expect(createRepository(storage.adapter).save(makeData())).toBe(false)
  })

  it('复用导入校验逻辑', () => {
    const repository = createRepository(createFakeStorage().adapter)
    const result = repository.importBackup(repository.serialize(makeData()))
    expect(result.ok).toBe(true)
  })
})

describe('localStorage 适配器', () => {
  it('可用时标记为可持久化', () => {
    expect(createStorageAdapter().persistent).toBe(true)
  })

  it('写入抛异常时降级为仅内存模式', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => undefined,
    })

    const adapter = createStorageAdapter()
    expect(adapter.persistent).toBe(false)

    // 降级后仍然可以完成一次读写往返
    expect(adapter.write('hello')).toBe(true)
    expect(adapter.read()).toBe('hello')
  })
})
