# 编辑器不再占满每一处，也不再常驻

## 症状

四个现象，用户是分开报的，根因是三处：

1. 一支 craft 插件被打开过之后，宿主整体变卡，第四、第五个画布干脆起不来——
   deckcraft 的 `recent` 里留下的是上游原文：
   `Uncaught RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory for new instance`。
2. 每换一个项目或一条会话，标签栏里都排着这些插件，不管这条会话有没有用过它。
3. 输入框下面一直挂着插件的名字，切到别的会话也还挂着。
4. 编辑器画面被自己的提示层盖住：起不来时那层是全屏不透明的，起得慢时角落里那行字永不消失。

## 根因

1. **标签被声明成 `retention: "pinned"`。** 宿主的驻留策略
   （`activity-tab-residency.ts`）对 `pinned` 直接 `return true`，只逐出 `warm` 的、
   超出 `DEFAULT_INACTIVE_WARM_TAB_LIMIT`（= 2）的那些。于是用户访问过的每个编辑器
   在窗口存活期间都留在内存里，**连同它的 wasm 实例**。13–32 MB 一个，第四五个就没有
   地址空间可分了。craft-0004 只关掉了持续绘制，明说过"文档本身仍在内存里"——这条是那次
   留下的窟窿。
2. **还有一个 20 秒的唤醒兜底。** `use-craft-editor.ts` 里 `WAKE_FALLBACK_MS = 20000`
   让一个从没被显示过的标签也去加载站点，理由是"万一宿主不报可见性"。但每一条合法的
   路径（`openActivityTab`、用户点标签）都会先让标签变成 active，所以这个兜底实际上只
   服务了没人在看的标签——十五支插件 = 十五个引擎在对话背后编译。
3. **上栏是缺省行为。** `initiallyVisible` 缺省 `true`，加上
   `scope_use: ["conversation", "project"]`，就变成"每条会话、每个项目都上栏"。
4. **胶囊是 `lifecycle: "sticky"`。** 宿主把它画在输入框下面，直到插件卸载才清；而这个
   标签一辈子不卸载，因为第 1 条。
5. **提示层按"能不能起得来"决定存在，不按"还挡不挡路"决定。** `boot-cover.tsx` 在
   `phase !== "ready"` 时都是 `absolute inset-0` + 不透明渐变；`activity-strip.tsx` 又把
   `kind === "notice"` 的行走廊永久钉住（`const pinned = last?.kind === "notice"`）。
   失败态的页面里，上游已经把自己的错误原文写进了 DOM——正好被我们盖住。

## 决定

一条线索：**占用要跟随用户的选择，而不是跟随安装。**

- `retention: "pinned"` → `"warm"`。活跃标签照旧保留；最近两个访问过的保留；其余由宿主
  逐出，iframe 卸载，wasm 实例归还。代价写在下面。
- 删掉 `WAKE_FALLBACK_MS` 与它的定时器。唤醒只有一个条件：宿主报告 `active`。
- `initiallyVisible: false`。标签不再自动上栏，而是留在面板的「+」列表里（宿主
  `resolve-activity-tabs.ts` 把 `initiallyVisible: false` 的插件标签放进 `available`，
  副标题就是插件名）。工具调用走 `openActivityTab`，会把它 attach 上栏并激活；用户自己
  点「+」加一次，宿主按工作区记下这条可见性，**这条会话以后就一直有，别处仍然没有**。
- 胶囊只在**这个标签被选中时**挂上（`tab.active === true`），离开就
  `setPromptAttachment(null)`。仍然是 `sticky`——在它该在的那段时间里，画布就是话题，
  一次性附件会让 Agent 在两句话之间忘掉作品；但它不再跟着用户进别的会话。
- 提示层改成"只在没有东西可看的时候遮"：
  - `starting` 且未慢（前 18 秒）：整幅盖子照旧，此时后面本来是一块黑底加一行灰字；
  - 慢或失败：收成贴底的一条 dock（2 px 进度发丝 + 图标 + 阶段 + 上游原文 + 重载按钮），
    画面完全露出来。失败时上游写进 DOM 的错误原文因此可见——那才是用户需要读的那行；
  - `activity-strip` 的 notice 给 20 秒 TTL（原来是永不消失），行数 3 → 2。

## 代价

- **`warm` 意味着逐出。** 宿主卸载 iframe 时不问插件，插件侧也拦不住（没有逐出前的
  hook）。没保存的编辑会随 iframe 一起消失。缓解只有两条：画布应用本身有自动保存/撤销的
  就靠它；没有的，用户切走两个标签以上再回来会看到重建后的空画布。**这一条是真损失，
  写在这里而不是藏起来。**
- **不上栏意味着要主动找。** 没装「+」、也没让 Agent 打开过的会话里，没有这个标签的入口。
  这是需求"切会话不要再冒出来"的直接代价，换来的是同样的动作只需点一次。
- 逐出后重建要重新解码 wasm（冷启动那几秒），所以"最近两个"这个数字是有意义的：来回切
  两个编辑器不会付这笔钱，切到第五个才会。

## 验证与未验证

- Observed：宿主 `activity-tab-residency.ts` 里 `if (retention === "pinned") return true;`
  与 `DEFAULT_INACTIVE_WARM_TAB_LIMIT = 2`；`resolve-activity-tabs.ts` 里
  `explicitTabVisibility(...) ?? def.initiallyVisible !== false`，以及
  `initiallyVisible === false` → `available`（「+」池）。
- Observed：`TeamComposerConnector.tsx` 只在 `lifecycle !== "sticky"` 时于发送后清空附件，
  所以 `sticky` 的确会一直显示；`plugin-ui-context.ts` 在插件卸载时按 `ownerPluginId` 清。
- Observed：`activity-tab-residency.test` 之外的宿主行为没有在本机跑过——本仓库没有宿主
  可执行路径。
- Inferred：`warm` 逐出后 wasm 实例真的被回收，因而 `WebAssembly.instantiate` 的 OOM 会
  消失。**没有**在真机上复现"第五个画布起不来 → 改 warm 后能起来"这条链路；验证路径是
  连续打开五个编辑器，看第五个是否能画、以及宿主进程 RSS 是否回落。
- 没有解决的部分：单个编辑器自身的峰值内存没变；冷启动解码时间没变；逐出丢未保存状态
  （见代价）。
