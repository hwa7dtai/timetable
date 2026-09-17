<script setup lang="ts">
import { useTimetable } from '@/composables/useTimetable'

const { issues, dismissIssue } = useTimetable()
</script>

<template>
  <div v-for="issue in issues" :key="issue.kind" class="banner" :class="{ error: issue.kind === 'corrupted' }">
    <span>{{ issue.message }}</span>
    <button type="button" @click="dismissIssue(issue.kind)">知道了</button>
  </div>
</template>
