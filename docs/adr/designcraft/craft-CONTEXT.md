# craft 家族：共用的词汇

这套插件里同样的东西有好几个名字，先把词对齐，后面的决定才读得懂。

## 拓扑

```text
Astravia 宿主（Electron 主进程 + 渲染进程）
├─ 插件运行时（本插件的 MF 模块）
│  ├─ craft-tab.tsx           活动标签的面板外壳
│  ├─ use-craft-editor.ts     状态机：starting → ready → …，暂停闸门也在这里接线
│  ├─ site-document.ts        读包内 web/index.html，注入 base / URL / 种子 / bridge
│  └─ craft-tools.ts          五个 Agent 工具，全部转向同一个 frame
│
├─ 活动标签
│  └─ <iframe srcdoc="…">
│       └─ astravia-plugin://<id>/versions/<v>/web/index.html 的正文
│          （上游 Web 构建 + 注入的 base、URL 垫片、语言种子、host-bridge.js）
│
└─ 包里
   └─ web/                    CI 用上游源码按上游配方构建的静态站点，git 里没有
```

## 词

- **site**：`web/`，CI 用上游自己的 web 构建配方（多数是 `trunk build --release`，photocraft 是 boot+分包，三支是 `cargo xtask web`）产出的静态站点，
  随插件包分发。git 里没有它，`abilities/plugins/*/web/` 在 .gitignore 里。
- **pin**：`payload/manifest.json`（schemaVersion 3）——上游仓库、40 位 commit、
  `webApp` 是哪个 crate。它不再是二进制制品的摘要，而是"这份站点由哪一版源码构建"。
- **bridge**：`src/bridge/host-bridge.js`，跑在 iframe 里面、上游 app 启动之前。它实现三件事：
  拦截打开/保存对话框把字节交给宿主、报告启动失败、以及把宿主的暂停与手势消息变成页面里的事件。
- **frame**：那个 iframe。所有 Agent 工具最终都是往 frame 里 `postMessage`，再等一条带 `id` 的回信。
- **gesture**：投出去的一次输入。单发的 `craft:pointer` / `craft:key` 仍在，成批的走 `craft:act`。
  它**不携带应用的解读**：回信只说"我派发了什么"，不说"应用做了什么"。
- **act**：`craft:act`，一个 `steps[]` 在页面里一次跑完，每步之间按帧节流。见 0009。
- **probe**：`craft:probe`，把画布压成 `columns × rows` 的字母地图 + 平均色 + 对比度。
  这是 Agent 唯一能"看见"画布的通道，因为图片进不了工具结果。
- **HUD**：iframe 里那条"自动操作 3/8 · …"的提示条，字面文案来自 `editorStrings(locale)`，
  不能用 `%key%`（那只在宿主 UI 层解析）。
- **pause gate**：`craft:pause` / `craft:resume`。暂停之后 bridge 拒绝再向页面申请动画帧，
  于是应用自己的绘制循环停住，而 iframe 文档还活着。
- **staged**：`open_workspace_file` 做完的状态——字节已经进了页面，但用户还没在应用里按"打开"。

## 谁负责什么

| 关注点 | 归属 |
| --- | --- |
| 上游功能本身 | 上游项目，插件不碰 |
| 站点的字节 | 上游源码 + 上游自己的构建配方，由 CI 装进包（见 craft-0011） |
| 文件进出工作区 | 宿主与 bridge 共同完成，字节不落在页面里 |
| Agent 能不能动手 | 插件（手势工具）+ 上游是否读合成事件 |
| 应用内界面语言 | 上游构建（见 0007 的真实边界） |
| 插件外壳的文案 | `src/features/editor/strings.ts`，中英双语 |
