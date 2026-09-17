<script setup lang="ts">
import { ref } from 'vue'

import { useTimetable } from '@/composables/useTimetable'
import type { AppData } from '@/domain/types'

const { data, serialize, backupFileName, importBackup, replaceData, clearData } = useTimetable()

const importError = ref('')
const pendingImport = ref<AppData | null>(null)
const confirmClear = ref(false)
const message = ref('')

function exportBackup() {
  const blob = new Blob([serialize()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName()
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  message.value = '已导出备份文件'
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const text = await file.text()
  const result = importBackup(text)
  if (!result.ok) {
    pendingImport.value = null
    importError.value = result.message
    return
  }
  importError.value = ''
  pendingImport.value = result.data
}

function confirmImport() {
  if (pendingImport.value) {
    replaceData(pendingImport.value)
    message.value = '导入完成，已覆盖原有数据'
  }
  pendingImport.value = null
}

function cancelImport() {
  pendingImport.value = null
}

function openClearConfirm() {
  confirmClear.value = true
}

function closeClearConfirm() {
  confirmClear.value = false
}

function confirmClearAll() {
  clearData()
  confirmClear.value = false
  message.value = '已清空全部本地数据'
}
</script>

<template>
  <div>
    <section class="card">
      <div class="card-title"><span>导出备份</span></div>
      <p class="muted">
        把课程、时段、学期设置导出为 JSON 文件。浏览器本地存储可能被系统清理，建议定期导出。
      </p>
      <button class="btn block" type="button" @click="exportBackup">导出为文件</button>
    </section>

    <section class="card">
      <div class="card-title"><span>导入备份</span></div>
      <p class="muted">导入会整体覆盖当前数据，操作前会要求确认。</p>
      <input type="file" accept="application/json,.json" @change="onFileChange" />
      <p v-if="importError" class="error-text" style="margin-top: 8px">{{ importError }}</p>
    </section>

    <section class="card">
      <div class="card-title">
        <span>当前数据</span>
        <span class="muted">{{ data.courses.length }} 门课程 · {{ data.sessions.length }} 个时段</span>
      </div>
      <button class="btn block danger" type="button" @click="openClearConfirm">清空全部数据</button>
    </section>

    <p v-if="message" class="muted">{{ message }}</p>

    <div v-if="pendingImport" class="sheet-mask">
      <div class="sheet">
        <h2>确认导入</h2>
        <p class="muted">
          导入内容包含 {{ pendingImport.courses.length }} 门课程、{{
            pendingImport.sessions.length
          }}
          个时段。导入后将覆盖当前的全部数据，此操作不可撤销。
        </p>
        <div class="actions">
          <button class="btn ghost" type="button" @click="cancelImport">取消</button>
          <button class="btn danger" type="button" @click="confirmImport">覆盖并导入</button>
        </div>
      </div>
    </div>

    <div v-if="confirmClear" class="sheet-mask">
      <div class="sheet">
        <h2>清空全部数据</h2>
        <p class="muted">将删除本地保存的全部课程、时段与学期设置，此操作不可撤销。</p>
        <div class="actions">
          <button class="btn ghost" type="button" @click="closeClearConfirm">取消</button>
          <button class="btn danger" type="button" @click="confirmClearAll">确认清空</button>
        </div>
      </div>
    </div>
  </div>
</template>
