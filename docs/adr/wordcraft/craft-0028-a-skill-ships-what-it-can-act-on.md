# craft-0028 — 技能只带它能用上的东西

- **Status:** Accepted
- **Date:** 2026-11-09
- **Context:** craft 系列 0.0.27
- **Related:** [0024](craft-0024-the-agent-stays-in-the-frame.md) — web 构建没有控制服务、MCP 与 CLI、
  [0012](craft-0012-the-site-is-upstreams-release-bundle.md) — 站点是上游的字节

## The situation

四支插件的技能包里躺着上游整个文档树的副本：photocraft 40 篇、filmcraft 26 篇、pdfcraft 26 篇、
vectorcraft 29 篇。vectorcraft 一个包 2.4 MB，`target-app-parity.md` 单篇 737 KB。

SKILL.md 对它们的说明只有一句——"`references/` 里同目录还有上游文档的平铺副本，文件名就是主题
（控制协议、性能、文件格式、路线图……），按任务去读那几篇"。这句话把判断推给了模型，而模型看不到目录，
只能凭猜测报一个文件名。

三件事让这批副本从"备查"变成"僵尸"：

1. **跟着 pin 一起过期。** 副本是 0.19.0 时代拷的，pin 已经到 0.22.0：`automation/cli.md` 7337 字节，
   上游同版 8390 字节。技能却说"以它为准"。
2. **教模型调不存在的接口。** `automation/control-protocol.md`、`automation/mcp.md`、`automation/cli.md`、
   `control-protocol.md`、`mcp.md`、`cli-batch.md`、`plugins.md` 描述的是原生应用、CLI、MCP 与 WASM 插件 ABI——
   [0024](craft-0024-the-agent-stays-in-the-frame.md) 已经钉死这个面板里没有它们。模型读完会去试一套不存在的入口。
3. **讲的是维护上游仓库，不是用这个编辑器。** 构建、测试、发布、架构分层、路线图、一致性报告、迁移计划、
   `AGENTS.md`——这些问题的答案在 Astravia 里没有用处。

## The decision

**技能包只装"在面板里做得到的事"的说明。**

留下的三类：

| 类别 | 例子 | 为什么留 |
| --- | --- | --- |
| 命令表 | `references/upstream.md` | SKILL.md 明确的判据来源：有没有这个功能、它叫什么、配了什么键 |
| 格式说明 | `formats/psd-psb.md`、`formats/pcraft.md`… | 回答"这个格式能不能开、有什么限制" |
| 功能说明与用户文档 | `captions.md`、`editing-existing-text.md`、`dimensions.md`；designcraft/effectcraft/lightcraft 的 `getting-started/` `guides/` `faq/` `troubleshooting/` | 回答"这个功能怎么用、它怎么表现" |

删掉的两类：维护上游仓库的文档（构建/测试/发布/架构/路线图/parity/迁移计划/AGENTS.md），
以及描述不可达传输的文档（control-protocol、mcp、cli、cli-batch、plugins）。共 83 个文件；
三支插件的包从 1–2.4 MB 降到 126/75/86 KB。

**指向必须是具体的。** SKILL.md 要逐个点名保留的文件，或点名一个会链到全部页面的索引页
（`references/index.md`）；"里面还有一堆，按主题挑吧"不算指向——那正是这批文件变成僵尸的方式。

## 守住它的方式

`tests/craft-skills.test.mjs` 五条，对十五支插件逐支跑：

1. 不许指向包里没有的文件；
2. 包里的每一篇都必须能从 `SKILL.md` 走到（链接与 `references/…` 行内路径都算指向）；
3. 上游维护类文档不许回潮（按文件名）；
4. 不可达传输的文档不许回潮；
5. 单个技能包 ≤ 300 KB。

删一个文件不会让任何一条变红，删**有用**的会（第 2 条），重新拷一份上游文档树也会（第 3、5 条）。

## What this does not do

- **它不说上游文档没用。** 想知道"PSD 解码怎么实现"仍然可以读 GitHub；副本里那些仓库内相对链接
  改成了绝对 URL，句子没变，指向变准了。
- **它不动用户文档树。** designcraft / effectcraft / lightcraft 的 `references/` 是回答用户问题的
  手册，有目录页，SKILL.md 用表格点名四类目录——那是"能用上"的一类。lightcraft 的目录页原先漏链了
  三个章节索引，顺手补上了。
- **它不代表 `upstream.md` 是最新的。** 那张表还是 0.19 时代的导出，与 pin 一起待更新；
  这是下一件事，不是这一条。

## The cost

- 模型问"上游为什么不支持 X"时，包里没有路线图可引——它只能如实说不知道，或让用户去 GitHub 看。
- 删掉的是已发布的字节：包变小了，但 0.0.27 之前的版本仍然带着它们，对比两份包会看到差异。
  这些文件都在 git 里，`git checkout -- <path>` 就能拿回来。
