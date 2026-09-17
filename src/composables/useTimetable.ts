import { computed, ref } from 'vue'

import { createRepository, type LoadIssue } from '@/data/repository'
import { detectConflicts, type Conflict } from '@/domain/conflict'
import { getSessionsOfCourse } from '@/domain/courses'
import type { AppData, PeriodTable, Semester, Session, WeekParity } from '@/domain/types'
import { createId } from '@/utils/id'

export interface SessionDraft {
  id: string | null
  dayOfWeek: number
  startPeriod: number
  endPeriod: number
  weekStart: number
  weekEnd: number
  parity: WeekParity
  room: string
}

export interface CourseDraft {
  /** null 表示新建课程 */
  id: string | null
  name: string
  teacher: string
  note: string
  sessions: SessionDraft[]
}

/** 某个待保存时段与已有课程的冲突情况 */
export interface SessionConflictReport {
  draftSession: SessionDraft
  conflicts: Conflict[]
}

export function createEmptySessionDraft(overrides: Partial<SessionDraft> = {}): SessionDraft {
  return {
    id: null,
    dayOfWeek: 1,
    startPeriod: 1,
    endPeriod: 2,
    weekStart: 1,
    weekEnd: 18,
    parity: 'all',
    room: '',
    ...overrides,
  }
}

export function createEmptyCourseDraft(): CourseDraft {
  return {
    id: null,
    name: '',
    teacher: '',
    note: '',
    sessions: [createEmptySessionDraft()],
  }
}

const repository = createRepository()
const initial = repository.load()

const data = ref<AppData>(initial.data)
const issues = ref<LoadIssue[]>([...initial.issues])
const persistent = ref(repository.isPersistent())

function reportSaveFailure() {
  if (issues.value.some((issue) => issue.kind === 'storage-unavailable')) return
  issues.value.push({
    kind: 'storage-unavailable',
    message: '数据保存失败，本次改动可能不会被保留，请及时导出备份。',
  })
}

function commit(next: AppData) {
  data.value = next
  const ok = repository.save(next)
  if (!ok) {
    persistent.value = repository.isPersistent()
    reportSaveFailure()
  }
}

function toSession(draft: SessionDraft, courseId: string): Session {
  return {
    id: draft.id ?? createId(),
    courseId,
    dayOfWeek: draft.dayOfWeek,
    startPeriod: draft.startPeriod,
    endPeriod: draft.endPeriod,
    weekStart: draft.weekStart,
    weekEnd: draft.weekEnd,
    parity: draft.parity,
    room: draft.room,
  }
}

/**
 * 检测草稿中的冲突。
 * 比较对象包括其他课程的全部时段，以及同一份草稿中除自身以外的时段。
 */
export function findDraftConflicts(draft: CourseDraft): SessionConflictReport[] {
  const courseId = draft.id ?? '__draft__'
  const ownSessionIds = new Set(
    draft.sessions.map((session) => session.id).filter((id): id is string => id !== null),
  )
  const others = data.value.sessions.filter(
    (session) => session.courseId !== draft.id || !ownSessionIds.has(session.id),
  )

  const reports: SessionConflictReport[] = []
  draft.sessions.forEach((draftSession, index) => {
    const candidate = toSession(draftSession, courseId)
    const siblings = draft.sessions
      .filter((_, otherIndex) => otherIndex !== index)
      .map((sibling) => toSession(sibling, courseId))

    const conflicts = detectConflicts(candidate, [...others, ...siblings])
    if (conflicts.length > 0) {
      reports.push({ draftSession, conflicts })
    }
  })
  return reports
}

/** 保存课程及其全部时段；草稿中删除的时段会随之移除 */
export function saveCourse(draft: CourseDraft): string {
  const courseId = draft.id ?? createId()
  const sessions = draft.sessions.map((session) => toSession(session, courseId))
  const nextSessions = [
    ...data.value.sessions.filter((session) => session.courseId !== courseId),
    ...sessions,
  ]

  const course = {
    id: courseId,
    name: draft.name.trim(),
    teacher: draft.teacher.trim(),
    note: draft.note.trim(),
  }
  const exists = data.value.courses.some((item) => item.id === courseId)
  const courses = exists
    ? data.value.courses.map((item) => (item.id === courseId ? course : item))
    : [...data.value.courses, course]

  commit({ ...data.value, courses, sessions: nextSessions })
  return courseId
}

/** 删除整门课程及其全部时段 */
export function removeCourse(courseId: string) {
  commit({
    ...data.value,
    courses: data.value.courses.filter((course) => course.id !== courseId),
    sessions: data.value.sessions.filter((session) => session.courseId !== courseId),
  })
}

export function setSemester(semester: Semester | null) {
  commit({ ...data.value, semester })
}

export function setPeriodTable(periodTable: PeriodTable) {
  commit({ ...data.value, periodTable })
}

export function replaceData(next: AppData) {
  commit(next)
}

export function clearData() {
  commit({ ...data.value, courses: [], sessions: [], semester: null })
}

export function dismissIssue(kind: LoadIssue['kind']) {
  issues.value = issues.value.filter((issue) => issue.kind !== kind)
}

export function useTimetable() {
  return {
    data,
    issues,
    persistent,
    courses: computed(() => data.value.courses),
    sessions: computed(() => data.value.sessions),
    semester: computed(() => data.value.semester),
    periodTable: computed(() => data.value.periodTable),
    findDraftConflicts,
    saveCourse,
    removeCourse,
    setSemester,
    setPeriodTable,
    replaceData,
    clearData,
    dismissIssue,
    serialize: () => repository.serialize(data.value),
    backupFileName: () => repository.backupFileName(),
    importBackup: (json: string) => repository.importBackup(json),
    getSessionsOfCourse: (courseId: string) => getSessionsOfCourse(data.value, courseId),
  }
}
