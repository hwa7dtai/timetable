<script setup lang="ts">
import { computed, ref } from 'vue'

import StatusBanner from '@/components/StatusBanner.vue'
import { useClock } from '@/composables/useClock'
import { formatClockTime } from '@/domain/date'
import DataView from '@/views/DataView.vue'
import EditorView from '@/views/EditorView.vue'
import SettingsView from '@/views/SettingsView.vue'
import TodayView from '@/views/TodayView.vue'
import WeekView from '@/views/WeekView.vue'

const VIEWS = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '课表' },
  { key: 'editor', label: '录入' },
  { key: 'settings', label: '设置' },
  { key: 'data', label: '数据' },
] as const

type ViewKey = (typeof VIEWS)[number]['key']

const activeView = ref<ViewKey>('today')
const { now } = useClock()
const clockText = computed(() => formatClockTime(now.value))

function selectView(key: ViewKey) {
  activeView.value = key
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>课程表</h1>
      <time class="app-clock">{{ clockText }}</time>
    </header>

    <StatusBanner />

    <main class="app-main">
      <TodayView v-show="activeView === 'today'" />
      <WeekView v-show="activeView === 'week'" />
      <EditorView v-show="activeView === 'editor'" />
      <SettingsView v-show="activeView === 'settings'" />
      <DataView v-show="activeView === 'data'" />
    </main>

    <nav class="tab-bar">
      <button
        v-for="view in VIEWS"
        :key="view.key"
        :class="{ active: activeView === view.key }"
        type="button"
        @click="selectView(view.key)"
      >
        {{ view.label }}
      </button>
    </nav>
  </div>
</template>
