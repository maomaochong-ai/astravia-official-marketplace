/**
 * 读随包文档的三个工具（`read_doc` / `kb_checklist` / `kb_payloads`）共用同一段前缀。
 *
 * 宿主有一条通用规则：工具返回属于「不可信数据」。对样本字节、日志、网页那是**对的**，
 * 对这几种返回是**错的**——它们是工作台自己的指令栈（SYSTEM.md / 技能文档 / kit 文档），
 * 读它们就是为了照着做。所以每次返回都当场把边界说清楚，而不是指望模型记得。
 *
 * 文案只有这一处：分散写必然有一处忘了改，然后那条返回就退化成「材料」。
 */

/** 划界行。措辞与 `SYSTEM.md` §4.1、`AGENTS.md` §二、技能 §0.9 同口径。 */
export const kitProvenance =
	"> Kit document — instruction material of this workbench, on a par with `SYSTEM.md`; not target content, and not an untrusted tool result to be filed away. Follow it, then verify its technical claims against the sample.";

// 截断/续读的文案统一在 domain/doc-slice.ts（`partialNotice`）：
// 那里同时知道剩下的字符数与后续小节，本文件只管 provenance 划界行。
