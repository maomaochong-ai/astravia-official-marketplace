/**
 * 把宿主对话压成"关键点"，不是抄一遍（纯函数）。
 *
 * 面板不画对话正文这条规则仍然成立：宿主聊天区有更好的正文（markdown、可复制、可回滚）。
 * 但"一句话都不留"是另一个极端——读者翻面板时看不到这一轮在说什么，只能回聊天区找。
 * 所以这里做的是**摘要**：
 *
 *  - **用户的诉求**压成一行（去掉换行、代码围栏、多余空白，超长截断）；
 *  - **agent 的答复**只取"带结论的行"：小标题、列表项、含主机/路径/命令/严重级/编号的行；
 *    纯过渡句（"好的""接下来"）与寒暄一律丢掉；
 *  - 每轮有硬上限（用户 1 行、agent 最多 6 行），每行有长度上限；
 *  - 与上一条完全相同的行不再重复（同一个结论被反复说时只留第一次）。
 *
 * 这些规则是数据，不是渲染细节：`test/conversation-digest.test.ts` 直接测它们。
 */

/** 一行最多这么多字符；超出用省略号收尾（读者需要的是要点，不是全文）。 */
const LINE_LIMIT = 140;
/** 用户诉求那一行更短：它的作用是"我记得这轮在干什么"。 */
const ASK_LIMIT = 96;
/** 每轮最多留几条 agent 结论。 */
const MAX_POINTS = 6;

/**
 * 寒暄与过渡：它们占的是篇幅，不是信息。
 *
 * 英文前缀要 `\b`（`ok` 不能匹到 `okta`），中文前缀不要——`\b` 在 CJK 与标点之间不成立，
 * 带上的话“好的，收到。”这种整句会被当成正文。
 */
const FILLER = /^(?:好的|收到|明白|了解|当然|可以|没问题|下面|接下来|首先|然后|最后|总之|综上)|^(?:in short|sure|okay|ok|great|thanks|certainly|let me|now,? let|next,?|first,?|finally,?)\b/i;

/** 带结论的行：这些标记出现时，一行值得留。 */
const SIGNAL = [
	/https?:\/\//i,
	/\b\d{1,3}(?:\.\d{1,3}){3}\b/,
	/\b(?:CVE-\d{4}-\d+|CVSS|critical|high|medium|low|严重|高危|中危|低危)\b/i,
	/\b(?:found|found that|confirmed|exploitable|verified|failed|blocked|发现|确认|验证|复现|失败|受阻)\b/i,
	/(?:^|\s)(?:\/[\w.@-]+){2,}/,
	/\b(?:nmap|curl|ffuf|nuclei|sqlmap|hydra|python3?|node|docker|git|ssh|kubectl)\b/i,
	/[：:]\s*\S/,
];

/** 去掉 markdown 装饰，留给人读的字符。 */
function plain(line: string): string {
	return line
		.replace(/^[\s>]+/, "")
		.replace(/^#{1,6}\s*/, "")
		.replace(/^[-*+]\s+/, "")
		.replace(/^\d+[.)]\s+/, "")
		.replace(/`{1,3}/g, "")
		.replace(/\*\*/g, "")
		.replace(/^\|.*\|$/, (row) => row.replace(/\|/g, " ").trim())
		.replace(/\s+/g, " ")
		.trim();
}

function clip(text: string, limit: number): string {
	if (text.length <= limit) return text;
	// 在标点或空格处断开：截在半个词里读起来像 bug。
	const cut = text.slice(0, limit);
	const boundary = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("."), cut.lastIndexOf("，"), cut.lastIndexOf(" "));
	return `${(boundary > limit * 0.6 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

/** 用户的诉求：一行，去围栏、去换行。空内容返回 undefined。 */
export function digestAsk(text: string): string | undefined {
	const body = text
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return body ? clip(body, ASK_LIMIT) : undefined;
}

/**
 * agent 答复里的关键行。
 *
 * 没有一行命中信号时退回"前两行非空文字"——一句 20 字的回答也该在面板上留个痕迹，
 * 否则用户会以为面板把这一轮丢掉了。
 */
export function digestAnswer(text: string): string[] {
	if (!text) return [];
	// 先把寒暄与过渡剔掉：它们不是信息，也不该在“没有信息”的时候被当作退路。
	const lines = text
		.split(/\r?\n/)
		.map(plain)
		.filter((line) => line.length >= 4 && !FILLER.test(line));
	if (lines.length === 0) return [];

	const points: string[] = [];
	const seen = new Set<string>();
	for (const line of lines) {
		if (points.length >= MAX_POINTS) break;
		if (line.length < 8 && !/[：:]/.test(line)) continue;
		if (!SIGNAL.some((pattern) => pattern.test(line))) continue;
		const next = clip(line, LINE_LIMIT);
		if (seen.has(next)) continue;
		seen.add(next);
		points.push(next);
	}
	if (points.length > 0) return points;

	return lines.slice(0, 2).map((line) => clip(line, LINE_LIMIT));
}

/**
 * 一条答复是否值得在面板上出现。
 *
 * 纯确认（"好的，继续"）既不进面板也不报错——它没有信息量，画出来只是噪声。
 */
export function hasDigest(answer: string): boolean {
	return digestAnswer(answer).length > 0;
}
