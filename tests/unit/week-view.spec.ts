import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetSharedClock } from '@/composables/useClock'
import { clearData, replaceData } from '@/composables/useTimetable'
import WeekView from '@/views/WeekView.vue'

import { at, makeCourse, makeData, makeSession } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetSharedClock()
})

afterEach(() => {
  resetSharedClock()
  vi.useRealTimers()
  clearData()
})

describe('周课表视图', () => {
  it('默认显示当前周', () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(WeekView)
    expect(wrapper.find('.week-switcher .title').text()).toBe('第 2 周 / 共 18 周')
  })

  it('渲染课程名称与教室', () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(WeekView)
    const cards = wrapper.findAll('.session-card')

    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('高等数学')
    expect(cards[0].text()).toContain('三教302')
  })

  it('正在上的课会被高亮', () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(WeekView)
    expect(wrapper.find('.session-card').classes()).toContain('current')
  })

  it('切换到其他周后不再高亮当前课', async () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(WeekView)
    await wrapper.findAll('.week-switcher button')[0].trigger('click')

    expect(wrapper.find('.week-switcher .title').text()).toBe('第 1 周 / 共 18 周')
    expect(wrapper.find('.session-card').classes()).not.toContain('current')
  })

  it('单周课只在单周出现', async () => {
    replaceData(
      makeData({
        sessions: [makeSession({ parity: 'odd', weekStart: 1, weekEnd: 8 })],
      }),
    )
    // 2026-09-14 是第 2 周（双周）
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(WeekView)
    expect(wrapper.findAll('.session-card')).toHaveLength(0)

    await wrapper.findAll('.week-switcher button')[0].trigger('click')
    expect(wrapper.find('.week-switcher .title').text()).toBe('第 1 周 / 共 18 周')
    expect(wrapper.findAll('.session-card')).toHaveLength(1)
  })

  it('周次切换的边界被限制在学期范围内', () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 7, 8, 0))

    const wrapper = mount(WeekView)
    const [prev, next] = wrapper.findAll('.week-switcher button')

    expect(prev.attributes('disabled')).toBeDefined()
    expect(next.attributes('disabled')).toBeUndefined()
  })

  it('同一时间的两门课并排显示', () => {
    replaceData(
      makeData({
        courses: [makeCourse({ id: 'c1' }), makeCourse({ id: 'c2', name: '大学物理' })],
        sessions: [
          makeSession({ id: 's1', courseId: 'c1' }),
          makeSession({ id: 's2', courseId: 'c2' }),
        ],
      }),
    )
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(WeekView)
    const cards = wrapper.findAll('.session-card')

    expect(cards).toHaveLength(2)
    expect(cards[0].attributes('style')).toContain('width: 50%')
    expect(cards[1].attributes('style')).toContain('left: 50%')
  })

  it('点击格子打开课程详情', async () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(WeekView)
    await wrapper.find('.session-card').trigger('click')

    const sheet = wrapper.find('.sheet')
    expect(sheet.exists()).toBe(true)
    expect(sheet.text()).toContain('高等数学')
    expect(sheet.text()).toContain('老师')
  })

  it('未设置学期时给出引导', () => {
    replaceData(makeData({ semester: null }))
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(WeekView)
    expect(wrapper.text()).toContain('还没有设置学期')
    expect(wrapper.find('.week-grid').exists()).toBe(false)
  })

  it('节次时间表决定网格行数', () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(WeekView)
    expect(wrapper.findAll('.time-cell')).toHaveLength(4)
  })
})
