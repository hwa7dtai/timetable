import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetSharedClock } from '@/composables/useClock'
import { clearData, replaceData, useTimetable } from '@/composables/useTimetable'
import EditorView from '@/views/EditorView.vue'

import { at, makeData } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetSharedClock()
})

afterEach(() => {
  resetSharedClock()
  vi.useRealTimers()
  clearData()
})

async function fillCourseName(wrapper: ReturnType<typeof mount>, name: string) {
  await wrapper.find('#course-name').setValue(name)
}

describe('课程录入', () => {
  it('没有课程时显示空状态', () => {
    replaceData(makeData({ courses: [], sessions: [] }))
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(EditorView)
    expect(wrapper.text()).toContain('还没有录入课程')
  })

  it('列出现有课程及其时段摘要', () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(EditorView)
    const item = wrapper.find('.course-item')

    expect(item.text()).toContain('高等数学')
    expect(item.text()).toContain('张老师')
    expect(item.text()).toContain('周一 第 1-2 节 第 1-18 周')
    expect(item.text()).toContain('@三教302')
  })

  it('新增课程并保存到数据层', async () => {
    replaceData(makeData({ courses: [], sessions: [] }))
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(EditorView)
    await wrapper.findAll('button').find((node) => node.text() === '新增课程')!.trigger('click')
    await fillCourseName(wrapper, '大学物理')
    await wrapper.findAll('button').find((node) => node.text() === '保存')!.trigger('click')

    const { data } = useTimetable()
    expect(data.value.courses).toHaveLength(1)
    expect(data.value.courses[0].name).toBe('大学物理')
    expect(data.value.sessions).toHaveLength(1)
    expect(data.value.sessions[0].dayOfWeek).toBe(1)
    expect(data.value.sessions[0].courseId).toBe(data.value.courses[0].id)
  })

  it('课程名称为空时阻止保存', async () => {
    replaceData(makeData({ courses: [], sessions: [] }))
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(EditorView)
    await wrapper.findAll('button').find((node) => node.text() === '新增课程')!.trigger('click')
    await wrapper.findAll('button').find((node) => node.text() === '保存')!.trigger('click')

    expect(wrapper.text()).toContain('请填写课程名称')
    expect(useTimetable().data.value.courses).toHaveLength(0)
  })

  it('时间冲突时弹窗提示，可选择仍然保存', async () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(EditorView)
    await wrapper.findAll('button').find((node) => node.text() === '新增课程')!.trigger('click')
    await fillCourseName(wrapper, '大学物理')
    await wrapper.findAll('button').find((node) => node.text() === '保存')!.trigger('click')

    // 默认新时段是周一第 1-2 节，与已有的高等数学完全重叠
    expect(wrapper.text()).toContain('检测到时间冲突')
    expect(wrapper.text()).toContain('高等数学')
    expect(useTimetable().data.value.courses).toHaveLength(1)

    await wrapper.findAll('button').find((node) => node.text() === '仍然保存')!.trigger('click')

    const { data } = useTimetable()
    expect(data.value.courses).toHaveLength(2)
    expect(data.value.sessions).toHaveLength(2)
  })

  it('冲突弹窗可以返回修改', async () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(EditorView)
    await wrapper.findAll('button').find((node) => node.text() === '新增课程')!.trigger('click')
    await fillCourseName(wrapper, '大学物理')
    await wrapper.findAll('button').find((node) => node.text() === '保存')!.trigger('click')
    await wrapper.findAll('button').find((node) => node.text() === '返回修改')!.trigger('click')

    expect(wrapper.find('.sheet').exists()).toBe(false)
    expect(wrapper.find('#course-name').exists()).toBe(true)
    expect(useTimetable().data.value.courses).toHaveLength(1)
  })

  it('结束周次超过学期总周数时拒绝保存', async () => {
    replaceData(makeData({ semester: { startDate: '2026-09-07', totalWeeks: 3 } }))
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(EditorView)
    await wrapper.findAll('button').find((node) => node.text() === '新增课程')!.trigger('click')
    await fillCourseName(wrapper, '大学物理')

    // 学期只有 3 周，周次下拉只有 3 个选项，手动构造越界值
    const weekEndSelect = wrapper.findAll('select')[3]
    await weekEndSelect.setValue('1')
    expect(useTimetable().data.value.courses).toHaveLength(1)

    const options = weekEndSelect.findAll('option')
    expect(options).toHaveLength(3)
  })

  it('编辑已有课程时预填内容', async () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(EditorView)
    await wrapper.findAll('button').find((node) => node.text() === '编辑')!.trigger('click')

    expect((wrapper.find('#course-name').element as HTMLInputElement).value).toBe('高等数学')
    expect(wrapper.text()).toContain('编辑课程')
  })

  it('删除课程需要二次确认', async () => {
    replaceData(makeData())
    vi.setSystemTime(at(2026, 9, 14, 8, 30))

    const wrapper = mount(EditorView)
    await wrapper.findAll('button').find((node) => node.text() === '删除')!.trigger('click')

    expect(wrapper.text()).toContain('删除课程')

    await wrapper.findAll('button').find((node) => node.text() === '确认删除')!.trigger('click')

    const { data } = useTimetable()
    expect(data.value.courses).toHaveLength(0)
    expect(data.value.sessions).toHaveLength(0)
  })
})
