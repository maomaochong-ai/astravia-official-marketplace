# ADR 0002：面板改成三视图 + 状态分域，替代内联折叠

- 状态：提议（2026-11-01）
- 决策对象：`abilities/plugins/video-downloader/src/features/**`（2.4.0 → 2.5.0）
- 参照对象：Tampermonkey `src/options.html` + `action.html` 的分区结构（只借信息架构，不借组件）
- 关联文档：[ADR 0001](./0001-userscript-adapter-layer.md)（Adapter 层定义了三视图里的第二视图）、[CONTEXT.md](./CONTEXT.md)

## 1. 现状

`downloader-view.tsx` 是一个 205 行的单文件，在 429 行的 `use-downloader.ts` 之上画一条纵向流：

```
downloader-view.tsx:52        容器 max-w-2xl（page: px-6 py-7 / panel: px-4 py-4）
:62-119  header               标题(仅 page) + 状态圆点徽章 + [地球] [设置] 两个 7×7 图标按钮
:142-155 UrlEntryCard         Source URL 输入 + 粘贴 + 解析 + remedy
:157-170 MediaPreviewCard     Media Item 与 Format 选择 + 开始下载
:172     DownloaderEmptyState 无结果无任务时的空态
:174-176 SiteCoveragePanel    coverageOpen && sites —— 插在队列之前
:178-184 DownloadQueue        Download Task 列表
:186-199 DownloadSettingsPanel settingsOpen && settings —— 插在队列之后
```

两个面板的互斥靠手写：`setCoverageOpen(true)` 旁边必须跟 `setSettingsOpen(false)`（`:109-110` 与同类处）。

## 2. 问题

1. **内联面板把 Queue 推走。** 下载进行中打开设置，进度行移出视口。这不是审美问题，
   用户在等下载时最常做的两件事（看进度、改并发）被放在同一个滚动容器里互相挤。
2. **顶部只有两个无标签图标。** 地球（Coverage）与齿轮（Settings）都是 7×7、只有 `aria-label`。
   再加第三类入口（Adapter 库）就会变成一排无文字图标，发现性降到零。
3. **层级错配。** Coverage 是 53 条站点的参考数据，与「贴地址、解析、下载」这个高频动线同级；
   Settings 是低频变更项，却被插在动线中间。
4. **单 hook 单视图会越界。** `use-downloader.ts` 已 429 行，承担 boot / 引擎安装 / 探测 / 选择 /
   队列 / 设置六件事。Adapter 进来后如果继续加，单文件会到 600 行以上，且视图与新增状态无边界。

## 3. 三个候选

### 候选 A：保持单流，新功能做成弹层（否决）

最小改动，Adapter 库用抽屉或全屏弹层。否决理由：弹层套弹层（设置已经是内联展开）在 `panel`
变体（activity-tab）的窄宽下基本不可用；且 Adapter 库需要常驻搜索框与列表滚动，天然是一个视图，
不是一次性的确认对话框。

### 候选 B：左侧图标栏 56px + 右侧内容（否决）

Tampermonkey 的 options 页就是这个形状（左侧分区列表），复用直觉最强。否决理由是宽度：
插件同时注册 `ui.slot.activity-tab` 与 `ui.slot.workspace-view`，前者是窄侧栏。56px 图标栏在
360–420px 的侧栏里吃掉 15% 宽度，而它承载的只是 3–4 个入口。

### 候选 C：顶部 Tab 三视图（选定）

```
┌ header：状态圆点 + 引擎/服务徽章 ──────────────┐
│ Extract │ Adapters │ Settings                  │  ← 3 个文字 tab，等宽、可点
├─────────────────────────────────────────────────┤
│ 当前视图内容（纵向流，宽 max-w-2xl）             │
└─────────────────────────────────────────────────┘
```

选定理由：竖排是唯一在 360px 与 1200px 都成立的排布；三个中文/英文标签在窄宽下不换行；
它把「互斥」交给一个受控状态（`view`）而不是两处 `setX(false)` 的手写配对。

## 4. 视图边界

每个视图回答一个问题，交叉引用靠深链，不靠「什么都放主视图」。

| 视图 | 回答的问题 | 内容 | 来源 |
| --- | --- | --- | --- |
| **Extract** | 这个地址能下什么，怎么下 | UrlEntryCard → MediaPreviewCard → Queue → EmptyState | 现有三段，动线不动 |
| **Adapters** | 哪些站点有适配器，它负责什么 | 搜索 + Adapter 列表（行卡片：名称/版本/`@match` 域/启停）+ 详情（描述、Grant、上次 Run 结果）+ 导入 | 新增，仅在 `ctx.capture` 可用时出现 |
| **Settings** | 下载行为怎么配 | 现有 DownloadSettingsPanel + **Coverage 子段**（53 站全景与未支持原因） | 现有两处合并 |

Deep link（三条，都是失败驱动的）：

- `site_unsupported` / `site_upstream_broken` → Extract 的错误行给一个「查看适配器」按钮，跳到
  Adapters 并预填当前域名过滤。
- `adapter-missing` → 同上，文案换成「这个站点还没有适配器」。
- Coverage 里某站点右侧给「配置 Cookie」，跳到 Settings 并聚焦 Cookie 字段（现有 `focusCookie` 已支持）。

Coverage 从主视图迁走是有代价的：2.3.0 做的「45 平台可解析」这件事在界面上变得不显眼。
补偿办法是 Settings 的 Coverage 子段默认折叠、摘要行显示「44 / 53 站点可解析」，保住一眼可读。

## 5. 状态分域

现在一个 `use-downloader.ts` 承担六件事，按「谁的生命周期」拆成五个 hook + 一个服务层：

| Hook | 拥有 | 生命周期 |
| --- | --- | --- |
| `use-service-gate` | boot、Tool Capability、yt-dlp / ffmpeg 安装进度、重试 | 与面板同寿 |
| `use-extract` | Source URL、探测、ProbeResult、选中 Media Item / Format、发起下载 | 与 Extract 视图同寿 |
| `use-tasks` | Queue、取消/重试/移除/显示 | 与面板同寿（跨视图可见） |
| `use-settings` | ServiceSettings 读写 | 与面板同寿 |
| `use-adapters` | Adapter 目录、Run、导入/启停 | 与 Adapters 视图同寿 |

拆分判据不是行数，而是**谁能离开谁**：`use-extract` 卸载后 Queue 必须继续跑，因此任务状态不能住在它里面；
Adapter Run 与 Extract 探测互斥（同一时刻只允许一个页面抓取），因此二者共享一个 `busy` 信号，
由 `DownloaderView` 持有并下发。

跨视图常驻的只有两件：**状态圆点徽章**（服务健康 + 引擎可用）与 **Queue 的非终态计数**
（tab 上显示角标 `2`），两者都放 header，避免用户在 Settings 里不知道下载已经完成。

## 6. 不冗余的判据

一条规则：**每个可见控件必须对应 CONTEXT.md 里的一个术语，否则删掉。**

| 控件 | 对应术语 | 现状 |
| --- | --- | --- |
| URL 输入框 + 解析按钮 | Source URL → ProbeResult | 保留 |
| Format 选择行 | Format | 保留 |
| 开始下载 | Download Task | 保留 |
| 队列行四个动作 | Download Task 的取消/重试/移除/显示 | 保留 |
| 地球图标（旧） | Coverage | **删除**，迁入 Settings 子段 |
| 齿轮图标（旧） | —（它只是面板开关） | **删除**，由 Tab 取代 |
| Adapter 行开关 | Adapter 的启用状态 | 新增 |
| Adapter「权限」标签 | Adapter Grant | 新增 |
| 「上次运行」摘要 | Adapter Run / Adapter Failure | 新增 |

反向检查也成立：CONTEXT.md 里的 `Tool Capability` 没有独立视图，它作为 header 徽章与 Settings
里的安装进度存在——一个概念可以在两处呈现，但不能有两个入口。

## 7. 宽度与密度

内容列**保持 `max-w-2xl`**，不放宽到 3xl 或全宽。理由：三个视图都是纵向流，放宽只会让 URL 输入框与
任务行变长，没有信息增益；而 `panel` 变体本来就在这个宽度附近。

密集处用行卡片而不是表格：Activity Tab 的可用宽度不足以支撑 5 列表格，Adapter 列表用
`rounded-xl border border-border bg-card p-4` 的行卡片（与现有视觉基线一致），字段用 `text-[11px]`
次级文字，与 `media-preview-card.tsx` 的既有密度对齐。

## 8. 后果

**正面**

- Queue 不再被面板挤走；三个入口有文字标签，发现性从「看图标猜」回到「读标签」。
- 新增 Adapter 能力有一个天然的落点，不需要改造主视图动线。
- 五个 hook 的边界与视图边界一致，后续加视图（例如「历史」）不需要再动 `use-downloader.ts`。

**负面**

- 一次跨视图改造：`downloader-view.tsx` 从 205 行拆成容器 + 三个视图 + header，`use-downloader.ts`
  拆成五个文件。这是本批次最大的改动面，测试需要跟着重排（现有 11 个测试文件 / 57 用例需按新边界重组）。
- Tab 引入了一个「用户在 Settings 时看不到 Queue」的问题，靠 header 角标补偿，但补偿不等于等价。

**回滚**

视图层是纯前端重组，不改服务端契约。回滚到单文件视图不需要动 `service/`，只需还原
`src/features/downloader/` 与 `src/features/settings/`。
