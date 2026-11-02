# 七个插件共享一份源码，用生成器产出

七个 craft 插件是同**一个程序**钉住不同的上游 payload，所以共享的 `src/` 与 `server/` 逐字节
复制自 `tools/craft/stem/`，唯一按应用变化的是 `src/app.config.ts`、`plugin.json`、
`payload/manifest.json` 与展示层文件。

**为什么不手工维护七份。** 文件桥的协议是字符串常量：页面里 `host-bridge.js` 发 `craft:open`，
面板里 `use-craft-editor.ts` 认 `craft:open`。七份手抄意味着七次机会让两边拼错一个字母，而
症状是"按钮点了没反应"——既没有报错，也不在类型系统里。生成器把这类漂移从"运行时谜题"
降级成"重新生成即可"。这条不是推测：`photocraft` 0.0.4 就已经因为改动 bridge 前缀而必须
同步改面板侧（Observed，`src/bridge/host-bridge.js` 与 `use-photocraft-editor.ts` 成对修改）。

**代价与边界。** 生成器写文件是整份覆盖，`abilities/plugins/<id>/src/**` 与 `server/**`
不是工作副本；要改就必须改 stem 再重新生成（`AGENTS.md` 与 `README.md` 都写了这句）。
`photocraft` 因此也并入统一 stem：它的 `pc:` 协议、`PHOTOCRAFT_` 环境变量名与
`SERVICE_VERSION` 全部改为由 `app.config.ts` 与 `payload/manifest.json#app` 提供，
用户可见行为（默认中文、状态条、全屏按钮、文件桥、三入口）保持不变。

**证据与未验证。** Observed：七个上游仓库都存在 `assets/app-icon/<id>-1024.png`，图标因此
全部是官方位图，没有一个是 Solar 占位（`abilities/plugins/*/assets/icon.png` 与上游文件
逐字节相同）；六个 payload 的 sha256 与 `/tmp/craft-zips/*.zip` 实测一致，`photocraft`
与 `/tmp/pc-web-019.zip` 一致，生成器在缺失或不符时直接失败而不是继续写 `plugin.json`。
Inferred：这些插件在宿主里能否启动，仍取决于服务运行时与 WebGPU 可用性——本地构建通过
`tsc` 与打包，不等于在界面里跑通。
