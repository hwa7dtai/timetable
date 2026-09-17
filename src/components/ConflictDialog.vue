<script setup lang="ts">
import { useTimetable } from '@/composables/useTimetable'
import type { SessionConflictReport } from '@/composables/useTimetable'
import { formatPeriodLabel, formatWeekday } from '@/domain/schedule'

defineProps<{ reports: SessionConflictReport[] }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()

const { data } = useTimetable()

function courseName(courseId: string): string {
  return data.value.courses.find((course) => course.id === courseId)?.name ?? '未知课程'
}

function summarizeWeeks(weeks: number[]): string {
  return weeks.length > 6 ? `${weeks.slice(0, 6).join('、')} 等 ${weeks.length} 个周次` : weeks.join('、')
}
</script>

<template>
  <div class="sheet-mask">
    <div class="sheet">
      <h2>检测到时间冲突</h2>
      <p class="muted">以下时段与其他课程在相同时间上课，请确认后决定是否继续保存。</p>

      <div class="conflict-list">
        <div v-for="(report, index) in reports" :key="index" class="conflict-item">
          <div>
            <strong>{{ formatWeekday(report.draftSession.dayOfWeek) }}</strong>
            {{ formatPeriodLabel(report.draftSession.startPeriod, report.draftSession.endPeriod) }}
          </div>
          <div v-for="conflict in report.conflicts" :key="conflict.session.id" class="weeks">
            与《{{ courseName(conflict.session.courseId) }}》{{
              formatWeekday(conflict.session.dayOfWeek)
            }}{{ formatPeriodLabel(conflict.session.startPeriod, conflict.session.endPeriod) }}
            在第 {{ summarizeWeeks(conflict.weeks) }} 周冲突
            <template v-if="conflict.sameCourse">（同一门课程的时段重叠）</template>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn ghost" type="button" @click="emit('cancel')">返回修改</button>
        <button class="btn danger" type="button" @click="emit('confirm')">仍然保存</button>
      </div>
    </div>
  </div>
</template>
