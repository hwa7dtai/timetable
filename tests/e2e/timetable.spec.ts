import { expect, test, type Page } from '@playwright/test'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 本周周一的日期，向前推一周后当前周次恰为第 2 周 */
function previousMonday(): string {
  const now = new Date()
  const offset = now.getDay() === 0 ? -6 : 1 - now.getDay()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  monday.setDate(monday.getDate() - 7)
  return formatDate(monday)
}

async function setupSemester(page: Page) {
  await page.getByRole('button', { name: '设置' }).click()
  await page.locator('#semester-start').fill(previousMonday())
  await page.locator('#semester-weeks').fill('18')
  await page.getByRole('button', { name: '保存学期' }).click()
  await expect(page.getByText('学期设置已保存')).toBeVisible()
}

test('首次打开显示引导与实时时钟', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '课程表' })).toBeVisible()
  await expect(page.getByText('尚未设置学期')).toBeVisible()

  // 顶部时钟每秒更新
  const first = await page.locator('.app-clock').textContent()
  await expect(page.locator('.app-clock')).not.toHaveText(first ?? '', { timeout: 3000 })
})

test('设置学期后录入课程并在课表中查看', async ({ page }) => {
  await page.goto('/')
  await setupSemester(page)

  await page.getByRole('button', { name: '今日' }).click()
  // 所有视图都以 v-show 挂载，断言需限定在当前可见视图内
  await expect(page.locator('.status-card .value')).toHaveText('第 2 周')

  await page.getByRole('button', { name: '录入' }).click()
  await page.getByRole('button', { name: '新增课程' }).click()
  await page.locator('#course-name').fill('高等数学')
  await page.locator('#course-teacher').fill('张老师')
  await page.locator('.session-editor input[placeholder="如：三教 302"]').fill('三教302')
  await page.getByRole('button', { name: '保存' }).click()

  await expect(page.locator('.course-item .name')).toHaveText('高等数学')

  await page.getByRole('button', { name: '课表' }).click()
  await expect(page.locator('.week-switcher .title')).toHaveText('第 2 周 / 共 18 周')
  await expect(page.locator('.session-card')).toHaveCount(1)
  await expect(page.locator('.session-card')).toBeVisible()

  await page.locator('.session-card').click()
  await expect(page.locator('.sheet')).toContainText('三教302')
})

test('页面刷新后数据仍然保留', async ({ page }) => {
  await page.goto('/')
  await setupSemester(page)

  await page.reload()
  await page.getByRole('button', { name: '设置' }).click()

  await expect(page.locator('#semester-start')).toHaveValue(previousMonday())
  await expect(page.getByText('当前是第 2 周')).toBeVisible()
})

test('离线后仍然可以打开', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '课程表' })).toBeVisible()

  // 等待 Service Worker 完成注册与预缓存
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null || true)
  await page.waitForTimeout(1500)

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('heading', { name: '课程表' })).toBeVisible()

  await context.setOffline(false)
})
