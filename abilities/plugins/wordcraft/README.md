# WordCraft

Write and revise documents inside Astravia — the upstream WordCraft editor, with a ribbon, styles, tables, tracked changes and .docx round-tripping.

插件把上游 WordCraft 的**官方 web 构建**放进活动面板的一个 iframe 里跑：同一份 wasm、同一份
JavaScript，没有分支、没有重新编译。插件自己只做上游不做的事——把文件供给进去、把面板和编辑器
连起来、把这些能力交给 Agent。

## 上游钉在哪个版本

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/wordcraft |
| 发布的 web 包 | `wordcraft-web-0.15.0.zip` |
| 版本 | `0.15.0` |
| 大小 | 20,205,395 B（20 MB） |
| sha256 | `c5a02d4e4f1d3e59288da4647d2d734296fd31e39ccd060a83ac2d2faa12a79a` |

这些数字来自实际发布的制品；`payload/manifest.json` 里的 `sha256` 是唯一信任锚，
对不上就拒绝使用。

## 结构

```text
src/app.config.ts        唯一按应用不同的源码
src/…                    与其余 craft 插件逐字节相同（parity 测试守护）
server/hub.src.mjs       静态 hub 源；server/hub.mjs 是生成物
scripts/build-hub.mjs    生成 hub 并把 sha256 写回 plugin.json
payload/manifest.json    上游制品与摘要
agent/skills/wordcraft/     Agent 技能与上游文档入口
docs/adr/wordcraft/         本应用的决策记录
```

## 开工

```bash
npm install
npm run build:hub      # 重新生成 server/hub.mjs，并同步 plugin.json 的摘要
npm run check          # tsc --noEmit + hub 是否过期
npm run build          # 正式包由 CI 构建，dist/ 不提交
```
