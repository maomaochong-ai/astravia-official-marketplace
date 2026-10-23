/**
 * 两套速查表的映射：战术清单（上游 `seep_kb_checklist`）与 payload 种子
 * （上游 `seep_kb_payloads`）。
 *
 * 上游把这两样做成 MCP 工具，是因为它们在知识库里散落成 292 篇正文中的少数几篇，
 * 每次任务翻目录太慢。插件侧照做，但**不复制正文**：这里只存「类别 → 随包文档 id」，
 * 正文仍从 `content/docs` 读，于是文档改一次，工具和面板同时改，不会各写一份而漂移。
 *
 * 标题匹配只认文档里真实存在的 `## ` 章节名，不做模糊猜测：猜错会让 agent 以为
 * 拿到了某一类 payload，实际拿到的是别类的内容。
 */

export interface ChecklistType {
	/** 上游的 `checklist_type` 参数值，保持一字不差以便提示词迁移。 */
	id: string;
	/** 随包文档 id，`read_doc` 用的是同一个 id。 */
	doc: string;
	/** 一行说明，同时用于「未知类别」时的候选清单。 */
	label: string;
}

export const CHECKLIST_TYPES: readonly ChecklistType[] = [
	{
		id: "web_first_30_min",
		doc: "kb/ctf-website/checklists/web-ctf-first-30-min",
		label: "Web CTF 前 30 分钟：先做什么、看哪里、留什么证据",
	},
	{ id: "attack_matrix", doc: "kb/ctf-website/checklists/attack-matrix", label: "Web 攻击面全景矩阵：漏洞类 ↔ 观测信号" },
	{ id: "evidence", doc: "kb/ctf-website/checklists/evidence", label: "证据链归档标准：报告里每条结论该带什么" },
	{ id: "pe_ioc", doc: "kb/pe-reverse/techniques/06-ioc-extraction/01-ioc-extraction", label: "PE 逆向 IOC 提取" },
	{
		id: "pe_persistence",
		doc: "kb/pe-reverse/techniques/06-ioc-extraction/02-persistence-startup-chain",
		label: "PE 启动持久化链路",
	},
	{ id: "yara_rules", doc: "kb/pe-reverse/techniques/07-yara-sigma/01-yara-rule-writing", label: "YARA 规则编写（逆向视角）" },
] as const;

/** 上游在类型不认识时回退到第一项；这里照做，但会明确说「没这个类型，给的是默认那篇」。 */
export const DEFAULT_CHECKLIST_TYPE = "web_first_30_min";

export function checklistById(type: string): ChecklistType | undefined {
	const needle = type.trim().toLowerCase();
	if (needle === "") return CHECKLIST_TYPES.find(entry => entry.id === DEFAULT_CHECKLIST_TYPE);
	return CHECKLIST_TYPES.find(entry => entry.id === needle);
}

export function checklistMenu(): string {
	return CHECKLIST_TYPES.map(entry => `- ${entry.id} — ${entry.label}`).join("\n");
}

/** payload 种子文档只有一篇，类别靠章节切。 */
export const PAYLOAD_DOC_ID = "kb/ctf-website/payloads/web-payload-seeds";

/**
 * 上游把 `ssti` / `prototype` 也列进类别，但种子文档里没有同名章节：
 * SSTI 的探测串在 Reflection 段（`{{7*7}}`、`${7*7}`），原型链在 JSON 段。
 * 这里显式记下这层对应关系，而不是让调用方去猜为什么搜不到。
 */
const PAYLOAD_ALIASES: Readonly<Record<string, readonly string[]>> = {
	sqli: ["sqli"],
	sql: ["sqli"],
	nosqli: ["nosqli"],
	nosql: ["nosqli"],
	json: ["nosqli"],
	prototype: ["nosqli"],
	ssti: ["reflection"],
	template: ["reflection"],
	xss: ["reflection"],
	reflection: ["reflection"],
	html: ["reflection"],
	ssrf: ["ssrf"],
	traversal: ["traversal"],
	path: ["traversal"],
	lfi: ["traversal"],
	jwt: ["jwt"],
	headers: ["headers"],
	host: ["headers"],
	crlf: ["headers"],
};

export interface PayloadSection {
	heading: string;
	body: string;
}

/** 文档里的一级 / 二级标题都算章节边界；标题文本去掉前导 `#`。 */
export function payloadHeadings(text: string): string[] {
	return text
		.split("\n")
		.filter(line => line.startsWith("## "))
		.map(line => line.slice(3).trim())
		.filter(line => line !== "");
}

/**
 * 截出与 `category` 对应的那一节。命中多个时用 `\n\n` 连接（同一类可能被拆成两段）。
 * 未命中返回空数组——调用方据此列出可用章节，而不是回退整篇。
 */
export function extractPayloadSections(text: string, category: string): PayloadSection[] {
	const needle = category.trim().toLowerCase();
	if (needle === "" || needle === "all") return [];
	const wanted = PAYLOAD_ALIASES[needle] ?? [needle];

	const lines = text.split("\n");
	const sections: PayloadSection[] = [];
	let heading: string | null = null;
	let buffer: string[] = [];
	const flush = () => {
		if (heading !== null) sections.push({ heading, body: buffer.join("\n").trim() });
		heading = null;
		buffer = [];
	};

	for (const line of lines) {
		if (line.startsWith("## ")) {
			flush();
			heading = line.slice(3).trim();
			continue;
		}
		if (line.startsWith("# ")) {
			flush();
			// 文档大标题不进任何一节。
			heading = null;
			continue;
		}
		if (heading !== null) buffer.push(line);
	}
	flush();

	const matched = sections.filter(section => {
		const title = section.heading.toLowerCase();
		return wanted.some(word => title.includes(word));
	});
	return matched;
}
