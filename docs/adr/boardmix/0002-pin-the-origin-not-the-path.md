# 只钉 origin，不钉路径

- 状态：已采纳（2026-11-05）
- 相关：[0001](0001-the-web-product-is-a-plugin-tab-not-an-mcp.md)（载体）、[0003](0003-the-plugin-is-agent-operable.md)（工具导航共用同一闸门）
- 影响面：`boardmix-surface.tsx` 的 `src`、`domain/boardmix-entry.ts`、`services/entry-target.ts`、`storage` 的两条键

## 问题

第一版把入口写成常量 `https://boardmix.cn/app/recent-file`。如果这个地址变了，插件会不会直接打不开？

答案是**会**，而且是静默地打不开——连错误都不会报。所以要改的不是那个字符串，是"谁决定地址"。

## 事实：路径是客户端常量，服务端永远说 200

| 探测（Observed，2026-11-05） | 结果 |
| --- | --- |
| `https://boardmix.cn/app/recent-file` | 200 |
| `https://boardmix.cn/app/dashboard` | 200 |
| `https://boardmix.cn/app/not-a-real-xyz123` | **200** |
| `https://boardmix.cn/app` | 301 → `/app/` |
| `https://boardmix.cn/not-a-real-path-xyz123` | 404 |
| `https://boardmix.cn/login` | 404 |

`/app/*` 是 SPA catch-all：**任何** `/app/` 下的路径都返回同一份 HTML 壳。这意味着

1. HTTP 状态码无法用来判断某个路径是否还存在——探测不到改名；
2. `did-fail-load` 也不会因为路由被删而触发——壳照样 200、照样 load 完成。

再看路由从哪来（Observed，页面自身前端代码，2026-11-05）：

```js
e.RECENT_FILE = "/recent-file";  e.HOME = "/home";
e.STAR_FILE = "/star-file";      e.COMMUNITY_CENTER = "/community-center";
e.AI_CHAT = "/ai/chat";          e.AI_PPT = "/ai/ppt";
...
{ path: "recent-file", name: an.RECENT_FILE, component: () => import("./BoardContent-LbFGrppN.js") }
```

路径是**随前端代码一起发布的常量**，改了不通知任何人，也不产生任何服务端信号。结论：这条路线上我们能
拿到的唯一稳定契约是 **origin**，路径不是契约。

顺带修正一个此前写错的结论：登录入口不是 `/login`（实测 404），而是

```js
USER_LOGIN: "/user/login/?response_type=code&product=board&current_type=dialog"
```

即 `/user/login/`。早先"落在 `/login`、`/signin` 视为未登录"的判断按 404 事实作废。

## 决定

**写死的只有一个结构性常量：SPA 挂载点 `https://boardmix.cn/app/`。** 其余地址一律运行时确定，并把
"真实落地地址"持久化，下次优先用它。

### 三级种子阶梯

| 级 | 候选 | 为什么在这一级 | 失效条件 |
| --- | --- | --- | --- |
| 1 | `storage.lastGoodUrl` | 上次真实落地地址，可能已被用户自己导航到某块白板 | 首启为空；上游删了该路径 |
| 2 | `https://boardmix.cn/app/` | SPA 挂载点，页面所有资源都挂在 `/app/` 下，比任何子路由都稳 | 挂载点搬迁（产品级重构） |
| 3 | `https://boardmix.cn/` | 站点根，至少能登录、能进产品 | 域名变更 |

任一级成功落地后，把 **`did-navigate` 报的最终 URL**（不是我们请求的 URL）写回 `lastGoodUrl`。上游把
`/recent-file` 改名后，第 1 级命中旧路径会失败，第 2 级进到 SPA 根，产品自己的默认路由把用户送到新的
"最近文件"，下一次写回的就已经是新地址——**一次点击的代价，不是一次发版的代价**。

### 为什么默认种子是 SPA 根，不是深链

深链听起来更贴心，但它把"这个路径存在"变成了启动前提。用 `/app/` 则完全不猜：产品的默认落地页就是它
自己想让人看到的页；即便默认页不是"最近文件"，也只差一次点击，而且这个偏好会在用户第一次手动导航后
被记住。

代价与收益对得上：少写一个字符串，换掉一整类"某天突然白屏"。

### 不解析路径语义

`lastGoodUrl` 当作**不透明字符串**存，不拆出 pathname 做匹配、不维护路由白名单。维护白名单等于把前端
常量抄一份进插件，抄的那份只会在上游改版后变成误判源。

## 失效怎么发现

catch-all 让"删路由"静默，所以检测不靠错误码，靠三个信号：

| 信号 | 判据 | 动作 |
| --- | --- | --- |
| 加载失败 | `did-fail-load` 且 `isMainFrame` 且 `errorCode !== -3`（ABORTED 是正常重定向） | 降一级重试 |
| 落地 URL 与请求的深链相同、但页面无内容 | 只能在用户侧观察到 | 显示重试按钮，不自动循环 |
| 三级都失败 | 阶梯耗尽 | 显示"在浏览器打开"逃生口 |

**不做自动无限重试**：三级各试一次就停。远程页面加载失败时无限重试只会烧 CPU，并让用户看不到可以按的
按钮。

## 闸门：一处实现，两个调用方

`services/entry-target.ts` 的 `resolveEntryTarget()` 是唯一校验点，UI 首次导航与
`boardmix_goto` 工具（0003）共用：

- 只接受 `https:` 且 host 为 `boardmix.cn` 或其子域。
- 拒绝 `http:`、`javascript:`、`data:`、`file:`、`blob:`。

两份实现迟早分叉，而分叉的那一半恰好是接受模型输入的那一半。

## `lastGoodUrl` 的安全边界

存进去之前校验 `https:` 且 host 在允许集合内，防篡改存储把 webview 导向别处。

**但这条校验只用于"要不要落库"，不用于拦截导航。** boardmix 的 SSO 会跳第三方（页内
`/user/login/sso/board/huawei/` 这类路径，以及 `cas-client-bosyun.www.js`），一键把登录流程掐断的代价
远大于存储被投毒的风险——后者最多影响下一次启动的起始页，前者让用户根本登不进来。

## 人工覆盖

`storage` 里另开 `entryUrlOverride`，优先于整个阶梯。用途是上游改动后能不经过一次市场发版就恢复可用：
用户在插件设置或 README 里写一条新地址即可。README 给的是修改方法，不是某个具体 URL——文档写死一个
地址，等于把同一个问题搬进文档。

## 已知路由快照（只作参考，不作判据）

上面那组路径常量与登录入口 `/user/login/`，记录的用途是**排查时知道该看一眼哪里**，不是用来判定
"当前 URL 合不合法"。它们随上游发版变化，写进判定逻辑就是下一个故障点。

## 残留风险

- 上游若把 `/app/` 换掉（整体搬到别的挂载点或换域名），三级阶梯全废。这已不是路径改名，是产品迁移；
  只能靠 `entryUrlOverride` 加一次发版处理。接受。
- 用户在内置 webview 里自己导航到任何页面都属正常，壳不纠正、不重写 URL。壳只在"首次进入"和"上一级
  失败"时决定地址。

## 不做的事

- 不写死 `/app/recent-file`，也不写死其它子路由。
- 不用 HTTP 探测"验证路径存在"——catch-all 让它恒真，探测结论没有信息量。
- 不维护前端路由白名单做合法性判定。
- 不在启动时并发探测多个地址：会把登录态与分区搞乱，也拿不到额外信息。
