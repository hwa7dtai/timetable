import { defineConfig, devices } from '@playwright/test'

/**
 * 部署冒烟测试配置。
 * 针对线上 GitHub Pages 站点运行，不启动本地服务器，
 * 用于确认子路径部署后资源、manifest 与 Service Worker 都正常工作。
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'live.spec.ts',
  reporter: [['list']],
  use: { baseURL: 'https://hwa7dtai.github.io/timetable/' },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 5'] } }],
})
