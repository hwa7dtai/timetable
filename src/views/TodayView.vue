<script setup lang="ts">
import { computed, ref } from 'vue'

import SessionDetailSheet from '@/components/SessionDetailSheet.vue'
import { useClock } from '@/composables/useClock'
import { useTimetable } from '@/composables/useTimetable'
import { describeDayOffset, formatMinute, isoDayOfWeek, parseLocalDate } from '@/domain/date'
import {
  getCurrentSessionOccurrence,
  getNextSessionOccurrence,
  getSemesterStatus,
  getTodayOccurrences,
} from '@/domain/now'
import { formatPeriodLabel, formatWeekday } from '@/domain/schedule'
import type { Session } from '@/domain/types'
import { getWeekIndex } from '@/domain/week'

const { data } = useTimetable()
const { now } = useClock()

const selectedSession = ref<Session | null>(null)

function closeDetail() {
  selectedSession.value = null
}

const status = computed(() => getSemesterStatus(data.value, now.value))
const weekIndex = computed(() =>
  data.value.semester ? getWeekIndex(now.value, data.value.semester) : null,
)
const todayOccurrences = computed(() => getTodayOccurrences(data.value, now.value))
const current = computed(() => getCurrentSessionOccurrence(data.value, now.value))
const next = computed(() => getNextSessionOccurrence(data.value, now.value))

const todayLabel = computed(
  () =>
    `${now.value.getMonth() + 1} 月 ${now.value.getDate()} 日 ${formatWeekday(isoDayOfWeek(now.value))}`,
)

function courseName(courseId: string): string {
  return data.value.courses.find((course) => course.id === courseId)?.name ?? '未知课程'
}

function teacherOf(courseId: string): string {
  return data.value.courses.find((course) => course.id === courseId)?.teacher ?? ''
}

const remainingMinutes = computed(() => {
  const occurrence = current.value
  if (!occurrence) return 0
  return Math.max(0, Math.ceil((occurrence.end.getTime() - now.value.getTime()) / 60_000))
})

const progressPercent = computed(() => {
  const occurrence = current.value
  if (!occurrence) return 0
  const total = occurrence.end.getTime() - occurrence.start.getTime()
  if (total <= 0) return 0
  const passed = now.value.getTime() - occurrence.start.getTime()
  return Math.min(100, Math.max(0, Math.round((passed / total) * 100)))
})

const nextHint = computed(() => {
  const occurrence = next.value
  if (!occurrence) return ''
  const dayText = describeDayOffset(now.value, occurrence.start)
  const timeText = formatMinute(occurrence.start.getHours() * 60 + occurrence.start.getMinutes())
  return `${dayText} ${timeText} ${formatPeriodLabel(
    occurrence.session.startPeriod,
    occurrence.session.endPeriod,
  )} ${courseName(occurrence.session.courseId)}`
})

const beforeStartDays = computed(() => {
  const semester = data.value.semester
  if (!semester) return 0
  const start = parseLocalDate(semester.startDate)
  const diff = Math.ceil((start.getTime() - now.value.getTime()) / 86_400_000)
  return Math.max(0, diff)
})

function timeLabel(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function occurrenceTime(start: Date, end: Date): string {
  return `${timeLabel(start)} - ${timeLabel(end)}`
}
</script>

<template>
  <div>
    <section class="status-card">
      <template v-if="status === 'not-set'">
        <div class="label">尚未设置学期</div>
        <div class="value">先去「设置」填写</div>
        <div class="sub">需要第 1 周周一的日期，才能计算周次和单双周</div>
      </template>
      <template v-else-if="status === 'before'">
        <div class="label">距离学期开始</div>
        <div class="value">{{ beforeStartDays }} 天</div>
        <div class="sub">第 1 周周一：{{ data.semester?.startDate }}</div>
      </template>
      <template v-else-if="status === 'finished'">
        <div class="label">学期已结束</div>
        <div class="value">共 {{ data.semester?.totalWeeks }} 周</div>
        <div class="sub">如需查看历史，请调整学期起始日期</div>
      </template>
      <template v-else>
        <div class="label">{{ todayLabel }}</div>
        <div class="value">第 {{ weekIndex }} 周</div>
        <div class="sub">共 {{ data.semester?.totalWeeks }} 周</div>
      </template>
    </section>

    <section v-if="current" class="card current-card">
      <div class="row-between">
        <span class="badge">正在上课</span>
        <strong>还剩 {{ remainingMinutes }} 分钟</strong>
      </div>
      <h2 style="margin-top: 10px; font-size: 18px">
        {{ courseName(current.session.courseId) }}
      </h2>
      <p class="muted" style="margin: 4px 0 0">
        {{ formatPeriodLabel(current.session.startPeriod, current.session.endPeriod) }}
        {{ occurrenceTime(current.start, current.end) }}
        <template v-if="current.session.room"> · {{ current.session.room }}</template>
        <template v-if="teacherOf(current.session.courseId)">
          · {{ teacherOf(current.session.courseId) }}
        </template>
      </p>
      <div class="progress">
        <span :style="{ width: `${progressPercent}%` }" />
      </div>
    </section>

    <h3 class="card-title" style="padding: 4px 2px">今日课程</h3>

    <div v-if="status === 'not-set'" class="empty">设置学期后即可查看今日课程</div>
    <div v-else-if="todayOccurrences.length === 0" class="empty">
      今天没课
      <p v-if="nextHint" class="muted" style="margin-top: 8px">最近一节：{{ nextHint }}</p>
    </div>
    <button
      v-for="occurrence in todayOccurrences"
      :key="occurrence.session.id"
      class="lesson"
      :class="{ active: current?.session.id === occurrence.session.id }"
      type="button"
      @click="selectedSession = occurrence.session"
    >
      <div class="period">
        <strong>{{ occurrence.session.startPeriod }}-{{ occurrence.session.endPeriod }} 节</strong>
        <span>{{ timeLabel(occurrence.start) }}</span>
        <span>{{ timeLabel(occurrence.end) }}</span>
      </div>
      <div class="body">
        <div class="name">{{ courseName(occurrence.session.courseId) }}</div>
        <div class="meta">
          {{ occurrence.session.room || '未填写教室' }}
          <template v-if="teacherOf(occurrence.session.courseId)">
            · {{ teacherOf(occurrence.session.courseId) }}
          </template>
        </div>
      </div>
      <span v-if="current?.session.id === occurrence.session.id" class="badge">进行中</span>
    </button>

    <p v-if="todayOccurrences.length > 0 && nextHint" class="muted" style="padding: 4px 2px">
      下一节：{{ nextHint }}
    </p>

    <SessionDetailSheet :session="selectedSession" @close="closeDetail" />
  </div>
</template>
