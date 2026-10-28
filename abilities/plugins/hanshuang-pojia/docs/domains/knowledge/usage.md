# 知识库与检索 · 怎么用

292 篇随包文档 + 42 项工具判定 + 战术清单 + payload 种子。这一域的性质是**先查再造**：
遇到一个信号，先看有没有人写过这条路，别从零手写脚本。

开发侧地图见 [dev.md](dev.md)。

## 一句话触发

```text
Frida 怎么绕 SSL pinning？
证书固定绕过有没有现成做法
给我 web 渗透的前 30 分钟清单
SSRF 的测试 payload 有哪些
Kerberos 相关的打法在哪一篇
```

## 四种检索入口

| 入口 | 适合 | 注意 |
| --- | --- | --- |
| 信号索引 `kb-index.json` | 已知信号（`frida`、`aes`、`license check`、`ollvm`） | 最快；信号 → 技术文件直达 |
| `search_docs` | 不知道叫什么，只知道大概主题 | 只匹配**标题 / id / 主题**，不搜正文 |
| `kb_checklist` | 已有明确阶段，要流程 | 六类：`web_first_30_min` / `attack_matrix` / `evidence` / `pe_ioc` / `pe_persistence` / `yara_rules` |
| `kb_payloads` | 要输入种子 | 七类：`reflection` / `sqli` / `nosqli` / `ssrf` / `traversal` / `jwt` / `headers` |

先例包**不走这里**：它们由 `search_cases` 管（[案卷域](../cases/usage.md)），因为先例要带进度与工具清单。

## 分寸

- **查一次就够**：拿到技术文件的「工具映射」表就停手，直接开始做。
- **值得多查一轮**：第一次检索命中的是总纲而不是具体技术（例如只拿到某本手册的目录页）——
  换成该文里出现的技术名词再搜一次。
- **不要做的事**：把知识库当权威结论引用。它是**方法库**，样本上的结论只能来自你自己跑出来的观察。
  文档里写的偏移、常量、版本都属于写那天的观察。

## 面板对应页

「文档」页按集合浏览（知识库 / 工具文档 / 案例 / 手册），支持搜索与按需加载正文；
「自检」页的 `assets.docs` 会报索引条数与总字节数——数字掉下来通常意味着同步脚本没跑。

## 常见坑

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| 搜不到，但你确定应该有 | 关键词只在正文里 | 用标题里的词，或直接读信号索引 |
| `read_doc` 说被截断 | 正文长于预算 | 只有真需要后半段再读一次，别默认读完 |
| `kb_checklist` 返回菜单 | `checklist_type` 写错 | 从六个里挑；未知类型不会静默替换成别的东西 |
| 面板文档页空白 | 索引没建或版本旧 | 看自检页 `assets.docs`；同步脚本是 `scripts/sync-docs.mjs` |

## 相关的其他域

- 工具判定（探测 / 建议 / 不做）的权威表：[工具链域](../toolchain-and-limits/usage.md) +
  [`reference/toolchain-parity.md`](../../reference/toolchain-parity.md)。
- 提问模板（lab 前缀、占位符规则）：[`reference/prompt-templates.md`](../../reference/prompt-templates.md)。
