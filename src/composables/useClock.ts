import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

/** 时钟抽象：领域逻辑与组合式函数都通过它取时间，测试时可注入假时钟 */
export interface Clock {
  now(): number
}

export const systemClock: Clock = {
  now: () => Date.now(),
}

export interface UseClockOptions {
  /** 刷新间隔，默认 1000 毫秒 */
  intervalMs?: number
  /** 注入自定义时钟（测试用）；传入时创建独立实例，不与其他调用共享 */
  clock?: Clock
}

export interface ClockHandle {
  /** 当前时间，随时钟推进自动更新 */
  now: Ref<Date>
}

interface ClockInstance extends ClockHandle {
  start(): void
  stop(): void
  dispose(): void
}

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function createClockInstance(clock: Clock, intervalMs: number): ClockInstance {
  const now = ref(new Date(clock.now()))
  let alignTimer: ReturnType<typeof setTimeout> | null = null
  let intervalTimer: ReturnType<typeof setInterval> | null = null
  let listening = false

  /** 时间只作为输入，每次 tick 都从时钟重新取值，绝不累加 */
  const tick = () => {
    now.value = new Date(clock.now())
  }

  const clearTimers = () => {
    if (alignTimer !== null) {
      clearTimeout(alignTimer)
      alignTimer = null
    }
    if (intervalTimer !== null) {
      clearInterval(intervalTimer)
      intervalTimer = null
    }
  }

  const stop = () => {
    clearTimers()
  }

  const start = () => {
    if (alignTimer !== null || intervalTimer !== null) return
    if (isDocumentHidden()) return

    // 先对齐到下一个刷新边界，之后按固定间隔推进，避免长期漂移
    const delay = intervalMs - (clock.now() % intervalMs)
    alignTimer = setTimeout(() => {
      alignTimer = null
      tick()
      intervalTimer = setInterval(tick, intervalMs)
    }, delay)
  }

  const handleVisibilityChange = () => {
    if (isDocumentHidden()) {
      stop()
      return
    }
    // 从后台恢复时立即重算，避免显示过期时间
    tick()
    start()
  }

  const handleResume = () => {
    tick()
    start()
  }

  const attachListeners = () => {
    if (listening) return
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    listening = true
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleResume)
    window.addEventListener('pageshow', handleResume)
  }

  const detachListeners = () => {
    if (!listening) return
    listening = false
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', handleResume)
    window.removeEventListener('pageshow', handleResume)
  }

  const dispose = () => {
    stop()
    detachListeners()
  }

  tick()
  attachListeners()
  start()

  return { now, start, stop, dispose }
}

/** 多个组件共享同一个时钟实例，避免同时运行多个定时器 */
const SHARED_INTERVAL_MS = 1000
let sharedInstance: ClockInstance | null = null
let sharedRefCount = 0

function acquireSharedInstance(): ClockInstance {
  if (!sharedInstance) {
    sharedInstance = createClockInstance(systemClock, SHARED_INTERVAL_MS)
  }
  sharedRefCount += 1
  return sharedInstance
}

function releaseSharedInstance(): void {
  if (sharedRefCount > 0) sharedRefCount -= 1
  if (sharedRefCount === 0 && sharedInstance) {
    sharedInstance.dispose()
    sharedInstance = null
  }
}

/** 仅供测试使用：重置共享时钟状态 */
export function resetSharedClock(): void {
  if (sharedInstance) sharedInstance.dispose()
  sharedInstance = null
  sharedRefCount = 0
}

/**
 * 实时时钟。
 * 页面可见时按间隔刷新，进入后台自动暂停，组件卸载时自动释放。
 */
export function useClock(options: UseClockOptions = {}): ClockHandle {
  const intervalMs = options.intervalMs ?? SHARED_INTERVAL_MS

  if (options.clock) {
    const instance = createClockInstance(options.clock, intervalMs)
    if (getCurrentScope()) {
      onScopeDispose(() => instance.dispose())
    }
    return { now: instance.now }
  }

  const instance = acquireSharedInstance()
  if (getCurrentScope()) {
    onScopeDispose(() => releaseSharedInstance())
  }
  return { now: instance.now }
}
