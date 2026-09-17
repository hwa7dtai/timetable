import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetSharedClock } from '@/composables/useClock'
import { clearData, replaceData } from '@/composables/useTimetable'
import TodayView from '@/views/TodayView.vue'

import { at, makeCourse, makeData, makeSession } from './helpers'

const mondayData = makeData()

beforeEach(() => {
  vi.useFakeTimers()
  resetSharedClock()
})

afterEach(() => {
  resetSharedClock()
  vi.useRealTimers()
  clearData()
})

describe('今日视图', () => {
  it('显示当前周次与正在上的课', () => {
    replaceData(mondayData)
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(TodayView)
    const text = wrapper.text()

    expect(text).toContain('第 2 周')
    expect(text).toContain('正在上课')
    expect(text).toContain('还剩 70 分钟')
    expect(text).toContain('高等数学')
    expect(text).toContain('三教302')
    expect(text).toContain('张老师')

    const activeLesson = wrapper.find('.lesson.active')
    expect(activeLesson.exists()).toBe(true)
    expect(activeLesson.find('.badge').text()).toBe('进行中')
  })

  it('正好在下课时刻不再高亮当前课', () => {
    replaceData(mondayData)
    vi.setSystemTime(at(2026, 9, 14, 9, 40))

    const wrapper = mount(TodayView)
    const text = wrapper.text()

    expect(text).not.toContain('正在上课')
    expect(text).toContain('下一节')
  })

  it('今天没课时给出最近一节课的提示', () => {
    replaceData(mondayData)
    vi.setSystemTime(at(2026, 9, 17, 9, 0))

    const wrapper = mount(TodayView)
    const text = wrapper.text()

    expect(text).toContain('今天没课')
    expect(text).toContain('最近一节')
    expect(text).toContain('高等数学')
  })

  it('未设置学期时给出引导', () => {
    replaceData(makeData({ semester: null }))
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(TodayView)
    expect(wrapper.text()).toContain('尚未设置学期')
    expect(wrapper.text()).toContain('设置学期后即可查看今日课程')
  })

  it('新学期开始前显示倒计时', () => {
    replaceData(mondayData)
    vi.setSystemTime(at(2026, 9, 3, 10, 0))

    const wrapper = mount(TodayView)
    expect(wrapper.text()).toContain('距离学期开始')
    expect(wrapper.text()).toContain('4 天')
  })

  it('学期结束后给出结束提示', () => {
    replaceData(mondayData)
    vi.setSystemTime(at(2027, 2, 1, 10, 0))

    const wrapper = mount(TodayView)
    expect(wrapper.text()).toContain('学期已结束')
  })

  it('点击今日课程可以打开详情', async () => {
    replaceData(mondayData)
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(TodayView)
    expect(wrapper.find('.sheet').exists()).toBe(false)

    await wrapper.find('.lesson').trigger('click')

    const sheet = wrapper.find('.sheet')
    expect(sheet.exists()).toBe(true)
    expect(sheet.text()).toContain('高等数学')
    expect(sheet.text()).toContain('三教302')
    expect(sheet.text()).toContain('第 1-18 周')
  })

  it('多门课程按节次顺序展示', () => {
    replaceData(
      makeData({
        courses: [makeCourse({ id: 'c1', name: '高等数学' }), makeCourse({ id: 'c2', name: '大学物理' })],
        sessions: [
          makeSession({ id: 's2', courseId: 'c2', dayOfWeek: 1, startPeriod: 3, endPeriod: 4 }),
          makeSession({ id: 's1', courseId: 'c1', dayOfWeek: 1, startPeriod: 1, endPeriod: 2 }),
        ],
      }),
    )
    vi.setSystemTime(at(2026, 9, 14, 7, 0))

    const wrapper = mount(TodayView)
    const names = wrapper.findAll('.lesson .name').map((node) => node.text())
    expect(names).toEqual(['高等数学', '大学物理'])
  })
})
