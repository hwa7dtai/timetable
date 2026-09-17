<script setup lang="ts">
import { computed, ref } from 'vue'

import ConflictDialog from '@/components/ConflictDialog.vue'
import {
  createEmptyCourseDraft,
  createEmptySessionDraft,
  useTimetable,
  type CourseDraft,
  type SessionConflictReport,
} from '@/composables/useTimetable'
import { formatPeriodLabel, formatWeekday, formatWeekLabel } from '@/domain/schedule'
import type { Course } from '@/domain/types'

const { data, saveCourse, removeCourse, findDraftConflicts, getSessionsOfCourse } = useTimetable()

const draft = ref<CourseDraft | null>(null)
const errorText = ref('')
const conflicts = ref<SessionConflictReport[]>([])
const deleting = ref<Course | null>(null)

const periods = computed(() =>
  [...data.value.periodTable.periods].sort((a, b) => a.index - b.index),
)
const maxWeeks = computed(() => data.value.semester?.totalWeeks ?? 18)
const weeksOptions = computed(() =>
  Array.from({ length: maxWeeks.value }, (_, index) => index + 1),
)

function sessionSummary(course: Course): string {
  const sessions = getSessionsOfCourse(course.id)
  if (sessions.length === 0) return '暂无上课时段'
  return sessions
    .map(
      (session) =>
        `${formatWeekday(session.dayOfWeek)} ${formatPeriodLabel(
          session.startPeriod,
          session.endPeriod,
        )} ${formatWeekLabel(session)}${session.room ? ` @${session.room}` : ''}`,
    )
    .join('；')
}

function startCreate() {
  draft.value = {
    ...createEmptyCourseDraft(),
    sessions: [createEmptySessionDraft({ weekEnd: maxWeeks.value })],
  }
  errorText.value = ''
  conflicts.value = []
}

function startEdit(course: Course) {
  const sessions = getSessionsOfCourse(course.id)
  draft.value = {
    id: course.id,
    name: course.name,
    teacher: course.teacher,
    note: course.note,
    sessions:
      sessions.length > 0
        ? sessions.map((session) => ({
            id: session.id,
            dayOfWeek: session.dayOfWeek,
            startPeriod: session.startPeriod,
            endPeriod: session.endPeriod,
            weekStart: session.weekStart,
            weekEnd: session.weekEnd,
            parity: session.parity,
            room: session.room,
          }))
        : [createEmptySessionDraft({ weekEnd: maxWeeks.value })],
  }
  errorText.value = ''
  conflicts.value = []
}

function addSessionRow() {
  draft.value?.sessions.push(createEmptySessionDraft({ weekEnd: maxWeeks.value }))
}

function removeSessionRow(index: number) {
  draft.value?.sessions.splice(index, 1)
}

function cancelEdit() {
  draft.value = null
  errorText.value = ''
  conflicts.value = []
}

function validate(current: CourseDraft): string {
  if (!current.name.trim()) return '请填写课程名称'
  if (current.sessions.length === 0) return '至少需要一个上课时段'

  for (let index = 0; index < current.sessions.length; index += 1) {
    const session = current.sessions[index]
    const label = `第 ${index + 1} 个时段`
    if (session.startPeriod > session.endPeriod) {
      return `${label}：起始节次不能晚于结束节次`
    }
    if (session.weekStart > session.weekEnd) {
      return `${label}：起始周次不能晚于结束周次`
    }
    if (session.weekStart < 1) {
      return `${label}：起始周次不能小于 1`
    }
    if (session.weekEnd > maxWeeks.value) {
      return `${label}：结束周次不能超过学期总周数（${maxWeeks.value} 周）`
    }
  }
  return ''
}

function persist() {
  if (!draft.value) return
  saveCourse(draft.value)
  cancelEdit()
}

function submit() {
  const current = draft.value
  if (!current) return

  const message = validate(current)
  if (message) {
    errorText.value = message
    return
  }
  errorText.value = ''

  const found = findDraftConflicts(current)
  if (found.length > 0) {
    conflicts.value = found
    return
  }
  persist()
}

function confirmConflictSave() {
  conflicts.value = []
  persist()
}

function cancelConflicts() {
  conflicts.value = []
}

function askDelete(course: Course) {
  deleting.value = course
}

function cancelDelete() {
  deleting.value = null
}

function confirmDelete() {
  if (deleting.value) removeCourse(deleting.value.id)
  deleting.value = null
}
</script>

<template>
  <div>
    <template v-if="!draft">
      <button class="btn block" type="button" @click="startCreate">新增课程</button>

      <div class="card" style="margin-top: 12px">
        <div class="card-title">
          <span>已有课程</span>
          <span class="muted">{{ data.courses.length }} 门</span>
        </div>

        <div v-if="data.courses.length === 0" class="empty">还没有录入课程</div>

        <div v-for="course in data.courses" :key="course.id" class="course-item">
          <div class="body">
            <div class="name">{{ course.name }}</div>
            <div v-if="course.teacher" class="muted">{{ course.teacher }}</div>
            <div class="sessions">{{ sessionSummary(course) }}</div>
          </div>
          <div class="row">
            <button class="btn small secondary" type="button" @click="startEdit(course)">
              编辑
            </button>
            <button class="btn small danger" type="button" @click="askDelete(course)">
              删除
            </button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="card">
        <div class="card-title">
          <span>{{ draft.id ? '编辑课程' : '新增课程' }}</span>
          <button class="btn small ghost" type="button" @click="cancelEdit">取消</button>
        </div>

        <div class="field">
          <label for="course-name">课程名称</label>
          <input id="course-name" v-model="draft.name" placeholder="如：高等数学" />
        </div>

        <div class="field-row cols-2">
          <div class="field">
            <label for="course-teacher">老师</label>
            <input id="course-teacher" v-model="draft.teacher" placeholder="选填" />
          </div>
          <div class="field">
            <label for="course-note">备注</label>
            <input id="course-note" v-model="draft.note" placeholder="选填" />
          </div>
        </div>
      </div>

      <div v-for="(session, index) in draft.sessions" :key="index" class="session-editor">
        <header>
          <span>时段 {{ index + 1 }}</span>
          <button
            class="btn small danger"
            type="button"
            :disabled="draft.sessions.length <= 1"
            @click="removeSessionRow(index)"
          >
            删除时段
          </button>
        </header>

        <div class="field-row cols-2">
          <div class="field">
            <label>星期</label>
            <select v-model.number="session.dayOfWeek">
              <option v-for="day in 7" :key="day" :value="day">{{ formatWeekday(day) }}</option>
            </select>
          </div>
          <div class="field">
            <label>教室</label>
            <input v-model="session.room" placeholder="如：三教 302" />
          </div>
        </div>

        <div class="field-row cols-2">
          <div class="field">
            <label>起始节次</label>
            <select v-model.number="session.startPeriod">
              <option v-for="period in periods" :key="period.index" :value="period.index">
                第 {{ period.index }} 节
              </option>
            </select>
          </div>
          <div class="field">
            <label>结束节次</label>
            <select v-model.number="session.endPeriod">
              <option v-for="period in periods" :key="period.index" :value="period.index">
                第 {{ period.index }} 节
              </option>
            </select>
          </div>
        </div>

        <div class="field-row cols-3">
          <div class="field">
            <label>起始周</label>
            <select v-model.number="session.weekStart">
              <option v-for="week in weeksOptions" :key="week" :value="week">
                第 {{ week }} 周
              </option>
            </select>
          </div>
          <div class="field">
            <label>结束周</label>
            <select v-model.number="session.weekEnd">
              <option v-for="week in weeksOptions" :key="week" :value="week">
                第 {{ week }} 周
              </option>
            </select>
          </div>
          <div class="field">
            <label>单双周</label>
            <select v-model="session.parity">
              <option value="all">每周</option>
              <option value="odd">单周</option>
              <option value="even">双周</option>
            </select>
          </div>
        </div>
      </div>

      <button class="btn block secondary" type="button" @click="addSessionRow">添加时段</button>

      <p v-if="errorText" class="error-text" style="margin-top: 10px">{{ errorText }}</p>

      <div class="actions">
        <button class="btn ghost" type="button" @click="cancelEdit">取消</button>
        <button class="btn" type="button" @click="submit">保存</button>
      </div>
    </template>

    <ConflictDialog
      v-if="conflicts.length > 0"
      :reports="conflicts"
      @cancel="cancelConflicts"
      @confirm="confirmConflictSave"
    />

    <div v-if="deleting" class="sheet-mask">
      <div class="sheet">
        <h2>删除课程</h2>
        <p class="muted">
          将删除《{{ deleting.name }}》及其全部上课时段，此操作不可撤销。
        </p>
        <div class="actions">
          <button class="btn ghost" type="button" @click="cancelDelete">取消</button>
          <button class="btn danger" type="button" @click="confirmDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
