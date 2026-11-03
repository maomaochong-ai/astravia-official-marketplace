# craft 家族：共用的词汇

这套插件里同样的东西有好几个名字，先把词对齐，后面的决定才读得懂。

## 拓扑

```text
Astravia 宿主（Electron 主进程 + 渲染进程）
├─ 插件运行时（本插件的 MF 模块）
│  ├─ craft-tab.tsx           活动标签的面板外壳
│  ├─ use-craft-editor.ts     状态机：starting → ready → …，暂停闸门也在这里接线
│  └─ craft-tools.ts          八个 Agent 工具，全部转向同一个 frame
│
├─ 活动标签
│  └─ <iframe src="http://127.0.0.1:<port>/?…">
│       └─ hub 返回的 HTML（上游 Web 构建 + 注入的 host-bridge.js）
│
└─ 主进程
   └─ 服务运行时：node server/hub.mjs
        ├─ 下载/校验 payload（按 payload/manifest.json 的 sha256）
        ├─ 起一个 loopback HTTP 服务，把 payload 静态发出去
        └─ 在发出的 HTML <head> 里注入 host-bridge.js
```

## 词

- **payload**：上游那个 Web 构建（`*.zip` / `*.tar.gz`），版本与 sha256 钉在 `payload/manifest.json`。
  插件不编译上游代码，只搬运产物。
- **hub**：`server/hub.mjs`，一个自包含的 Node 服务。它由 `server/hub.src.mjs` + `src/bridge/host-bridge.js`
  + `payload/manifest.json` 生成，所以 `plugin.json` 里每个平台钉的是同一份文件的 sha256。
- **bridge**：`src/bridge/host-bridge.js`，跑在 iframe 里面、上游 app 启动之前。它实现三件事：
  拦截打开/保存对话框把字节交给宿主、报告启动失败、以及把宿主的暂停与手势消息变成页面里的事件。
- **frame**：那个 iframe。所有 Agent 工具最终都是往 frame 里 `postMessage`，再等一条带 `id` 的回信。
- **gesture**：`craft:pointer` / `craft:key` 投出去的一次输入。它**不携带应用的解读**：
  回信只说"我派发了什么"，不说"应用做了什么"。
- **pause gate**：`craft:pause` / `craft:resume`。暂停之后 bridge 拒绝再向页面申请动画帧，
  于是应用自己的绘制循环停住，而 iframe 文档还活着。
- **staged**：`open_workspace_file` 做完的状态——字节已经进了页面，但用户还没在应用里按"打开"。

## 谁负责什么

| 关注点 | 归属 |
| --- | --- |
| 上游功能本身 | 上游项目，插件不碰 |
| 文件进出工作区 | 宿主与 bridge 共同完成，字节不落在页面里 |
| Agent 能不能动手 | 插件（手势工具）+ 上游是否读合成事件 |
| 应用内界面语言 | 上游构建（见 0007 的真实边界） |
| 插件外壳的文案 | `src/features/editor/strings.ts`，中英双语 |
