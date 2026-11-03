# 七份副本，一条一致性测试

七个 craft 插件是**同一个程序**钉住七个不同的上游 payload：`src/**`、`server/hub.src.mjs` 与
`scripts/build-hub.mjs` 在七支之间逐字节相同，唯一按应用变化的是 `src/app.config.ts`、
`plugin.json`、`payload/manifest.json` 和展示层文件。

## 为什么不是继续用生成器

以前仓库里有一个生成器（`tools/craft/generate.mjs` + `tools/craft/stem/`），把 stem 展开成六份。
它的理由是真实的：文件桥的协议是字符串常量，页面里 `host-bridge.js` 发 `craft:open`，面板里
`use-craft-editor.ts` 认 `craft:open`，六份手抄就是六次机会让两边拼错一个字母，而症状是
"按钮点了没反应"——既没有报错，也不在类型系统里。

它被删掉的理由同样是真实的：

1. 生成器把目录变成了产物。改任何一行都要先找到 stem，再重新生成，而六份生成结果本来就该被读——
   review 时看到的 diff 和实际文件不是一回事，`src/**` 里写一句注释都得绕。
2. stem 与生成物长期并存，两者都能被编辑，漂移只是从"六份之间"搬到了"stem 与六份之间"。
3. 它把 `tools/` 变成了插件目录之外的第二个源码树，而这个仓库的规矩是能力只住在
   `abilities/plugins/<slug>/` 里。

所以现在：**七份副本就是源码**，一致性由测试守住，而不是由生成器保证。

## 守住什么

`tests/craft-parity.test.mjs` 对七支插件递归取 `src/**`（跳过 `src/app.config.ts`）加上
`server/hub.src.mjs`、`scripts/build-hub.mjs`，逐文件比 sha256；任何一处漂移都直接失败，并打印
是哪支插件、哪个文件、两份摘要各是什么。它另外断言两件事：每支插件只声明自己的 id，
以及所有相对路径不越出插件目录。

要改共享行为时，顺序是：改一支 → `node --test tests/craft-parity.test.mjs` → 它会告诉你另外六支
哪些文件不一致 → 把同样的改动落到那六支 → 测试变绿。不是"改完就完"，也不是"改完再想办法同步"。

## 哪些文件允许不同

| 文件 | 为什么不共享 |
| --- | --- |
| `src/app.config.ts` | 应用的 id、名称、标签、服务 id 与版本、上游仓库 |
| `plugin.json` | 包身份、权限、服务运行时、每个平台的 hub sha256 |
| `payload/manifest.json` | 钉住的上游版本、sha256、下载源、应用在 payload 里的身份 |
| `ABILITY.md` / `ability.json` / `detail*.json` / `README*.md` / `assets/` | 展示层 |

`src/app.config.ts` 的头部注释写明了这条规矩，**并且**指向本文件；改动它之前先读这一篇。

## photocraft 是第七支

photocraft 比这条家族线更早，曾经有自己的目录形状（`src/tab/`）和协议前缀（`pc:`）。这些都收敛了：
现在它的 `src/**`、`server/hub.src.mjs`、`scripts/build-hub.mjs` 与其余六支逐字节相同，
`tests/craft-parity.test.mjs` 把它一并纳入。

它为什么曾经被算作"外面的一支"：它的中文化很早、很多，服务运行时、全文屏、文件桥都是在它身上先做出来的。
但那些决定现在都写进了共享代码，剩下按应用变化的东西与其余六支一样——payload 钉、清单、展示层。

**这就是把 photocraft 拉进一致性测试的理由**：暂停闸门与三个手势工具最初只落到了六支，
photocraft 因为"不属于这一套"被漏掉，症状是同一个宿主变卡、Agent 在它里面点不动。
测试比记忆可靠。

## 证据

- Observed：`node --test tests/craft-parity.test.mjs` 当前通过；七支的 `src/**` 摘要全等。
- Observed：`node --test tests/craft-manifest.test.mjs` 通过，七份 `plugin.json` 都过宿主自己的
  `PluginManifestSchema`。
- Inferred：这份相等性只在仓库内成立；插件装进宿主后能不能起来，仍取决于服务运行时与 WebGPU 可用性。
  本地 `tsc` 与打包通过不等于在界面里跑通。
