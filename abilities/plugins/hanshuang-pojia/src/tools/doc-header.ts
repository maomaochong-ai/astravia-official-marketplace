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

/** 截断必须可见：静默截断会让 agent 以为自己读到了全文。 */
export function truncationNote(budget: number, total: number): string {
	return `... [TRUNCATED at ${budget} chars of ${total} — call again with a larger maxChars for the rest]`;
}
