import { effectScope, type Ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetSharedClock, useClock } from '@/composables/useClock'

function createFakeClock(start: number) {
  let current = start
  return {
    clock: { now: () => current },
    advance(ms: number) {
      current += ms
    },
    set(value: number) {
      current = value
    },
  }
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  resetSharedClock()
  vi.useRealTimers()
  setVisibility('visible')
})

describe('实时时钟', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('初始值来自注入的时钟', () => {
    const fake = createFakeClock(1_000_000_000)
    const { now } = useClock({ clock: fake.clock })
    expect(now.value.getTime()).toBe(1_000_000_000)
  })

  it('先对齐到整秒边界再按固定间隔刷新', async () => {
    const fake = createFakeClock(1_000_000_400)
    const { now } = useClock({ clock: fake.clock })

    // 距下一个整秒还有 600 毫秒，此时不应刷新
    fake.advance(500)
    await vi.advanceTimersByTimeAsync(500)
    expect(now.value.getTime()).toBe(1_000_000_400)

    // 到达整秒边界后刷新
    fake.advance(100)
    await vi.advanceTimersByTimeAsync(100)
    expect(now.value.getTime()).toBe(1_000_001_000)

    // 之后每次推进 1 秒刷新一次
    fake.advance(1000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(now.value.getTime()).toBe(1_000_002_000)
  })

  it('时间来源于时钟本身，不做累加', async () => {
    const fake = createFakeClock(1_000_000_000)
    const { now } = useClock({ clock: fake.clock })

    // 模拟系统休眠后一次性跳过 10 分钟
    fake.advance(600_000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(now.value.getTime()).toBe(1_000_600_000)
  })

  it('页面隐藏时停止刷新，恢复时立即重算', async () => {
    const fake = createFakeClock(1_000_000_000)
    const { now } = useClock({ clock: fake.clock })

    setVisibility('hidden')
    fake.advance(5000)
    await vi.advanceTimersByTimeAsync(5000)
    expect(now.value.getTime()).toBe(1_000_000_000)

    // 回到前台时即使定时器还没触发，也会立即重算
    fake.set(1_000_005_000)
    setVisibility('visible')
    expect(now.value.getTime()).toBe(1_000_005_000)
  })

  it('从后台恢复后继续正常刷新', async () => {
    const fake = createFakeClock(1_000_000_000)
    const { now } = useClock({ clock: fake.clock })

    setVisibility('hidden')
    fake.set(1_000_003_000)
    setVisibility('visible')
    expect(now.value.getTime()).toBe(1_000_003_000)

    fake.advance(1000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(now.value.getTime()).toBe(1_000_004_000)
  })

  it('组件卸载后不再刷新', async () => {
    const fake = createFakeClock(1_000_000_000)
    const scope = effectScope()
    let now: Ref<Date> | undefined

    scope.run(() => {
      now = useClock({ clock: fake.clock }).now
    })
    scope.stop()

    fake.advance(10_000)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(now?.value.getTime()).toBe(1_000_000_000)
  })
})

describe('共享时钟', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('多个订阅者共享同一个时间引用', () => {
    const scopeA = effectScope()
    const scopeB = effectScope()
    let first: Ref<Date> | undefined
    let second: Ref<Date> | undefined

    scopeA.run(() => {
      first = useClock().now
    })
    scopeB.run(() => {
      second = useClock().now
    })

    expect(first).toBe(second)

    scopeA.stop()
    scopeB.stop()
  })

  it('最后一个订阅者退出后停止定时器', () => {
    const scopeA = effectScope()
    const scopeB = effectScope()
    scopeA.run(() => useClock())
    scopeB.run(() => useClock())

    expect(vi.getTimerCount()).toBeGreaterThan(0)

    scopeA.stop()
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    scopeB.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
