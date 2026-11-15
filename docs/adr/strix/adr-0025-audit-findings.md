# ADR 0025：一次 bug 与性能审查的结论

- 状态：已采纳
- 日期：2026-11-15
- 关联：[ADR 0022](adr-0022-composer-is-bidirectional.md)（面板与宿主的双向）、[ADR 0024](adr-0024-backdrop-is-drawn-not-downloaded.md)（自绘背景）
- 取代：无

## 怎么查的

三层，各自有可复现的证据：

| 层 | 手段 | 覆盖 |
|---|---|---|
| 静态 | `grep` 级规则扫 7 类形状（定时器不清、监听器不摘、循环里 await、无上限数组、同步 IO、渲染期随机、空 catch） | 66 个源文件 / 11187 行 |
| 单元 | 现有 71 个测试文件（460 项）+ 本轮新增 4 个文件 | 逻辑与契约 |
| 端到端 | 起真的服务进程量 HTTP；真 Chromium 量动画的主线程时间与像素对比度 | 延迟 / 合成开销 / 可读性 |

静态扫的结论先说：**7 类里有 6 类 0 命中**——没有不清的定时器、没有成对的监听器泄漏、没有无上限的数组（面板侧）、没有渲染期随机数、没有空的 catch、请求路径里没有同步 IO。唯一的命中是"循环里 await"13 处，逐条看过：11 处是有意的（重试退避、顺序等子进程），2 处是真问题（下面 P3）。

## 发现与修复

### P1（严重 · 性能）`/api/state` 每次都在打机器

面板的 `refresh()` 有四个调用点（挂载、换会话、turn-end、**每次 tool-call-end**），每次都请求
`/api/state`，而这个接口每次都：

```
dockerReady()          spawn `docker info`              2281 ms
imagePresent()         spawn `docker image inspect`      981 ms
probeToolchain()       每个工具 `--version`（host 模式） 4590 ms
loadIndex()            75 篇技能顺序读                   150 ms
```

实测：`/api/state` **稳定 2.6 秒**（本机模式约 7 秒）。也就是说，一轮评估里每调一次工具，
就有几秒钟花在重复回答同一个问题上——而且这些子进程与真正的扫描抢 CPU 和磁盘。

修复：`service/probe-cache.ts`（TTL + 单飞 + force），三处接上：

| 探测 | TTL | 说明 |
|---|---|---|
| 环境（docker） | 8s（失败 1.5s） | 失败的缓存更短，daemon 刚起来能尽快反映 |
| 工具链 | 60s | 二进制不会中途出现 |
| 技能索引 | 60s | 随包内容运行期不变 |
| MCP 名单 | 10s | 取它的代价是容器内一次 `docker exec` |

并且：服务启动即预热（第一次读不再付冷探测）、`/api/environment` 与 `strix_environment`
强制失效（用户/模型主动问，要的是现在）、`pull` / `install` / `sandbox stop` 后失效。

**结果：`/api/state` 中位 2664 ms → 18 ms（约 150 倍）。**

### P2（中 · 正确性）刷新是"每个事件一次请求"

即使有了缓存，五个并发的 `tool-call-end` 仍会同时打五个请求，并且每次都把状态条刷回
`connecting`（视觉上像断线）。修复：钩子里加单飞合并器（在飞时只置标记，跑完补一次），
`connecting` 只在首次加载时出现。

结果：5 个事件 → 最多 2 次请求（`test/panel-refresh-coalescing.test.tsx`）。

### P3（中 · 正确性）SSE 断线后永远收不到事件

`bridge-client.events()` 只在挂载时建一次 `EventSource`。服务被宿主重启（装新版本、崩溃拉起）
后端口可能变，而 EventSource 自带的自动重连记的是**创建时**的 URL——于是它永远连不上，
面板看起来还活着，只是运行记录不再更新。这类故障在截图上看不出来，只能靠读代码发现。

修复：`onerror` 里关掉旧连接、用最新的 `baseUrl()` 重连，退避 0.5s→1→2→4→8，封顶 10s。
（`test/bridge-events-reconnect.test.ts` 用假 EventSource 跑"断 → 换端口 → 重连"。）

### P4（中 · 内存）服务日志无限增长

`log.push(payload)` 没有任何上限，每条工具事件都写。跑几小时的评估就是几十万条，
而对外只用最后 40 条。修复：`LOG_LIMIT = 200`，每次 push 后裁剪。

### P5（低 · 健壮性）请求体没有上限

`readBody` 把整个 body 读进内存再 parse。只监听 127.0.0.1，但一次误发的巨大 payload
仍能把服务打进交换分区。修复：`MAX_BODY_BYTES = 16 MiB`，超限停止累积。

### P6（中 · 性能）扫光动画每帧重绘整屏

`.astra-strix-sheen` 用的是 `background-position` 动画。真引擎实测（5 秒空转）：

```
无背景层      task 0.018s   style 2
background-position 版  task 0.395s   style 118      ← 22 倍
transform 版  task 0.015s   style 2
```

修复：改成子元素 + `transform: translate3d`（视觉一致，走合成层）。

### P7（低 · 清理）僵尸常量与文档缺口

- `use-strix-session.ts` 里的 `const TRACE_LIMIT = 400` 没人用（真上限在 `domain/trace-log.ts`）。
- `strix_load_skills` 的描述没提 `suggestions`（1.4.1 新行为，模型需要知道）。

## 没改的（连同理由）

| 观察 | 为什么不改 |
|---|---|
| 工具链探测 4.6s（host 模式首次） | 它是"这台机器装了哪些工具"的一次性事实，缓存 60s 后可接受；再快就得读注册表/PATH 猜，不如真跑一次 |
| `telemetry.toolCalled` 每次调用写一次 JSON | 文件几百字节，写的是小文件；改成批量 flush 会让"计数"在崩溃时丢，权衡后保留 |
| `/api/environment` 2.5s | 它是**显式刷新**，用户点「刷新环境」就是要等这一刻的真话；缓存它反而会骗人 |
| `/api/state` 首次 2.2s（冷启动） | 服务启动已经预热，只有"服务刚起来 + 面板立刻打开"这一瞬间会等 |

## 复现命令

```
node .tmp/bench-state.mjs --tag before   # /api/state 冷/热延迟
node .tmp/bench-anim.mjs                 # 三个动画变体的主线程时间
node .tmp/measure-contrast2.mjs          # 背景像素的对比度（解 PNG 采样）
npx vitest run --no-file-parallelism     # 71 文件 / 460 项
```

（`.tmp/` 已 gitignore：这些是审查工具，不随插件分发。）
