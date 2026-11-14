# strix-0013 — 执行环境由用户选，缺容器就交给宿主装

- **Status:** Accepted
- **Date:** 2026-11-14
- **Context:** 插件 strix 0.9.1；用户反馈「扫描中的环境默认本机，但我要能选容器；没有容器时一键安装，装完能刷新」
- **Related:** [0001](strix-0001-environment-without-docker.md)（无 docker 的降级）、[0002](strix-0002-capability-parity-with-upstream.md)（scan mode 与 environment mode 分离）

## 问题不只是一个下拉框

改之前，环境是**自动决定**的：`resolveEnvironment()` 看 docker 起来没有，起来就进容器，否则本机。
面板上是只读的一行「环境 本机（无容器）」。两个后果：

1. 用户**没法要求**容器——想用更强隔离时做不到；
2. 用户**没法知道为什么**没进容器——只看到"本机"，看不到 "docker daemon not reachable"。

还有一处名字撞车埋的雷：`strix_sandbox_start` 的 `mode` 参数是**扫描深度**
（quick/standard/deep/diff），而环境偏好最初被我塞进同一个字段——于是"选了容器"会被解释成
"scan mode = docker"，静默失效。这一条在实现时被真机脚本顶出来（`sandbox_start(no mode) → host`
与预期的 docker 不符），现在 `environment` 是**独立参数**。

## The decision

**环境是用户的选择，有三个取值，且"选了但不可用"要如实说。**

| 取值 | 行为 |
|---|---|
| `host` | 显式本机：即使 docker 可用也不进容器（要快、要挂宿主路径时） |
| `docker` | 显式容器：**daemon 没起来就说不可用**，绝不静默退回本机 |
| `auto` | 旧行为：有 docker 用容器，没有就本机 |

三条落点：

1. **偏好存在服务端**（`preferences.json`），不在 localStorage：因为 agent 也要读它。
   用户在面板选容器，接着在对话里说"开始扫描"，`strix_sandbox_start` 不传 `environment`
   时必须落在 docker 上——偏好只有一份，才不会出现"面板显示容器、实际跑在本机"。
2. **缺容器时把安装命令交给宿主执行**：`POST /api/preferences {install:true}` 跑平台安装命令
   （Windows `winget install Docker.DockerDesktop`、macOS `brew install --cask docker`、
   Linux 只回显 `apt-get` 一行——需要 root，插件不去替用户 sudo）。装完 `refresh()` 重新探测，
   面板上的环境行从不琥珀变正常。
3. **只影响下一次启动**：已经在跑的扫描不中途换环境（environment mode 是会话快照，ADR 0002）。

## Considered options

- **自动探测 + 只在不可用时提示**：改动最小，但用户仍然无法**要求**容器。**否。**
- **偏好存 localStorage**：UI 简单，但 agent 读不到，于是面板与实际执行分裂。**否。**
- **缺 docker 时自动装**：安装器要管理员权限、几 GB 下载、可能要求重启——静默装比不装更冒犯。
  只提供"用户点、宿主跑、结果可查"。**否。**

## What this does not do

- 不替你 sudo（Linux），不重启 docker desktop，不验证安装是否真的成功到"能跑容器"：
  只报告命令的退出码，然后重新探测环境——**探测结果是唯一裁判**。
- 不在 `strix_environment` 之外新增"环境"工具：偏好走 HTTP 端点，工具面不变（仍是 36 个）。

## The cost

- 选了 `docker` 而 daemon 没起来时，扫描会**失败**而不是降级。这是刻意的：静默降级会让你以为
  自己在容器里跑。面板把原因与安装入口摆在同一个位置。
- 偏好是"每台机器一份"，不是"每个项目一份"：同一个用户在不同项目里通常机器相同。
