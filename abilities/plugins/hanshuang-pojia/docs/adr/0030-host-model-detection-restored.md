# 0030 — 宿主模型检测：读回来，并且真的读得到

- 状态：已采纳（取代 0029 D3）
- 日期：2026-11-22
- 版本：2.17.43
- 相关：0024（对照表以对话为准）、0029（表格始终在场；本条推翻其中的「模型只手填」）

## 背景

0029 把「宿主模型」整条链路删掉了，理由是它从未工作过。用户的反馈指出了正确的方向：
**不是要手填，而是要检测到宿主当前在用的模型并显示出来，让用户直接拿它测梯度。**

所以要看清楚那条链路为什么从来没工作 —— 这不是设计错误，是实现错误。

## 找出来的真因

`runtime/contributions.ts` 过去写：

```
ctx.storage.writeFile("workbench/host-model.json", …)     // 插件作用域，单文件
```

面板侧读的是：

```
storageEntry("hostModel", null, sessionId).path
  → "workbench/sessions/<sessionId>/host-model.json"      // 会话作用域
```

两边格式一致、都有自己的测试、都"看起来对"，**只有路径不一样**。于是那一栏永远是空的，
而任何单侧测试都不会红。删掉它是治错了病：病是路径，不是功能。

## 决策

### D1 写入端按会话写，走同一份 layout

`rememberHostModel(ctx, context)` 在 kernel system prompt provider 里运行。
上下文提供 `session.{id,cwd}` 与 `model.{provider,id,api}`，所以：

```ts
const entry = storageEntry("hostModel", context.session.cwd, context.session.id);
await writeJsonFile(ctx.storage, entry.path, snapshot);
```

快照只有四项：`provider` / `id` / `apiStyle` / `api`（原样保留，方便排查）+ `at`。
没有 baseUrl、没有密钥 —— 这两样面板永远不该持有（0024 的边界不变）。

### D2 读取端同一个键，会话隔离

`bridge.hostModel(sessionId)` 读 `storageEntry("hostModel", null, sessionId).path`；
`storage-layout` 里该键恢复为 **session** 作用域。两个会话跑不同模型时，各看各的。

`model.probe.refresh` 同时重读记录与快照：它们回答同一个问题「现在该测谁」。

### D3 面板：显示、一键使用、自动跟随

表单上方固定一行检测结果：

| 状态 | 显示 |
| --- | --- |
| 探测到，且正是要测的 | `provider / id · apiStyle` + 徽标「正在测它」 |
| 探测到，但填的是别的 | 同上 + 按钮「用这个」 |
| 没探测到 | 「还没探测到：这个会话里发一条消息，运行时会把宿主的模型记下来」 |

自动行为两条，判据不同：

- **首帧填空**：只在那格为空时填一次（`seeded` ref）。用户打开面板要的是「直接测」，不该先手敲一遍；
- **换模型跟随**：`followHostModel` —— 只在空或仍等于**上一个**宿主模型时跟随。
  用户自己敲过的值不动，他可能在做对照实验。

### D4 「记录来自 X」比较的是宿主，不是表单

0029 把那个提示改成与手填值比，语义就错了：`probe.stale` 的文案是「记录来自 {{model}}」，
参数必须是被记录的那个模型，而"是否过期"只能相对宿主当前模型判断。
现在：`record.model !== hostModel.id` 才提示，参数传 `record.model`。

## 后果

- 用户打开提示词页就能看到宿主在用什么，一次点击即可开测；
- 那条链路现在有**路径一致性**测试：写入端与读取端都必须经由 `storageEntry("hostModel", …)`，
  且同一 sessionId 算出的路径相等。这类"两边各自正确却对不上"的缺陷，只有这种断言能抓；
- 探测不到时不再静默留空，而是说明原因（这个会话还没跑过一轮）。

## 不做什么

- **不在面板里读宿主的 baseUrl**：SDK 不提供，猜一个会指向错误的端点；
- **不把密钥写进快照**：探测执行时由调用方一次性提供，输出打码（0024）；
- **不在 hostModel 缺失时编一个默认模型名**：那会让"未探测"看起来像"已确认"。

## 验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 通过 |
| `vitest run` | 104 文件 / 1027 条通过 |
| `check-layout --strict` / `check-css --strict` / locale `--strict` | 通过（1103 键 / 0 未用） |
| `host-model.test.ts`（4 条） | 写入/读取同键、session 作用域、快照只含四项非机密、卡片有「用这个」 |
| `probe-live-and-targets.test.ts`（+5 条） | 空值、跟随、不覆盖手填、同值 no-op、auth 头随 apiStyle |
| 实机：检测到的模型、点击填入、换模型跟随 | **NOT RUN**（工作区无可用 Desktop） |

实机验收：装 2.17.43 → 在一个会话里发任意一条消息（让 kernel provider 跑一次）→ 打开「提示词」页 →
表单上方应显示 `provider / id`；若表单为空，模型格应已被填上；把表单改成一个别的名字，再让宿主换模型，
那一格不应被改回。
