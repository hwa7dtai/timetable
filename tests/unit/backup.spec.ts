import { describe, expect, it } from 'vitest'

import { buildBackupFileName, parseBackup, serializeBackup } from '@/data/backup'

import { at, makeData, makeSession } from './helpers'

describe('导出备份', () => {
  it('导出内容包含时间戳并能完整还原', () => {
    const data = makeData()
    const json = serializeBackup(data, at(2026, 9, 17, 9, 30, 12))
    const parsed = JSON.parse(json)

    expect(parsed.exportedAt).toBe(at(2026, 9, 17, 9, 30, 12).toISOString())

    const result = parseBackup(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.courses).toEqual(data.courses)
      expect(result.data.sessions).toEqual(data.sessions)
      expect(result.data.semester).toEqual(data.semester)
      expect(result.data.periodTable).toEqual(data.periodTable)
    }
  })

  it('生成带时间戳的文件名', () => {
    expect(buildBackupFileName(at(2026, 9, 17, 9, 30, 12))).toBe(
      'timetable-backup-20260917-093012.json',
    )
  })
})

describe('导入校验', () => {
  it('拒绝非法的 JSON', () => {
    const result = parseBackup('这不是 json')
    expect(result).toEqual({ ok: false, reason: 'invalid-json', message: '文件内容不是合法的 JSON' })
  })

  it('拒绝缺少版本号的数据', () => {
    const result = parseBackup(JSON.stringify({ courses: [], sessions: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid-shape')
  })

  it('拒绝高于当前支持版本的数据', () => {
    const result = parseBackup(JSON.stringify({ ...makeData(), schemaVersion: 99 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unsupported-version')
  })

  it('拒绝低于当前支持版本的数据', () => {
    const result = parseBackup(JSON.stringify({ ...makeData(), schemaVersion: 0 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unsupported-version')
  })

  it('拒绝非法的学期起始日期', () => {
    const data = makeData()
    const result = parseBackup(
      JSON.stringify({ ...data, semester: { startDate: '2026-02-30', totalWeeks: 18 } }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid-shape')
      expect(result.message).toContain('学期起始日期')
    }
  })

  it('拒绝非法的总周数', () => {
    const data = makeData()
    const result = parseBackup(
      JSON.stringify({ ...data, semester: { startDate: '2026-09-07', totalWeeks: 0 } }),
    )
    expect(result.ok).toBe(false)
  })

  it('拒绝空的节次时间表', () => {
    const data = makeData()
    const result = parseBackup(
      JSON.stringify({ ...data, periodTable: { id: 'x', name: 'x', periods: [] } }),
    )
    expect(result.ok).toBe(false)
  })

  it('拒绝起始节次晚于结束节次的时段', () => {
    const data = makeData()
    const result = parseBackup(
      JSON.stringify({ ...data, sessions: [makeSession({ startPeriod: 4, endPeriod: 2 })] }),
    )
    expect(result.ok).toBe(false)
  })

  it('拒绝起始周次晚于结束周次的时段', () => {
    const data = makeData()
    const result = parseBackup(
      JSON.stringify({ ...data, sessions: [makeSession({ weekStart: 10, weekEnd: 2 })] }),
    )
    expect(result.ok).toBe(false)
  })

  it('拒绝非法的单双周取值', () => {
    const data = makeData()
    const result = parseBackup(
      JSON.stringify({ ...data, sessions: [{ ...makeSession(), parity: 'sometimes' }] }),
    )
    expect(result.ok).toBe(false)
  })

  it('拒绝引用不存在课程的时段', () => {
    const data = makeData()
    const result = parseBackup(
      JSON.stringify({ ...data, sessions: [makeSession({ courseId: 'missing' })] }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('不存在课程')
  })

  it('拒绝非法的星期取值', () => {
    const data = makeData()
    const result = parseBackup(
      JSON.stringify({ ...data, sessions: [makeSession({ dayOfWeek: 8 })] }),
    )
    expect(result.ok).toBe(false)
  })

  it('重复的课程 ID 会被去重', () => {
    const data = makeData()
    const result = parseBackup(
      JSON.stringify({ ...data, courses: [...data.courses, ...data.courses] }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.courses).toHaveLength(1)
  })

  it('缺少可选字段时补为空字符串', () => {
    const result = parseBackup(
      JSON.stringify({
        schemaVersion: 1,
        semester: null,
        periodTable: { id: 'x', name: 'x', periods: [{ index: 1, startMinute: 480, endMinute: 525 }] },
        courses: [{ id: 'c1', name: '课程' }],
        sessions: [
          {
            id: 's1',
            courseId: 'c1',
            dayOfWeek: 1,
            startPeriod: 1,
            endPeriod: 1,
            weekStart: 1,
            weekEnd: 1,
            parity: 'all',
          },
        ],
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.courses[0].teacher).toBe('')
      expect(result.data.courses[0].note).toBe('')
      expect(result.data.sessions[0].room).toBe('')
    }
  })
})
