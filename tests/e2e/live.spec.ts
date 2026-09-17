import { expect, test } from '@playwright/test'

// 部署冒烟测试：验证线上 GitHub Pages 站点是否真的可用。
// 运行方式：npm run test:live

test('线上站点可渲染、可安装、可离线打开', async ({ page, context }) => {
  const failures: string[] = []
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
  })

  // 注意：'/' 会解析到域名根目录，这里必须带上仓库子路径
  await page.goto('./')
  await expect(page.getByRole('heading', { name: '课程表' })).toBeVisible()
  await expect(page.getByText('尚未设置学期')).toBeVisible()

  // 实时时钟在走
  const first = await page.locator('.app-clock').textContent()
  await expect(page.locator('.app-clock')).not.toHaveText(first ?? '', { timeout: 4000 })

  // PWA manifest 可访问
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await page.request.get(manifestHref ?? '')
  expect(manifest.status()).toBe(200)
  const parsed = (await manifest.json()) as { start_url: string; scope: string }
  expect(parsed.start_url).toBe('/timetable/')
  expect(parsed.scope).toBe('/timetable/')

  // Service Worker 注册成功 → 手机上可「添加到主屏幕」并离线使用
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 15_000,
  })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '课程表' })).toBeVisible()
  await context.setOffline(false)

  expect(failures).toEqual([])
})
