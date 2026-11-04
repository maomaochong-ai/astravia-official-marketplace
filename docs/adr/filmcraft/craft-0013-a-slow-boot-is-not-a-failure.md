# 慢启动不是失败：看门狗靠心跳，不靠六十秒硬超时

插件面板在首次打开时常常是"打不开"的：黑框里一行上游自己的 `Loading …  This is taking longer
than usual`，再等下去也不会变，只能关掉重进。这不是页面坏了，是外壳先放弃了。

**问题一：六十秒硬超时把"冷启动"判成了"起不来"。** 旧 `announceBoot()` 的判据是
`Date.now() - started > BOOT_MS`（`BOOT_MS = 60000`），到点就发 `craft:error` 并
`clearInterval`。这些站点是 13–32 MB 的 wasm：photocraft 13.1 MiB、wordcraft 19.3 MiB、
effectcraft 20.9 MiB、lightcraft 25.8 MiB、designcraft 25.8 MiB、vectorcraft 32.0 MiB。
浏览器要把整个模块下载、编译、实例化，再建 GPU 管线；冷启动超过一分钟是常态，不是异常。
更糟的是超时那一刻 `timer` 被清掉——**看门狗永久退场**，即使应用在第二分钟真的起来了，
也没有人再发 `craft:ready`，面板就停在"启动中"。

**问题二：被误判的失败还会连带降级。** `craft:error` 带 `boot-timeout` 时宿主按
"WebGPU → WebGL2 → 软件渲染"的阶梯重载（`nextDowngrade`）。一次慢启动于是变成三次重载、
每次再等一分钟，最后落在软件渲染上仍然是同一个慢启动——用户看到的是"点了没反应"。

**决定一：超时线拉开到五分钟，慢只报"慢"。** `SLOW_MS = 25000` 之后心跳里带 `slow: true`，
`BOOT_LIMIT_MS = 300000` 才发 `craft:error`。五分钟仍然起不来，才值得去降级。

**决定二：看门狗改成心跳。** 每 250 ms 发
`{ type: "craft:boot", loader, slow, waitedMs }`，`loader` 是上游写进
`#<app>_loading` 的**原文**。上游不报字节进度，这一行就是它唯一的活动信号；把它原样转给外壳，
比在外壳里画一条与真实进度无关的动画诚实。只有命中
`/failed to start|failed to load|device lost/i` 的句子才立刻判失败——那是上游自己说它失败了。

**决定三：启动遮罩由外壳提供，十五支同一份。** `src/features/editor/components/boot-cover.tsx`
在 `phase !== "ready"` 时盖住 iframe：图标（`new URL("../assets/icon.png", siteRoot())`，
取不到就退化成首字母）、应用名、三段真实阶段（读渲染包 → 启动引擎 → 绘制首帧）、已用秒数、
上游 `loader` 原文；18 秒后补一句"首次启动要编译整个引擎"，失败时才出现重载按钮。
进度条按阶段与时间推进，到 `craft:ready` 才满格：它表达"还在动"，不冒充字节数。

`assets/icon.png` 是包内文件、也是商店卡片用的那张图，所以遮罩不需要 per-app 导入，
也不需要把同一张 PNG 再打进 JS 包；这也让"十五支加载界面一致"落在共享 `src` 里，
`app.config.ts` 仍然只放身份。

**证据与未验证。** Observed：`host-bridge.js` 旧 `BOOT_MS = 60000` 与
`announceBoot()` 的 `clearInterval` 分支；`scripts/stage-plugin-release.py` 记录的已发布包体积
（vectorcraft 32.0 MB … craft-anything 2.8 MB）；photocraft 纯 http 复现里 12 秒仍停在
`Loading PhotoCraft… This is taking longer than usual`；固定上游 release 的 zip 内
`index.html` 的 `#<app>_loading` 元素结构。Inferred：五分钟上限在真实桌面端是否够——
无头 Chrome 没有 GPU，无法测出真实冷启动时间，本机 harness 只能验证"不再在 60 秒自杀"这一半。
