# 课程表 · 技术设计文档

> 状态：草稿（待确认技术侧遗留问题）
> 日期：2026-09-17
> 关联文档：[产品设计文档](./product-design.md)
> 说明：本文档是产品设计文档的技术对应物，界定架构、数据模型、核心算法与测试策略。

## 1. 技术目标与约束

技术方案由产品文档的目标推导而来，按优先级排列：

| 优先级 | 约束 | 对技术方案的影响 |
| --- | --- | --- |
| 1 | 排课规则表达准确，不允许展示出错 | 规则逻辑必须是可测试的纯函数，与 UI 完全解耦 |
| 2 | 单机可用，无注册、无联网 | 无后端、无数据库、无鉴权，纯静态产物 |
| 3 | 手机打开即用，可添加到主屏、全屏体验 | PWA，需 manifest + Service Worker + HTTPS |
| 4 | 数据保存在本地，且需导出/导入兜底 | 数据层封装为 Repository，存储实现可替换 |
| 5 | 单用户、单设备、单学期 | 不做并发、冲突合并、同步协议 |

由此得出一条贯穿全局的设计原则：**领域逻辑（周次、单双周、冲突、今日课程）写成不依赖任何框架的纯函数，UI、存储、时钟都只是它的输入输出适配层。** 这条原则直接决定了测试是否可以低成本覆盖全部边界条件，是本项目质量的主要保障手段。

## 2. 技术选型

### 2.1 选型结果

| 层 | 选择 | 理由 |
| --- | --- | --- |
| 语言 | TypeScript | 领域模型靠类型约束，避免周次/单双周在运行时错判 |
| 构建 | Vite | 静态产物、开发体验好、PWA 插件成熟 |
| UI 框架 | Vue 3（Composition API + `<script setup>`） | 课表网格与录入表单密集，SFC 组织清晰；中文资料充足 |
| 样式 | CSS Modules / 原生 CSS | 页面数量少，不引入重型 UI 组件库 |
| 状态管理 | 暂不引入（组合式函数 + `reactive`） | 数据量小，引入 Pinia 属于过度设计 |
| 路由 | 暂不引入（视图状态切换） | 仅 4~5 个视图，PWA 刷新回默认视图可接受 |
| 日期处理 | 不引入第三方库 | 仅需"周一锚点 + 天数差"这类简单算术 |
| 本地存储 | localStorage（封装为 Repository） | 单学期数据量级几十 KB，远低于 5MB 上限 |
| PWA | vite-plugin-pwa | manifest 生成、Service Worker 预缓存开箱可用 |
| 单元测试 | Vitest | 与 Vite 同源配置，原生支持假时钟 |
| 组件测试 | @vue/test-utils + happy-dom | 轻量，满足表单与网格交互测试 |
| 端到端测试 | Playwright | 可模拟移动端视口、离线模式与 PWA manifest |

### 2.2 明确排除的方案

- **Next.js / Nuxt / 任何 SSR 方案**：没有服务端渲染需求，只会增加构建复杂度与部署约束。
- **后端服务与云数据库**：产品非目标明确排除账号与云端同步。
- **Flutter / 原生 Android**：开发周期长，与"网页应用装到手机主屏"的定位不符。
- **重型 UI 组件库（Element Plus、Ant Design 等）**：课表网格是自定义布局，组件库在此处的复用率极低，反而拖慢移动端首屏。
- **状态管理库**：待数据流复杂到组合式函数难以承载时再评估，当前不引入。

### 2.3 逃生通道

- 若数据规模增长到 localStorage 不够用（如 P1 的多学期历史 + 大量导入数据），在 Repository 接口后替换为 IndexedDB（Dexie），UI 与领域层不受影响。
- 若 PWA 安装体验无法满足，用 Capacitor 将同一套代码打包为 APK，无需重写业务逻辑。

## 3. 总体架构

### 3.1 分层

```
┌─────────────────────────────────────────────┐
│ UI 层      views / components               │  只负责渲染与用户输入
├─────────────────────────────────────────────┤
│ 应用层     composables                       │  组合领域函数、管理响应式状态与副作用
├─────────────────────────────────────────────┤
│ 领域层     domain（纯函数，无框架依赖）        │  周次、单双周、冲突、今日课程
├─────────────────────────────────────────────┤
│ 数据层     repository + storage adapter      │  读写、序列化、版本迁移
└─────────────────────────────────────────────┘
```

依赖方向严格单向：UI → 应用层 → 领域层。领域层不引用 Vue、不访问 DOM、不读写存储、不直接调用 `Date.now()`，所有外部输入以参数传入。数据层只依赖领域层定义的模型类型。

### 3.2 目录结构

```
timetable/
├─ docs/
│  ├─ product-design.md
│  └─ tech-design.md
├─ public/
│  └─ icons/                     # PWA 图标（192 / 512 / maskable）
├─ src/
│  ├─ domain/                    # 纯函数，核心测试对象
│  │  ├─ types.ts                # 领域模型类型定义
│  │  ├─ date.ts                 # 本地日期解析/格式化/星期计算
│  │  ├─ week.ts                 # 周次计算、单双周判定
│  │  ├─ schedule.ts             # 按周/按天筛选、课程展开
│  │  ├─ conflict.ts             # 冲突检测
│  │  └─ now.ts                  # 今日课程、当前课、下一节课
│  ├─ data/
│  │  ├─ repository.ts           # 对外统一读写接口
│  │  ├─ storage.ts              # localStorage 适配器
│  │  ├─ defaults.ts             # 默认节次时间表、默认设置
│  │  ├─ migration.ts            # schemaVersion 迁移
│  │  └─ backup.ts               # 导出/导入与数据校验
│  ├─ composables/
│  │  ├─ useClock.ts             # 实时时钟
│  │  ├─ useTimetable.ts         # 课表数据的增删改查与持久化
│  │  └─ useSettings.ts          # 学期设置、节次时间表
│  ├─ components/                # 网格、单元格、表单、详情弹层等
│  ├─ views/                     # 今日 / 课表 / 编辑 / 设置 / 数据
│  ├─ styles/
│  └─ main.ts
├─ tests/
│  ├─ unit/                      # 领域层与 composables
│  └─ e2e/                       # Playwright
├─ index.html
├─ vite.config.ts
├─ vitest.config.ts
└─ package.json
```

## 4. 数据模型

### 4.1 类型定义

```ts
/** 单双周类型 */
export type WeekParity = 'all' | 'odd' | 'even'

/** 节次时间：一节课的编号与起止时刻，使用当天分钟数表示 */
export interface Period {
  /** 节次编号，从 1 开始 */
  index: number
  /** 起始时刻，当天 0 点起的分钟数，如 8:00 => 480 */
  startMinute: number
  /** 结束时刻，当天 0 点起的分钟数，如 8:45 => 525 */
  endMinute: number
}

/** 课程：固定信息 */
export interface Course {
  id: string
  name: string
  teacher: string
  /** 备注，可为空 */
  note: string
}

/** 上课时段：课程在"星期几 + 节次 + 周次范围 + 单双周"上的一次具体安排 */
export interface Session {
  id: string
  courseId: string
  /** 星期几，1 = 周一 …… 7 = 周日 */
  dayOfWeek: number
  /** 起始节次编号 */
  startPeriod: number
  /** 结束节次编号，等于 startPeriod 时表示单节 */
  endPeriod: number
  /** 起始周次 */
  weekStart: number
  /** 结束周次 */
  weekEnd: number
  parity: WeekParity
  /** 教室，同一门课不同时段可能不同 */
  room: string
}

/** 学期设置 */
export interface Semester {
  /** 第 1 周周一的日期，格式 YYYY-MM-DD */
  startDate: string
  /** 总周数，常见 16 / 18 / 20 */
  totalWeeks: number
}

/** 节次时间表 */
export interface PeriodTable {
  /** 表格标识，用于后续支持多套时间表 */
  id: string
  name: string
  periods: Period[]
}

/** 持久化的完整数据 */
export interface AppData {
  /** 数据结构版本，用于迁移 */
  schemaVersion: number
  /** 学期设置，未设置时为 null，此时周次相关功能不可用 */
  semester: Semester | null
  periodTable: PeriodTable
  courses: Course[]
  sessions: Session[]
}
```

### 4.2 关键设计决策

**周次明细不持久化。** `Session` 只存"周次区间 + 单双周"，具体到第 1、3、5…… 周的展开结果一律由 `week.ts` 派生。原因是学期起始日、总周数都属于可修改的配置，一旦持久化展开结果，改配置就会出现数据与实际不一致，且需要批量重算。

**日期只存 `YYYY-MM-DD` 字符串。** 不使用 `Date` 对象序列化（会带入时区与时区偏移），不使用带时间的 ISO 时间戳。解析时按年、月、日分量构造本地 `Date`，避免 `new Date('2026-09-17')` 被当作 UTC 解析导致日期偏移一天。

**节次时间用"当天分钟数"表示。** 存储层面是整数，比较与排序简单，且天然支持"结束时间早于开始时间"的跨零点晚课（`endMinute < startMinute` 时视为跨天）。

**课程与上课时段分离。** 一门课可对应多个时段（如周二与周四各一次），编辑课程名称时只需改一处。这与产品文档第 7 节的术语定义一致。

**携带 `schemaVersion`。** 当前为 `1`。迁移函数接收任意版本的数据、返回当前版本的数据；版本不识别时拒绝载入并提示用户，避免静默损坏数据。

**ID 生成**使用 `crypto.randomUUID()`，不可用时回退到时间戳 + 随机数。ID 只在本地有意义，不做全局唯一性保证。

## 5. 核心算法

以下函数全部定义在 `src/domain/`，全部为纯函数，是单元测试的重点。

### 5.1 日期与周次

```ts
/** 解析 YYYY-MM-DD 为本地时区当天 0 点的 Date */
function parseLocalDate(date: string): Date

/** 把 Date 格式化为 YYYY-MM-DD */
function formatLocalDate(date: Date): string

/** 取某天所在周的周一（周一为一周第一天，周日归属前一个周一） */
function mondayOf(date: Date): Date

/**
 * 计算某个日期属于第几周。
 * 公式：周次 = (该日期所在周的周一 - 第 1 周周一的日期差) / 7 + 1
 * 返回 <= 0 表示尚未开学，返回 > totalWeeks 表示学期已结束。
 */
function getWeekIndex(date: Date, semester: Semester): number
```

天数差的计算统一走"取两个日期各自当天 0 点 → 相减 → 除以 86400000 → 四舍五入"，避免夏令时或跨月带来的非整数结果。中国大陆无夏令时，但该写法无需依赖这一事实。

### 5.2 周次展开与单双周

```ts
/** 判断某个周次是否满足单双周条件 */
function matchesParity(week: number, parity: WeekParity): boolean

/** 判断某时段在第 N 周是否开课 */
function isActiveInWeek(session: Session, week: number): boolean
// = week >= session.weekStart
//   && week <= session.weekEnd
//   && matchesParity(week, session.parity)

/** 把时段展开为实际开课的周次列表，如 1、3、5…… 15 */
function expandWeeks(session: Session): number[]

/** 取某周的全部时段（已按星期与节次排序） */
function getSessionsOfWeek(data: AppData, week: number): Session[]

/** 取某天（星期几 + 周次）的全部时段 */
function getSessionsOfDay(data: AppData, week: number, dayOfWeek: number): Session[]
```

`expandWeeks` 实现为区间内逐周判断，区间上限不超过总周数（≤ 30），性能无意义，可读性与正确性优先。

### 5.3 冲突检测

产品文档定义的口径：**星期几相同 + 节次有交集 + 周次区间有交集 + 单双周条件同时满足**。

```ts
interface Conflict {
  /** 与当前时段冲突的已有时段 */
  session: Session
  /** 冲突的具体周次列表，用于向用户解释 */
  weeks: number[]
}

/** 检测一个新时段与现有全部时段的冲突 */
function detectConflicts(
  candidate: Session,
  existing: Session[],
  options?: { excludeSessionId?: string },
): Conflict[]
```

判定步骤：

1. `candidate.dayOfWeek !== existing.dayOfWeek` → 无冲突。
2. 节次无交集：`max(startPeriod) > min(endPeriod)` → 无冲突。
3. 枚举 `max(weekStart)` 到 `min(weekEnd)` 之间的每个周次，逐个判断是否同时满足两边的单双周条件，收集满足的周次。
4. 收集结果非空即为冲突，同时把周次列表返回给 UI 用于提示"与《高等数学》在第 3、5、7 周冲突"。

注意第 3 步**不能简化成两次区间相交**：例如 A 是第 1~2 周单周课、B 是第 2~3 周双周课，区间交集为第 2 周，但第 2 周是双周，A 不开课，实际并不冲突。逐周枚举是唯一直观且不易出错的做法。

其他约定：

- 编辑已有课程时，通过 `excludeSessionId` 排除自身，避免"与自己也冲突"。
- 同一门课的两个时段互相重叠同样算冲突（现实中确实会录错），但 UI 提示文案区分为"同一课程的时段重叠"，便于定位。
- 节次交集按**节次编号**判定，与产品文档口径一致。若用户把两节课的时间配置成互相重叠，本算法不会报冲突——这属于节次时间表配置问题，已知局限。
- 冲突处理策略：**默认阻止保存并展示冲突对象**。是否允许"仍然保存"，见第 12 节待确认事项。

### 5.4 今日课程与当前课程

```ts
/** 学期状态 */
type SemesterStatus = 'not-set' | 'before' | 'in-progress' | 'finished'

function getSemesterStatus(data: AppData, now: Date): SemesterStatus

/** 某节次在当天的起止时刻；跨零点时 end 会落在第二天 */
function getPeriodRange(periodTable: PeriodTable, startPeriod: number, endPeriod: number): {
  start: { dayOffset: 0 | 1; minute: number }
  end: { dayOffset: 0 | 1; minute: number }
}

/** 今日全部时段（按开始时间排序） */
function getTodaySessions(data: AppData, now: Date): Session[]

/** 当前正在上的时段，无则返回 null */
function getCurrentSession(data: AppData, now: Date): Session | null

/** 剩余分钟数，向上取整，最小为 0 */
function getRemainingMinutes(data: AppData, session: Session, now: Date): number

/** 下一节时段，可跨天、跨周，学期结束后返回 null */
function getNextSession(data: AppData, now: Date): Session | null
```

`getNextSession` 的实现方式：从今天开始，逐天向后查找（跳过不开课的周次，最多向后查找一个学期的天数），返回第一个开始时刻晚于 `now` 的时段。学期内天数不超过 210 天，遍历成本可忽略。

### 5.5 互斥的界面状态

今日卡片的状态由上述函数组合得出，必须显式覆盖：

| 状态 | 条件 | 展示 |
| --- | --- | --- |
| 未设置学期 | `semester === null` | 引导前往设置页填写第 1 周周一日期 |
| 未开学 | `getWeekIndex < 1` | 「距开学 N 天」 |
| 学期已结束 | `getWeekIndex > totalWeeks` | 「学期已结束」 |
| 正在上课 | `getCurrentSession !== null` | 高亮该课 + 教室 + 剩余 N 分钟 |
| 今天还有课 | 今日剩余时段非空 | 「下一节：第 3-4 节 高等数学 @三教 302」 |
| 今天没课但有后续 | 下一节在其他日期 | 「今天没课，最近一节在周三」 |
| 学期内无课 | `getNextSession === null` | 「今天没课」 |

## 6. 实时时钟设计

### 6.1 设计原则

**时间只作为输入，绝不做累加。** 所有派生状态在每次 tick 时用当前的 `Date.now()` 重新计算，禁止 `seconds++` 这类写法。Android 浏览器在页面进入后台、锁屏或系统省电时，定时器会被冻结或降频，累加必然产生偏差。

### 6.2 时钟抽象

```ts
export interface Clock {
  now(): number
}

export const systemClock: Clock = { now: () => Date.now() }
```

生产环境使用 `systemClock`，测试注入固定或可推进的假时钟。领域层的所有函数都接收 `now: Date` 参数，不直接调用 `Date.now()`，因此领域测试无需任何计时器技巧。

### 6.3 `useClock` 行为

```ts
export function useClock(options?: { intervalMs?: number }): { now: Ref<Date> }
```

- 默认 `intervalMs = 1000`，仅在课表或今日视图挂载时启用。
- **对齐整秒**：首次触发时计算 `1000 - (Date.now() % 1000)` 的延时，之后按固定间隔推进，避免长期漂移造成秒数跳动不均匀。
- **页面不可见时暂停**：监听 `visibilitychange`，隐藏时清除定时器，可见时立即刷新一次并重新启动。
- **恢复时立即重算**：监听 `pageshow`（含从 bfcache 恢复）与 `focus`，触发一次立即更新，保证锁屏解锁后显示的不是过期时间。
- 多个组件共享同一时钟实例，避免同时运行多个 `setInterval`。实现上用一个模块级单例 + 引用计数管理订阅者。

### 6.4 派生状态的刷新边界

| 边界 | 处理 |
| --- | --- |
| 跨整点 / 跨分钟 | 每秒 tick 自然覆盖 |
| 跨零点（进入新的一天） | 每秒重算时检测日期变化，`getTodaySessions` 自动切换 |
| 周一零点（进入新的一周） | 当前周次变化，周课表视图自动切到新周 |
| 系统时间被手动修改 | 每次 tick 都从 `Date.now()` 重算，自动纠正 |
| 页面从后台恢复 | `visibilitychange` / `pageshow` 立即重算，无需等待下一次 tick |

### 6.5 渲染频率与电量

秒级刷新仅在页面可见时进行，页面隐藏即停止。剩余分钟数按分钟粒度展示，但底层仍由每秒 tick 驱动，避免额外的分钟级定时器。对单页应用而言，可见状态下的每秒一次重渲染开销可以忽略。

## 7. 数据持久化与备份

### 7.1 Repository 接口

数据层对外只暴露这一组接口，UI 与组合式函数不感知存储实现：

```ts
export interface TimetableRepository {
  load(): AppData
  save(data: AppData): void
  /** 清除全部本地数据 */
  clear(): void
  exportBackup(data: AppData): string
  importBackup(json: string): ImportResult
}

type ImportResult =
  | { ok: true; data: AppData }
  | { ok: false; reason: 'invalid-json' | 'invalid-shape' | 'unsupported-version' }
```

### 7.2 localStorage 适配

- 存储键：`timetable:data`。
- 写入时机：每次增删改后立即同步写入。数据量级为几十 KB，同步写入的耗时不会造成可感知卡顿，换取的是最小的数据丢失风险。
- 读取异常处理：JSON 解析失败或结构校验不通过时，**不静默重置**。保留原始字符串到 `timetable:data.corrupted`，初始化一份空数据，并在界面上告知用户"本地数据损坏，原始内容已保留"，同时引导其导入备份。
- 隐私模式 / 存储被禁用：检测写入是否抛异常，失败时降级为"仅内存模式"并在顶部持续提示"数据无法保存，请及时导出备份"。

### 7.3 导出 / 导入

- 导出文件名：`timetable-backup-YYYYMMDD-HHmmss.json`，内容为 `{ ...AppData, exportedAt: ISO 字符串 }`。
- 导入校验顺序：JSON 可解析 → 结构符合当前模型 → `schemaVersion` 可识别。任一环节失败给出明确原因，不使用笼统的"导入失败"。
- 导入为**整体覆盖**，执行前必须二次确认，并提示当前数据将被替换。
- 校验函数同时用于 localStorage 读取，避免两套逻辑。

### 7.4 存储升级路径

接口已按 `load / save / clear` 抽象，P1 若需要多学期历史或数据量增长，替换为 IndexedDB 适配器即可。`AppData.semester` 届时演进为 `semesters: Semester[]` + `activeSemesterId`，通过 `schemaVersion` 迁移，属可控改动。

## 8. PWA 与安装

### 8.1 manifest 要点

| 字段 | 取值 |
| --- | --- |
| `name` / `short_name` | 课程表 / 课程表 |
| `start_url` | `/` |
| `display` | `standalone`（全屏、隐藏浏览器地址栏） |
| `display_override` | `["standalone"]`，兼容新版 Chrome |
| `background_color` / `theme_color` | 与主界面背景、主题色一致 |
| `icons` | 192×192、512×512，另提供 `purpose: maskable` 版本 |

### 8.2 Service Worker

- 使用 `vite-plugin-pwa` 的 `generateSW` 策略，构建时预缓存全部应用外壳资源。
- 应用无任何网络请求，因此不需要运行时缓存策略，也不存在缓存一致性问题。
- 更新策略：`registerType: 'autoUpdate'`。发现新版本后自动更新并在下次进入时生效，避免手动维护版本提示。

### 8.3 安装与访问约束

- PWA 安装与 Service Worker 均要求 HTTPS（`localhost` 除外）。
- Android 上需通过 Chrome 等支持 PWA 的浏览器访问并选择"添加到主屏幕"；**微信内置浏览器、部分国产浏览器不支持完整的 PWA 安装**，需在界面上给出提示。
- 需配置 `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` 并使用 `env(safe-area-inset-*)` 适配全面屏的刘海与手势区域。

## 9. 界面结构

### 9.1 视图划分

| 视图 | 内容 | 对应产品文档章节 |
| --- | --- | --- |
| 今日 | 实时时钟、今日课程列表、当前课高亮与剩余分钟、下一节提示 | §5.3 |
| 课表 | 周一至周日 × 节次的网格、周次切换器、点击格子弹详情 | §5.1 |
| 课程编辑 | 课程信息 + 上课时段表单、冲突提示 | §5.2 |
| 设置 | 学期起始日、总周数、节次时间表 | §6.1 |
| 数据 | 导出、导入、清空 | §6.4 |

视图切换用顶层状态实现，不引入路由。若后续需要"从桌面图标直接进入今日视图"以外的深链接能力，再评估引入 `vue-router`。

### 9.2 课表网格

- 横向 7 列（周一至周日）+ 1 列节次表头；纵向为节次行。
- 窄屏策略：优先保证 7 列可读，单元格内文字允许截断（课程名 2 行、教室 1 行），点击后由详情弹层展示完整信息。
- 周次切换器放在网格上方，显示"第 N 周（共 M 周）"，支持左右切换；超出学期范围时禁用对应方向。
- 当前正在上的课在网格中同样高亮，与今日视图的高亮状态共用同一份派生数据。

## 10. 测试策略

### 10.1 分层

| 层级 | 工具 | 覆盖对象 | 目标 |
| --- | --- | --- | --- |
| 单元测试 | Vitest | `src/domain/*`、`src/data/*` | 全部规则与边界条件，覆盖率的主要来源 |
| 组合式测试 | Vitest + 假时钟 | `useClock`、`useTimetable` | 时钟行为、持久化时机 |
| 组件测试 | @vue/test-utils + happy-dom | 录入表单、冲突提示、网格渲染 | 交互与渲染正确性 |
| 端到端 | Playwright | 录入 → 查看 → 导出 → 离线打开 | 关键路径与 PWA 行为 |

### 10.2 必测清单

周次与单双周：

- 学期起始日当天、前一天、后一天
- 周日归属上一周（周一为每周第一天）
- 第 1~16 周单周课展开为 1、3、5……15
- 第 1~16 周双周课展开为 2、4、6……16
- 起止周次跨越月份、跨越年份
- 学期开始前、学期结束后

冲突检测：

- 同星期、节次重叠、周次重叠、均为每周 → 冲突
- 单周课与双周课在同一时间 → 不冲突
- 区间相交但奇偶不匹配（第 1~2 周单周 vs 第 2~3 周双周）→ 不冲突
- 节次仅部分重叠（第 1~2 节 vs 第 2~3 节）→ 冲突
- 星期不同 → 不冲突
- 编辑时排除自身
- 同一门课的两个时段重叠 → 冲突（且识别为同学科重叠）

今日与当前课：

- 恰好等于上课开始时刻、恰好等于结束时刻
- 两节课之间的空档、一天中的多门课
- 今天没课但本周后续有课、今天没课且本周无课
- 跨零点晚课的当前课判定与剩余分钟
- 下一节课跨天、跨周查找

时钟：

- 使用假定时器推进，断言秒值对齐与派生状态同步更新
- 页面隐藏时停止 tick、恢复时立即刷新
- 模拟从后台恢复后时间跨越整点/整天的场景

存储与备份：

- 正常读写往返
- 损坏 JSON、结构缺失、版本不识别三种导入失败分支
- 写入抛异常时降级为内存模式

### 10.3 质量门禁

每次改动提交前必须依次通过：

```bash
npm run lint
npm run typecheck
npm run test
```

端到端测试在涉及 PWA 配置、网格布局、导入导出的改动时执行：

```bash
npm run test:e2e
```

本项目的测试重点在领域层：规则正确性是产品的第一优先级，领域层的单元测试必须覆盖上表全部条目。

## 11. 开发流程与里程碑

### 11.1 环境说明

- 本机已有 Node.js v24.20.0。
- PowerShell 执行策略禁止运行 `npm.ps1`，直接执行 `npm` 会报 `UnauthorizedAccess`。可选方案：使用 `npm.cmd`、使用 `pnpm.cmd`，或为当前用户设置执行策略 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`。
- 包管理器在脚手架阶段确定，确定后不改动，避免锁文件混用。

### 11.2 里程碑

| 阶段 | 内容 | 交付物 |
| --- | --- | --- |
| M0 | 项目脚手架、工具链、PWA 基础配置 | 可构建、可安装、CI 门禁可执行的空壳 |
| M1 | 数据模型、默认值、Repository、领域层日期与周次算法 | 本文档 §5.1、§5.2 全部单测通过 |
| M2 | 冲突检测与课程 / 时段增删改 | 本文档 §5.3 单测通过，录入流程可用 |
| M3 | 周课表视图、周次切换、详情弹层 | 产品文档 §5.1 界面可用 |
| M4 | 实时时钟、今日视图、当前课高亮与下一节 | 本文档第 6 节功能可用 |
| M5 | 学期设置页、节次时间表编辑 | 产品文档 §6.1 可用 |
| M6 | 导出 / 导入与数据校验 | 产品文档 §6.4 可用，P0 完成 |
| M7（P1） | 课表文本导入、多套课表 / 多学期 | 逐步推进 |

每个阶段结束都是一次可交付、可回滚的提交点。按 AGENTS.md 要求，每次改动附对应测试并单独提交 commit。

### 11.3 部署

- 产物为纯静态文件，部署到任意支持 HTTPS 的静态托管即可。
- 国内访问建议：Cloudflare Pages，或腾讯云 COS / 阿里云 OSS 搭配 CDN。
- 部署后需在手机 Chrome 上验证：可安装、离线可打开、数据在重启浏览器后仍存在。

## 12. 待确认事项

产品侧第 8 节已确认的方案（本文档按此设计）：

- 节次时间表内置一套通用默认值，并允许在设置页修改。
- 学期设置只需填写第 1 周周一日期与总周数，当前周次自动计算。
- 学期设置随 MVP 交付；文本导入、多套课表 / 多学期放入 P1。

仍待确认的技术侧问题：

1. **冲突时是否允许"仍然保存"**：当前设计默认阻止保存并展示冲突对象。若现实中存在合理的冲突（如先占位后调整），可改为警告 + 二次确认。
2. **默认节次时间表的具体取值**：本方案会内置一套通用值，你可在开学后按教务系统修改一次；若你现在就能提供本校时间段，可直接写进默认值。
3. **是否需要 APK**：当前只做 PWA。若安装体验不满足，再评估 Capacitor 打包，前期工作不会浪费。
4. **节假日调休**：当前按"每周固定上课"处理，不支持法定节假日跳过与调休补课，视为已知局限。
