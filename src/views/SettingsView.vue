<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSettings } from '@/composables/useSettings'
import { useTimetable } from '@/composables/useTimetable'
import { formatMinute, isValidDateString, parseMinute } from '@/domain/date'
import type { Period } from '@/domain/types'
import { getWeekIndex } from '@/domain/week'

interface PeriodRow {
  start: string
  end: string
}

const { data } = useTimetable()
const { semester, saveSemester, clearSemester, setPeriodTable, normalizeStartDate } = useSettings()

const startDate = ref('')
const totalWeeks = ref(18)
const settingsMessage = ref('')

watch(
  semester,
  (value) => {
    startDate.value = value?.startDate ?? ''
    totalWeeks.value = value?.totalWeeks ?? 18
  },
  { immediate: true },
)

const normalizedPreview = computed(() => {
  if (!isValidDateString(startDate.value)) return ''
  const normalized = normalizeStartDate(startDate.value)
  return normalized === startDate.value ? '' : `将按 ${normalized}（周一）保存`
})

const currentWeekText = computed(() => {
  if (!semester.value) return '未设置学期'
  const week = getWeekIndex(new Date(), semester.value)
  if (week < 1) return '尚未开学'
  if (week > semester.value.totalWeeks) return '学期已结束'
  return `当前是第 ${week} 周`
})

function submitSemester() {
  if (!isValidDateString(startDate.value)) {
    settingsMessage.value = '请选择有效的第 1 周周一日期'
    return
  }
  if (!Number.isInteger(totalWeeks.value) || totalWeeks.value < 1 || totalWeeks.value > 60) {
    settingsMessage.value = '总周数需在 1 到 60 之间'
    return
  }
  saveSemester(startDate.value, totalWeeks.value)
  settingsMessage.value = '学期设置已保存'
}

/* ---------- 节次时间表 ---------- */

const periodRows = ref<PeriodRow[]>([])
const periodMessage = ref('')

watch(
  () => data.value.periodTable,
  (table) => {
    periodRows.value = [...table.periods]
      .sort((a, b) => a.index - b.index)
      .map((period) => ({
        start: formatMinute(period.startMinute),
        end: formatMinute(period.endMinute),
      }))
  },
  { immediate: true, deep: true },
)

function addPeriodRow() {
  const last = periodRows.value[periodRows.value.length - 1]
  const lastEnd = last ? parseMinute(last.end) : null
  const startMinute = lastEnd === null ? 8 * 60 : Math.min(lastEnd + 10, 23 * 60 + 59)
  periodRows.value.push({
    start: formatMinute(startMinute),
    end: formatMinute(Math.min(startMinute + 45, 23 * 60 + 59)),
  })
}

function removePeriodRow(index: number) {
  if (periodRows.value.length <= 1) return
  periodRows.value.splice(index, 1)
}

function submitPeriods() {
  const periods: Period[] = []
  for (let index = 0; index < periodRows.value.length; index += 1) {
    const row = periodRows.value[index]
    const start = parseMinute(row.start)
    const end = parseMinute(row.end)
    if (start === null || end === null) {
      periodMessage.value = `第 ${index + 1} 节的时间格式不正确`
      return
    }
    if (start === end) {
      periodMessage.value = `第 ${index + 1} 节的开始与结束时间相同`
      return
    }
    periods.push({ index: index + 1, startMinute: start, endMinute: end })
  }

  setPeriodTable({
    id: data.value.periodTable.id,
    name: data.value.periodTable.name,
    periods,
  })
  periodMessage.value = '节次时间表已保存'
}
</script>

<template>
  <div>
    <section class="card">
      <div class="card-title">
        <span>学期设置</span>
        <span class="muted">{{ currentWeekText }}</span>
      </div>

      <div class="field">
        <label for="semester-start">第 1 周周一</label>
        <input id="semester-start" v-model="startDate" type="date" />
        <span v-if="normalizedPreview" class="muted">{{ normalizedPreview }}</span>
      </div>

      <div class="field">
        <label for="semester-weeks">总周数</label>
        <input id="semester-weeks" v-model.number="totalWeeks" type="number" min="1" max="60" />
      </div>

      <p v-if="settingsMessage" class="muted">{{ settingsMessage }}</p>

      <div class="actions">
        <button class="btn ghost" type="button" @click="clearSemester">清除学期</button>
        <button class="btn" type="button" @click="submitSemester">保存学期</button>
      </div>
    </section>

    <section class="card">
      <div class="card-title">
        <span>节次时间表</span>
        <span class="muted">共 {{ periodRows.length }} 节</span>
      </div>

      <div
        v-for="(row, index) in periodRows"
        :key="index"
        class="field-row cols-3"
        style="align-items: end; margin-bottom: 8px"
      >
        <div class="field" style="margin-bottom: 0">
          <label>第 {{ index + 1 }} 节</label>
          <input v-model="row.start" type="time" />
        </div>
        <div class="field" style="margin-bottom: 0">
          <label>结束</label>
          <input v-model="row.end" type="time" />
        </div>
        <button
          class="btn small danger"
          type="button"
          :disabled="periodRows.length <= 1"
          @click="removePeriodRow(index)"
        >
          删除
        </button>
      </div>

      <p v-if="periodMessage" class="muted">{{ periodMessage }}</p>

      <div class="actions">
        <button class="btn ghost" type="button" @click="addPeriodRow">添加节次</button>
        <button class="btn" type="button" @click="submitPeriods">保存时间表</button>
      </div>
    </section>
  </div>
</template>
