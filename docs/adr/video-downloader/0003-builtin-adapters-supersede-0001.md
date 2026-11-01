# ADR 0003：把三个内置适配器随插件发布，超替 0001 的「零内置站点脚本」

- 状态：已落地（2026-11-01，2.6.0）
- 决策对象：`abilities/plugins/video-downloader/src/domain/builtin-adapters.ts`
- 超替：[0001](./0001-userscript-adapter-layer.md) §2「插件不内置任何站点脚本」
- 关联：[0002](./0002-panel-information-architecture.md)（Adapters 视图）、[CONTEXT.md](./CONTEXT.md)（术语）

## 1. 背景：0001 的假设被实测推翻

0001 的取舍是「Adapter 只作为用户可写脚本的容器，插件自己不带站点逻辑」。它成立的前提是：
Engine（yt-dlp）覆盖绝大多数站点，剩下的长尾由用户自己写脚本补。

2.5.0 之后的三组实测否掉了这个前提：

| 站点 | Engine | 页面里有什么 | 用户能不能自己补 |
| --- | --- | --- | --- |
| 爱奇艺 | `Can't find any video`（上游 extractor 挂了，#17146 / #13955 至今 open） | 播放器 `_mvInfo` 里有签名 m3u8 | 能，但要懂播放器结构 |
| 微信视频号 | 无 extractor | 只有封面、标题、作者，流地址交给微信客户端 | 不能，页面里根本没有 |
| 通用长尾 | `Unsupported URL` | 页面 `<video>` / 资源瀑布里已有一条能播的地址 | 能，但要会写选择器 |

第一、三类是插件应当直接解决的：它们是**可判定的**、**与站点版本无关的**提取，而不是内容策略问题。
第二类即使解决了提取也拿不到流，只能诚实报元信息。

于是 0001 的「零内置」从一条原则退化成一次遗漏：插件在最常见的一类失败上要求用户先写脚本。

## 2. 决策

随插件发布三个只读适配器，恒定启用，不可编辑、不可删除：

| 显示名（英文，同时是条目的 `site`） | 匹配 | 产出 |
| --- | --- | --- |
| `Page Sniffer` | `<all_urls>` | 页面里已经在播的地址（资源瀑布 → `video`/`source` → og:video → JSON-LD，按置信度排序） |
| `iQIYI Player` | `https://*.iqiyi.com/*`、`https://m.iqiyi.com/*` | 播放器 `_mvInfo` 里树遍历出的最高码率 `.m3u8` |
| `WeChat Channels` | `https://weixin.qq.com/sph/*`、`https://channels.weixin.qq.com/*` | 仅元信息（`metadataOnly: true`） |

约束：

1. **只读**。`AdapterStore.upsert/remove/setEnabled` 对内置 id 短路；`AdapterCard` 隐藏开关、编辑、删除。
   内置项的状态若存在用户侧，下一次插件更新会静默丢掉，这个代价不能接受。
2. **被动**。它们只在用户点「用适配器解析」时运行；没有任何后台请求、没有 `@match` 自动触发。
3. **描述是文案键**。`meta.description` 存 `%adapter.builtin.sniffer%` 这类键，由卡片按当前语言渲染；
   默认语言仍是英文（见仓库 `AGENTS.md` 的多语言规则）。
4. **不猜容器**。嗅探器不声明 `ext`，`needsFfmpeg` 由地址本身决定（`.m3u8` → 需要合并）。

## 3. 代价与边界

- 0001 §8 的收益估计要下调：内置适配器覆盖的是「能取到地址」的长尾，不是全部长尾。
- 视频号仍然解析不出可播流，这一条登记为站点能力的 `client-only`，失败码 `site_client_only`，
  面板给的是「复刻元信息」而不是重试按钮。**不把它算作插件的解析成功**。
- 爱奇艺：地址能取到，分片请求仍被 P2P ticket 拒绝（`405 {"code":"D2102"}`），站点表保持
  `upstream-broken`。内置适配器把「取不到地址」和「取到也下不动」区分开了，但没有消除后者。
- 三个适配器都是页面侧 JS 源码，随宿主升级而重新注入；不做远程更新，也不读用户配置。

## 4. 验证

```bash
cd abilities/plugins/video-downloader
# 三个适配器在真实 DOM 里跑一遍（jsdom 夹具）
npx vitest run src/test/builtin-adapters.test.ts
# 视频号活链接：确认「页面里没有可播地址」这个结论仍然成立
NODE_PATH=$(npm root -g) node scripts/probe-sph.mjs "https://weixin.qq.com/sph/AfDHNPBu7M"
```

`probe-sph.mjs` 的 `verdict` 只回答「页面有没有暴露流地址」，不回答「插件能不能下载」——两者必须分开读。

2026-11-01 对 `https://weixin.qq.com/sph/AfDHNPBu7M` 的实测输出（Observed）：

```text
verdict      client-only
title        视频号
media found  0
qr hint      true
elapsed      33669 ms
```

页面 hydrate 后仍然没有发出任何媒体请求，`<body>` 里只有扫码提示。这条结论与 2.5.x 的取证一致。
