# 模块：知识库与检索

292 篇随包文档 + 42 项工具判定 + 战术清单 + payload 种子。它是**先查再造**的那一层：
遇到信号先检索，别从零手写脚本。

## 能做什么

| 工具 | 用途 |
| --- | --- |
| `search_docs` | 按关键词搜标题 / id / 主题，返回 id + 位置 + 大小 |
| `read_doc` | 按 id 读全文，截断会明说截在哪 |
| `kb_checklist` | 六类战术清单：`web_first_30_min` / `attack_matrix` / `evidence` / `pe_ioc` / `pe_persistence` / `yara_rules` |
| `kb_payloads` | 漏洞类 payload 种子：`reflection` / `sqli` / `nosqli` / `ssrf` / `traversal` / `jwt` / `headers` |

另有三个机器可读附件，检索它们比全文搜快：

- `kb/<collection>/techniques/kb-index.json` — 信号 → 技术文件的映射（`frida`、`aes`、`license check` …）
- `kit-docs/tool-index.json` — 42 项工具 + 本插件对每项的处理（探测 / 建议 / 不做）
- `cases/` 下的先例包 —— 走 `search_cases`，不走 `search_docs`

## 代码入口

- `src/content/docs/` — 随包正文（`kb/`、`kit-docs/`、`cases/`、`manual/`）；`scripts/sync-docs.mjs` 建索引。
- `src/domain/knowledge/` — 检索与排序；`src/features/workbench/services/docs.ts` 是运行期读取入口。
- `src/features/workbench/services/health.ts` 的 `docs.*` 项会报索引条数与总量，用来发现「索引建了但没内容」。

## 使用要点

- **先查 `kb-index.json`，再全文搜**：信号已知时它是直达的；只有不知道叫什么才全文搜。
- `search_docs` 匹配的是标题 / id / 主题，**不搜正文**。关键词只活在正文里时，换成该文档标题里的词再搜。
- 手册随 SDK 装：`npx astravia-plugin-cli docs` 给出插件实际编译版本的合同，**不要硬编码 `node_modules` 路径**。
- 知识库是从上游 1:1 移植的（292 篇，SHA-256 集合 diff 为 0，见 [`../audits/capability-gap-2.13.1.md`](../../audits/capability-gap-2.13.1.md) §3.4）。感觉「应该有的文章没有」时先确认是移植缺失还是上游本来没有。

## 失败怎么读

| 现象 | 含义 | 下一步 |
| --- | --- | --- |
| `read_doc` 说被截断 | 正文长于 `maxChars` | 真的需要后半段再读一次，别默认读完 |
| `kb_checklist` 返回菜单 | `checklist_type` 拼错 | 从六个里挑；未知类型不会静默替换 |
| 检索不到 | 关键词只在正文里 | 换标题词，或直接读 `kb-index.json` |

## 相关文档与测试

- 测试：`src/test/knowledge/{docs,skill-library}.test.ts、src/test/tools/{tool-index}.test.ts`
- 事实表：[`../reference/toolchain-parity.md`](../../reference/toolchain-parity.md)
- 生成脚本：`scripts/sync-docs.mjs`、`scripts/sync-skill-library.mjs`
