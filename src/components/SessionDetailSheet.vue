<script setup lang="ts">
import { computed } from 'vue'

import { useTimetable } from '@/composables/useTimetable'
import { formatMinute } from '@/domain/date'
import { formatPeriodLabel, formatWeekday, formatWeekLabel } from '@/domain/schedule'
import type { Session } from '@/domain/types'

const props = defineProps<{ session: Session | null }>()
const emit = defineEmits<{ close: [] }>()

const { data } = useTimetable()

const course = computed(() =>
  props.session ? data.value.courses.find((item) => item.id === props.session?.courseId) : undefined,
)

const periodTime = computed(() => {
  if (!props.session) return ''
  const periods = data.value.periodTable.periods
  const first = periods.find((period) => period.index === props.session?.startPeriod)
  const last = periods.find((period) => period.index === props.session?.endPeriod)
  if (!first || !last) return ''
  return `${formatMinute(first.startMinute)} - ${formatMinute(last.endMinute)}`
})
</script>

<template>
  <div v-if="session" class="sheet-mask" @click.self="emit('close')">
    <div class="sheet">
      <h2>{{ course?.name ?? '未知课程' }}</h2>
      <p class="muted">{{ formatPeriodLabel(session.startPeriod, session.endPeriod) }}</p>

      <dl class="detail-list">
        <dt>星期</dt>
        <dd>{{ formatWeekday(session.dayOfWeek) }}</dd>
        <dt>时间</dt>
        <dd>{{ periodTime }}</dd>
        <dt>教室</dt>
        <dd>{{ session.room || '未填写' }}</dd>
        <dt>老师</dt>
        <dd>{{ course?.teacher || '未填写' }}</dd>
        <dt>周次</dt>
        <dd>{{ formatWeekLabel(session) }}</dd>
        <dt v-if="course?.note">备注</dt>
        <dd v-if="course?.note">{{ course.note }}</dd>
      </dl>

      <button class="btn block secondary" type="button" @click="emit('close')">关闭</button>
    </div>
  </div>
</template>
