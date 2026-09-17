# 课程表

一个自己用的课程表网页应用，装在安卓手机上像 App 一样使用。单机可用，无需注册、无需联网。

完整的产品范围见 [产品设计文档](docs/product-design.md)，技术方案见 [技术设计文档](docs/tech-design.md)。

## 功能

- **周课表视图**：横向周一至周日、纵向节次，可切换周次，点击格子查看课程详情
- **准确的排课规则**：支持起止周次、单双周，以及「第 1~16 周单周」这类组合情形
- **一次录入生成多条**：选择星期、节次、周次范围与单双周后自动展开，不必逐周重复录入
- **冲突检测**：同星期、节次有交集、周次区间有交集且单双周同时满足即提示冲突
- **今日 / 下一节课**：实时时钟驱动的当前课高亮、剩余分钟数与下一节提示
- **学期设置**：填写第 1 周周一日期与总周数，当前周次自动计算
- **节次时间表**：内置一套通用默认值，可按本校实际时间修改
- **数据持久化**：数据保存在浏览器本地，支持导出 / 导入 JSON 备份
- **PWA**：可添加到手机主屏，全屏使用，离线可打开

## 技术栈

Vue 3 + TypeScript + Vite，PWA 由 vite-plugin-pwa 生成，测试使用 Vitest 与 Playwright。

核心的排课规则全部写在 `src/domain/` 下，是不依赖任何框架的纯函数，便于完整覆盖边界条件。

## 开发

```bash
npm install
npm run dev          # 本地开发
npm run build        # 生产构建
npm run preview      # 预览构建产物
npm run lint         # 代码检查
npm run typecheck    # 类型检查
npm run test         # 单元与组件测试
npm run test:e2e     # 端到端测试（首次需 npx playwright install chromium）
npm run icons        # 重新生成 PWA 图标
```

提交前请确保 `lint`、`typecheck`、`test` 全部通过。

> Windows 提示：若 PowerShell 禁止运行 `npm.ps1`，请改用 `npm.cmd`，或执行
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`。

## 部署

构建产物是纯静态文件，部署到任意支持 HTTPS 的静态托管即可（PWA 安装与 Service Worker 都要求 HTTPS）。

## 目录结构

```
src/
├─ domain/        # 纯函数：日期、周次、单双周、冲突、今日与当前课
├─ data/          # 默认值、存储适配、数据校验与迁移、备份导入导出
├─ composables/   # 实时时钟、课表数据、学期设置
├─ components/    # 通用组件
└─ views/         # 今日 / 课表 / 录入 / 设置 / 数据
```
