/**
 * Mermaid 是这一页唯一被证实的「文本 → 原生图形」通道。
 *
 * 这里不渲染、不转换，只做三件可测的事：判断这段文本值不值得交给产品、估算它会吃掉多少
 * 元素额度、以及决定文件叫什么。渲染归 Boardmix，核对归截图。
 */

/** 产品文案里列出的六类：流程图、时序图、ER、类图、饼图、象限图。 */
export const MERMAID_KINDS = ["flowchart", "graph", "sequenceDiagram", "erDiagram", "classDiagram", "pie", "quadrantChart"] as const;

export type MermaidKind = (typeof MERMAID_KINDS)[number];

export interface DiagramPlan {
	/** 第一行类型，用来告诉用户「这会生成什么」。 */
	kind: MermaidKind;
	/** 估算的元素数：节点 + 连线，用来对照账户额度。 */
	elements: number;
	/** 落盘文件名（不含目录），由标题或类型推出来。 */
	fileName: string;
	/** 该不该交给产品：空图、纯文字、类型不支持都不该。 */
	accepted: boolean;
	/** 拒绝的原因，`accepted` 为真时是 null。 */
	reason: string | null;
}

const LANGUAGE_TAG = /^```(?:mermaid|mmd)?\s*$/i;

function firstSignificantLine(text: string): string {
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith("%%")) continue; // mermaid comment
		return line;
	}
	return "";
}

/** 去掉 markdown 围栏，保留图本体。用户从对话里复制过来的东西通常带围栏。 */
export function stripFence(text: string): string {
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	const start = lines.findIndex(line => LANGUAGE_TAG.test(line.trim()));
	if (start < 0) return text.trim();
	const end = lines.findIndex((line, index) => index > start && line.trim() === "```");
	const body = lines.slice(start + 1, end < 0 ? undefined : end);
	return body.join("\n").trim();
}

export function kindOf(text: string): MermaidKind | null {
	const head = firstSignificantLine(text);
	if (!head) return null;
	const token = head.split(/[\s;{]/)[0];
	return (MERMAID_KINDS as readonly string[]).includes(token) ? (token as MermaidKind) : null;
}

/** 连线的方向记号：flowchart / graph / 时序 / ER / 类图各有各的写法。 */
const EDGE_SOURCE = "-->>|-->|---|==>|=>|->>|--x|--\\)|<\\|--|\\*--|o--|\\.\\.>|\\.\\.\\|>|<\\.\\.";
const EDGE = new RegExp(EDGE_SOURCE);
/** 数箭头要带 `g`：不带 g 的 `match` 只返回第一个，`A-->B-->C` 会被数成一条线。 */
const EDGE_ALL = new RegExp(EDGE_SOURCE, "g");

/**
 * 节点与连线的粗估。宁可高估：说「这张图大约 42 个元素」的人不会被额度打脸，
 * 说「差不多十个」然后吃满 150 的才会。
 */
export function countElements(text: string): number {
	// 同一个 id 只算一个元素：`Animal <|-- Duck` 里的 Animal 与上一行的 `class Animal` 是同一个。
	const nodes = new Set<string>();
	let anonymous = 0;
	let edges = 0;
	let inClassBody = false;

	const addNode = (token: string) => {
		if (!token) return;
		// `A[开始]` 的身份是 A；包围起来的文本只是标签。
		const id = /^[\w\u4e00-\u9fff]+/.exec(token)?.[0] ?? "";
		if (id) nodes.add(id);
		else anonymous += 1;
	};

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("%%")) continue;

		if (inClassBody) {
			if (line === "}") inClassBody = false;
			continue; // 类成员不是画布上的元素
		}

		// classDiagram：`class A {` 既是节点声明，也开启成员区。
		const declared = /^class\s+([\w\u4e00-\u9fff]+)/.exec(line);
		if (declared) {
			nodes.add(declared[1]);
			if (line.endsWith("{")) inClassBody = true;
			continue;
		}

		// 一串 `A-->B-->C` 是两条连线，按箭头个数数，不按行数。
  		const arrows = (line.match(EDGE_ALL) ?? []).length;
		if (arrows > 0) {
			edges += arrows;
			for (const end of line.split(EDGE)) addNode(end.trim().split(/[\s|]/)[0] ?? "");
			continue;
		}

		// 声明式节点：A[文本]、A{文本}、A(文本)、A((文本))
		const boxes = line.match(/\b[\w\u4e00-\u9fff]+\s*[[({>]/g) ?? [];
		if (boxes.length > 0) {
			for (const box of boxes) addNode(box.trim());
			continue;
		}

		// 时序图的参与者、状态图的裸状态
		const participant = /^(?:participant|actor|state)\s+([\w\u4e00-\u9fff]+)/.exec(line);
		if (participant) {
			nodes.add(participant[1]);
			continue;
		}
		const keyed = /^([\w\u4e00-\u9fff]+)\s*:/.exec(line);
		if (keyed) nodes.add(keyed[1]);
	}

	return nodes.size + anonymous + edges;
}

function slug(value: string): string {
	const cleaned = value
		.trim()
		.toLowerCase()
		.replace(/[^\w\u4e00-\u9fff-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return cleaned || "diagram";
}

/** 用户给的名字优先，其次 Mermaid 里的第一行标题，最后一律 `board`。 */
export function fileNameFor(text: string, title?: string): string {
	const heading = /^\s*%%\s*title:\s*(.+)$/im.exec(text)?.[1];
	const base = title?.trim() || heading?.trim() || "board";
	return `${slug(base)}.mmd`;
}

/**
 * 一次判断：这段文本能不能交给产品，交给它大概要花多少元素。
 *
 * `accepted: false` 时 `reason` 是给模型看的一句话，不是给人看的错误码堆。
 */
export function planDiagram(input: { text?: unknown; title?: unknown; limit?: unknown }): DiagramPlan {
	const raw = typeof input.text === "string" ? input.text : "";
	const body = stripFence(raw);
	const limit = typeof input.limit === "number" && Number.isFinite(input.limit) ? Math.max(1, Math.round(input.limit)) : 150;
	const empty: DiagramPlan = { kind: "graph", elements: 0, fileName: "board.mmd", accepted: false, reason: "empty" };

	if (!body) return { ...empty, reason: "text-required" };

	const kind = kindOf(body);
	if (!kind) {
		return {
			...empty,
			fileName: fileNameFor(body, typeof input.title === "string" ? input.title : undefined),
			reason: "not-mermaid: 第一行必须是这六类之一（flowchart / graph / sequenceDiagram / erDiagram / classDiagram / pie / quadrantChart）",
		};
	}

	const elements = countElements(body);
	if (elements === 0) {
		return {
			...empty,
			kind,
			fileName: fileNameFor(body, typeof input.title === "string" ? input.title : undefined),
			reason: "no-shapes: 只有类型声明，没有节点或连线",
		};
	}

	const fileName = fileNameFor(body, typeof input.title === "string" ? input.title : undefined);
	if (elements > limit) {
		// 超额度不是拒绝，是提前说清楚：用户可以选择砍内容，也可以选择升级。
		return { kind, elements, fileName, accepted: true, reason: `over-budget: 约 ${elements} 个元素，超过这次给的 ${limit}` };
	}

	return { kind, elements, fileName, accepted: true, reason: null };
}
