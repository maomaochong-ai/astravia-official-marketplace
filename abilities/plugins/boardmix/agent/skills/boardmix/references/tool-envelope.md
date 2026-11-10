# Tool envelope reference

Every tool returns **one JSON string**. Read it as data, then say one sentence about it — do not
paste raw JSON at the user.

## Shape

```json
{
  "ok": true,
  "open": true,
  "url": "https://boardmix.cn/app/",
  "origin": "https://boardmix.cn",
  "phase": "workspace",
  "seedLevel": 2,
  "landedAt": "2026-11-05T09:12:44.101Z",
  "next": "one sentence telling you what to do with this"
}
```

| Field | Means |
| --- | --- |
| `ok` | The call did what it says. It is **not** "the user got what they wanted" |
| `open` | The activity tab exists and holds a live webview |
| `url` | The address the tab actually shows after navigation |
| `origin` | `https://boardmix.cn`, or `""` when the address is unreadable |
| `phase` | `login` (`/user/login…`), `workspace` (`/app…`), or `unknown` |
| `seedLevel` | Which rung of the ladder produced `url` — see below |
| `landedAt` | When that navigation finished |
| `next` | The author's own instruction for the next turn. Follow it |

Rejections and partial failures keep the same frame and add a `reason`:

| `reason` | What happened | What to do |
| --- | --- | --- |
| `origin-not-allowed` | The address is a URL but not https + boardmix.cn | Ask for the real Boardmix link. Never rewrite someone else's URL into a boardmix one |
| `invalid-url` | Not parseable as a URL at all | Same — the input was not an address |
| `tab-not-ready` | The tab was asked for but no handle attached within 5 s | Ask the user to open the Boardmix tab from the tab bar, then retry |
| `invalid-kind` | `boardmix_ai` 收到了 `ppt` / `flowchart` / `chat` 之外的值 | 改参数 |
| `primitive-unavailable` | `gaps` 里列出的宿主能力缺失 | 整组页面/语义工具不可用；如实告诉用户，不要重试 |
| `not-mermaid` / `no-shapes` | `boardmix_diagram` 收到的不是那六类图，或只有类型声明 | 重写第一行，或补节点与连线 |
| `too-short` / `no-topic` / `no-shape` | `boardmix_ai_prompt` 的 prompt 缺要素 | 补齐「做什么 / 给谁 / 多长」再送 |
| `open-external-failed` | The OS refused to open a browser; carries `failure` | Give the user the address as text |

## The seed ladder

`boardmix_open` never jumps to a deep link it cannot vouch for. It tries three rungs and reports
which one held, in `seedLevel`:

| Level | Address | When it is used |
| --- | --- | --- |
| 1 | The last address that loaded successfully | A previous call already proved it works |
| 2 | `https://boardmix.cn/app/` | Normal case — the workspace shell |
| 3 | `https://boardmix.cn/` | Level 2 failed; the tab still gets a page |

The ladder only steps **down**, and only when the previous attempt failed on the main frame. A
navigation that the page itself aborted (`errorCode -3`) is not a failure — do not treat it as one.

## The other two envelopes

导航类工具用上面那个信封。另外两组返回的东西不一样，别混着读。

**页面类**（`boardmix_read` / `boardmix_act` / `boardmix_shot`）

| 字段 | 含义 |
| --- | --- |
| `items[{label,tag,role,x,y}]` | 人能看见、能点到的控件；`x,y` 是访客页视口 CSS 像素，可直接交给 `boardmix_act` |
| `login` | 当前地址是不是登录页 |
| `steps[{index,label,ok}]` / `stoppedAt` | 真实输入送到哪一步；`stoppedAt` 不为 null 就是那一步没送到 |
| `shot` / `previewed` | PNG 写在哪、预览器开没开；`previewed: false` 不是失败 |
| `gaps[]` | 宿主缺哪个能力（`execute-javascript` / `capture-page` / `send-input-event`）；非空时整组工具不可用 |

**语义类**（`boardmix_diagram` / `boardmix_ai_prompt`）

| 字段 | 含义 |
| --- | --- |
| `staged{path,kind,elements,overBudget}` | 源文件已经落在项目里的位置，以及它会吃掉多少元素 |
| `applied` | 粘到画布了没有（`boardmix_diagram`） |
| `delivered` | 写进 AI 输入框了没有（`boardmix_ai_prompt`）；`false` 不是“生成失败”，是“没送到” |
| `sent` | 点了发送没有；`false` 表示还等你或用户按 |
| `composer.reason` | `no-composer` 表示没找到输入框（页面未渲染完或改版），不要盲打 |

## What the tab reports, and what it does not

`boardmix_tab_status` is read-only and cheap. It answers exactly three questions: is the tab open,
which address does it show, is that address the login page.

It never answers: which board is open, whether the board has content, whether the user is a member of
anything, how many files they have left. Those live inside Boardmix and are not exposed to the plugin.

## `boardmix_open_in_browser`

This is the escape hatch, not the default. Two legitimate uses:

- the panel cannot render the page and the user should keep working elsewhere;
- the user needs a second account, which means a second browser profile.

It opens the **system** browser. Signing in there does **not** sign in the panel — say that out loud
when you use it, because users assume otherwise.
