<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import SessionDetailSheet from '@/components/SessionDetailSheet.vue'
import { useClock } from '@/composables/useClock'
import { useTimetable } from '@/composables/useTimetable'
import { addDays, formatMinute, parseLocalDate } from '@/domain/date'
import { getCurrentSessionOccurrence } from '@/domain/now'
import { formatWeekday, getSessionsOfWeek } from '@/domain/schedule'
import type { Session } from '@/domain/types'
import { getWeekIndex } from '@/domain/week'

const ROW_HEIGHT = 58

interface LaidOutSession {
  session: Session
  top: number
  height: number
  leftPercent: number
  widthPercent: number
}

const { data } = useTimetable()
const { now } = useClock()

const selectedSession = ref<Session | null>(null)
const viewWeek = ref(1)

function closeDetail() {
  selectedSession.value = null
}

const semester = computed(() => data.value.semester)
const totalWeeks = computed(() => semester.value?.totalWeeks ?? 0)
const currentWeek = computed(() =>
  semester.value ? getWeekIndex(now.value, semester.value) : 0,
)

watch(
  currentWeek,
  (week) => {
    if (week >= 1 && week <= (totalWeeks.value || week)) {
      viewWeek.value = week
    }
  },
  { immediate: true },
)

const periods = computed(() =>
  [...data.value.periodTable.periods].sort((a, b) => a.index - b.index),
)
const minPeriod = computed(() => periods.value[0]?.index ?? 1)
const gridHeight = computed(() => periods.value.length * ROW_HEIGHT)

const weekSessions = computed(() =>
  semester.value && viewWeek.value >= 1 ? getSessionsOfWeek(data.value, viewWeek.value) : [],
)

const currentOccurrence = computed(() => getCurrentSessionOccurrence(data.value, now.value))

/** 每周第一天的日期，用于表头的日期显示 */
const weekStartDate = computed(() =>
  semester.value
    ? addDays(parseLocalDate(semester.value.startDate), (viewWeek.value - 1) * 7)
    : null,
)

function dateOfDay(dayOfWeek: number): Date | null {
  if (!weekStartDate.value) return null
  return addDays(weekStartDate.value, dayOfWeek - 1)
}

function isToday(dayOfWeek: number): boolean {
  const date = dateOfDay(dayOfWeek)
  if (!date) return false
  return date.getTime() === new Date(now.value.getFullYear(), now.value.getMonth(), now.value.getDate()).getTime()
}

/**
 * 同一天内重叠的时段按「泳道」并排显示。
 * 先用区间聚类分出互不重叠的簇，再在簇内贪心分配泳道。
 */
const layoutByDay = computed<Record<number, LaidOutSession[]>>(() => {
  const result: Record<number, LaidOutSession[]> = {}

  for (let day = 1; day <= 7; day += 1) {
    const daySessions = weekSessions.value.filter((session) => session.dayOfWeek === day)
    const sorted = [...daySessions].sort(
      (a, b) => a.startPeriod - b.startPeriod || a.endPeriod - b.endPeriod,
    )

    const items: LaidOutSession[] = []
    let cluster: Session[] = []
    let clusterEnd = Number.NEGATIVE_INFINITY

    const flush = () => {
      if (cluster.length === 0) return
      const laneEnds: number[] = []
      const placed = cluster.map((session) => {
        let lane = laneEnds.findIndex((end) => end < session.startPeriod)
        if (lane === -1) {
          lane = laneEnds.length
          laneEnds.push(session.endPeriod)
        } else {
          laneEnds[lane] = session.endPeriod
        }
        return { session, lane }
      })
      const lanes = Math.max(1, laneEnds.length)
      for (const item of placed) {
        items.push({
          session: item.session,
          top: (item.session.startPeriod - minPeriod.value) * ROW_HEIGHT,
          height: (item.session.endPeriod - item.session.startPeriod + 1) * ROW_HEIGHT,
          leftPercent: (item.lane * 100) / lanes,
          widthPercent: 100 / lanes,
        })
      }
      cluster = []
    }

    for (const session of sorted) {
      if (cluster.length > 0 && session.startPeriod > clusterEnd) flush()
      cluster.push(session)
      clusterEnd = Math.max(clusterEnd, session.endPeriod)
    }
    flush()

    result[day] = items
  }

  return result
})

function courseName(courseId: string): string {
  return data.value.courses.find((course) => course.id === courseId)?.name ?? '未知课程'
}

function isCurrent(session: Session): boolean {
  return (
    viewWeek.value === currentWeek.value &&
    currentOccurrence.value?.session.id === session.id
  )
}

function goPrev() {
  if (viewWeek.value > 1) viewWeek.value -= 1
}

function goNext() {
  if (viewWeek.value < totalWeeks.value) viewWeek.value += 1
}

function goCurrent() {
  if (currentWeek.value >= 1) viewWeek.value = currentWeek.value
}

function periodTime(index: number): string {
  const period = periods.value.find((item) => item.index === index)
  return period ? formatMinute(period.startMinute) : ''
}
</script>

<template>
  <div>
    <div v-if="!semester" class="empty">
      还没有设置学期
      <p class="muted" style="margin-top: 8px">在「设置」里填写第 1 周周一的日期后即可查看课表</p>
    </div>

    <template v-else>
      <div class="week-switcher">
        <button class="btn small ghost" type="button" :disabled="viewWeek <= 1" @click="goPrev">
          上一周
        </button>
        <div class="title">第 {{ viewWeek }} 周 / 共 {{ totalWeeks }} 周</div>
        <button
          class="btn small ghost"
          type="button"
          :disabled="viewWeek >= totalWeeks"
          @click="goNext"
        >
          下一周
        </button>
      </div>

      <button
        v-if="currentWeek >= 1 && currentWeek <= totalWeeks && viewWeek !== currentWeek"
        class="btn small secondary block"
        style="margin-bottom: 10px"
        type="button"
        @click="goCurrent"
      >
        回到第 {{ currentWeek }} 周
      </button>

      <div class="week-grid">
        <div class="grid-head">
          <div class="corner" />
          <div
            v-for="day in 7"
            :key="day"
            class="day"
            :class="{ today: isToday(day) }"
          >
            {{ formatWeekday(day) }}
            <div v-if="dateOfDay(day)" class="date">
              {{ dateOfDay(day)!.getMonth() + 1 }}/{{ dateOfDay(day)!.getDate() }}
            </div>
          </div>
        </div>

        <div class="grid-body" :style="{ height: `${gridHeight}px` }">
          <div class="time-col">
            <div
              v-for="period in periods"
              :key="period.index"
              class="time-cell"
              :style="{ height: `${ROW_HEIGHT}px` }"
            >
              <span class="index">{{ period.index }}</span>
              <span class="time">{{ periodTime(period.index) }}</span>
            </div>
          </div>

          <div v-for="day in 7" :key="day" class="day-col">
            <div
              v-for="period in periods"
              :key="period.index"
              class="row-line"
              :style="{ height: `${ROW_HEIGHT}px` }"
            />

            <button
              v-for="item in layoutByDay[day]"
              :key="item.session.id"
              class="session-card"
              :class="{ current: isCurrent(item.session) }"
              type="button"
              :style="{
                top: `${item.top}px`,
                height: `${item.height}px`,
                left: `${item.leftPercent}%`,
                width: `${item.widthPercent}%`,
              }"
              @click="selectedSession = item.session"
            >
              <div class="inner">
                <div class="name">{{ courseName(item.session.courseId) }}</div>
                <div v-if="item.session.room" class="room">{{ item.session.room }}</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <p class="muted" style="padding: 10px 2px">点击格子可查看课程详情</p>
    </template>

    <SessionDetailSheet :session="selectedSession" @close="closeDetail" />
  </div>
</template>
