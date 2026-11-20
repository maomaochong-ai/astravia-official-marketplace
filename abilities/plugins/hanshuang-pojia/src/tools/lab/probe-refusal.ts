import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import {
	maskSecret,
	probesFor,
	PROBE_STATE_PATH,
	renderTable,
	summarise,
	toRecord,
	toResult,
	type ProbeLang,
	type ProbeApiStyle,
	type ProbeRecord,
	type ProbeResult,
	type ProbeSummary,
} from "../../domain/refusal-probe";

interface ProbeRefusalInput {
	/** OpenAI 兼容的 base，例如 `https://api.example.com/v1`。不写 `/chat/completions`。 */
	baseUrl?: string;
	model?: string;
	/** 只发到第几档；缺省四档全发。 */
	level?: number;
	lang?: ProbeLang;
	/** 自定义提示词：给了就只发这一条，跳过梯度。 */
	prompt?: string;
	/** 密钥：从调用方传入，输出里一律打码。 */
	apiKey?: string;
	/** 认证头名，缺省 Authorization；有的中转用 x-api-key。 */
	authHeader?: string;
	/**
	 * 请求风格：openai → POST /chat/completions；anthropic → POST /v1/messages。
	 * 中转多数是前者，但直连 Anthropic 兼容端点时路径与认证头都不一样。
	 */
	apiStyle?: ProbeApiStyle;
	/** 自定义梯度：多个提示词，一行一档。给了就替代标准四档。 */
	gradient?: string[];
}

const TIMEOUT_MS = 60_000;
const DEFAULT_HEADER = "Authorization";

/**
 * 从三种响应形状里取正文（与上游 `extract_text` 对齐）。
 *
 * 关键一条：推理模型有时把内容全放在 `reasoning_content` 里，`content` 是空串。
 * 只看 `content` 会把这类正常回答判成「空正文」—— 那是把模型正常干活读成链路故障。
 */
function extractText(payload: unknown): { text: string; finishReason: string | null } {
	const data = payload as {
		choices?: {
			message?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null };
			finish_reason?: string;
		}[];
		content?: { type?: string; text?: string }[] | string;
		stop_reason?: string;
	} | null;
	if (!data) return { text: "", finishReason: null };

	const choice = data.choices?.[0];
	if (choice) {
		const message = choice.message ?? {};
		const content = message.content;
		if (typeof content === "string" && content.trim().length > 0) {
			return { text: content, finishReason: choice.finish_reason ?? null };
		}
		// 部分兼容层把 content 给成数组（多段）。
		if (Array.isArray(content)) {
			const joined = content.map(part => (typeof part === "string" ? part : "")).join("");
			if (joined.trim().length > 0) return { text: joined, finishReason: choice.finish_reason ?? null };
		}
		const reasoning = message.reasoning_content ?? message.reasoning;
		if (typeof reasoning === "string" && reasoning.trim().length > 0) {
			return { text: reasoning, finishReason: choice.finish_reason ?? null };
		}
		return { text: "", finishReason: choice.finish_reason ?? null };
	}

	// Anthropic：content 是块数组，stop_reason 在顶层。
	if (Array.isArray(data.content)) {
		const joined = data.content
			.map(block => (block && block.type !== "thinking" ? (block.text ?? "") : ""))
			.join("");
		return { text: joined, finishReason: data.stop_reason ?? null };
	}
	if (typeof data.content === "string") return { text: data.content, finishReason: data.stop_reason ?? null };
	return { text: "", finishReason: data.stop_reason ?? null };
}


/**
 * 拒答梯度探测。
 *
 * 上游 `Tool/scripts/probe-refusal.py` 回答「某个 provider + 模型在第几档开始拒答」，
 * 做法是读 `~/.pi/agent/models.json` 拿密钥、逐档发请求、用关键词表判拒答。
 * 插件读不到主目录、也不该替用户保管密钥，所以这里改成：
 *
 *   · base / model / key 由调用方显式给出，输出里密钥打码；
 *   · 判定不用关键词表，用 `domain/refusal.ts`（五类拒绝 + 交付物豁免），比上游准；
 *   · 空正文单独归为 `empty` —— 那是服务端拦截，修法与「模型自己拒绝」不同。
 *
 * 一次调用只做一件事：发≤4 条请求，返回一张可比对的表。不改任何配置、不落盘。
 */
export function registerProbeRefusalTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<ProbeRefusalInput>({
		id: "probe_refusal",
		name: "probe_refusal",
		label: "%tool.probeRefusal.label%",
		description: [
			"Send a graded ladder of authorised-audit prompts to one OpenAI-compatible model and report where it",
			"starts refusing. Level 1 is a harmless control, 4 is a licensed-sandbox patch request; each reply is",
			"classified by the plugin's own refusal detector (identity / policy / deflection / provenance / silent),",
			"not by a keyword list, so a normal answer containing the word `sorry` is not misread as a refusal.",
			"",
			"Give `baseUrl` + `model` + `apiKey` (masked in the output), optionally `level` to stop early, `lang`,",
			"`apiStyle` (openai / anthropic), `prompt` to send one custom message, or `gradient` to send your own ladder.",
			"At most six requests per call; the only thing written is the probe record the panel reads.",
			"",
			"Use it to separate two failures that look alike: the model refusing (change the phrasing) versus the",
			"endpoint returning an empty body (the server dropped it — change the endpoint or relay).",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				baseUrl: { type: "string", description: "OpenAI-compatible base, e.g. https://api.example.com/v1" },
				model: { type: "string", description: "Model id as the provider spells it." },
				level: { type: "number", description: "Highest probe level to send (1–4). Default: all." },
				lang: { type: "string", enum: ["zh", "en"], description: "Probe language. Default: zh." },
				prompt: { type: "string", description: "Send this single prompt instead of the ladder." },
				apiKey: { type: "string", description: "Bearer token. Masked in every line of the output." },
				authHeader: { type: "string", description: "Header carrying the key. Default: Authorization (x-api-key when apiStyle=anthropic)." },
				apiStyle: {
					type: "string",
					enum: ["openai", "anthropic"],
					description: "Request flavour. openai → POST /chat/completions; anthropic → POST /messages (at /v1). Default: openai.",
				},
				gradient: {
					type: "array",
					items: { type: "string" },
					description: "Custom ladder: one prompt per rung (max 6), each sent as its own request. Replaces the standard four.",
				},
			},
			required: ["baseUrl", "model"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		timeoutMs: 300_000,
		handler: async ({ trigger }) => {
			const input = trigger.input;
			const base = (input.baseUrl ?? "").trim().replace(/\/+$/, "");
			const model = (input.model ?? "").trim();
			if (!base || !model) return "probe_refusal needs both `baseUrl` and `model`: without them there is nothing to probe.";

			if (!ctx.permissions.has("network.fetch")) {
				return [
					"Cannot probe: this plugin instance was not granted `network.fetch`.",
					"That is a permission question, not evidence about the model — grant it in the plugin settings and retry.",
				].join("\n");
			}
			const network = ctx.network;
			if (!network || typeof network.request !== "function") {
				return "Cannot probe: this host exposes no network API, so no request was sent.";
			}

			const lang: ProbeLang = input.lang === "en" ? "en" : "zh";
			const custom = input.prompt?.trim();
			const extra = (input.gradient ?? []).map(item => item.trim()).filter(item => item.length > 0);
			const ladder = custom
				? [{ level: 1, name: "自定义提示词", expect: "answer" as const, text: custom }]
				: extra.length > 0
					? // 自定义梯度：保留用户给的顺序，档号即次序。
						extra.slice(0, 6).map((text, index) => ({ level: index + 1, name: `自定义 ${index + 1}`, expect: "risky" as const, text }))
					: probesFor(lang, input.level);

			const style: ProbeApiStyle = input.apiStyle === "anthropic" ? "anthropic" : "openai";
			const header = (input.authHeader ?? (style === "anthropic" ? "x-api-key" : DEFAULT_HEADER)).trim() || DEFAULT_HEADER;
			const key = input.apiKey?.trim();
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (style === "anthropic") headers["anthropic-version"] = "2023-06-01";
			if (key) headers[header] = header.toLowerCase() === "authorization" ? `Bearer ${key}` : key;
			const endpoint = style === "anthropic" ? `${base}/messages` : `${base}/chat/completions`;

			const results: ProbeResult[] = [];
			const failures: string[] = [];

			for (const probe of ladder) {
				try {
					const response = await network.request({
						url: endpoint,
						method: "POST",
						headers,
						// 宿主网络层要求显式声明 body 类型；`json` 下 value 就是那个对象。
						body: {
							type: "json",
							value:
								style === "anthropic"
									? { model, max_tokens: 1200, messages: [{ role: "user", content: probe.text }] }
									: { model, messages: [{ role: "user", content: probe.text }], temperature: 0, max_tokens: 1200 },
						},
						timeoutMs: TIMEOUT_MS,
						responseType: "json",
					});
					const payload = response.body as
						| {
								choices?: {
									message?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null };
									finish_reason?: string;
								}[];
								content?: { type?: string; text?: string }[] | string;
								stop_reason?: string;
								error?: { message?: string };
						  }
						| undefined;
					if (response.status >= 400) {
						// 4xx/5xx 不是模型的回答，单独记一行，不混进拒答统计。
						failures.push(`level ${probe.level}: HTTP ${response.status} ${payload?.error?.message ?? ""}`.trim());
						continue;
					}
					const { text, finishReason } = extractText(payload);
					results.push(toResult(probe, text, finishReason));
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					// 宿主网络层只放行 `network.allowedHosts` 里声明过的主机；未声明时错误里带 host 字样。
					// 这不是探测失败，是权限边界——不说清楚，用户会去改提示词。
					const blocked = /host|allowedHosts|not allowed|denied/i.test(message);
					failures.push(
						blocked
							? `level ${probe.level}: blocked by the host network allowlist (${message}). Add \`${new URL(base).host}\` to \`network.allowedHosts\` and retry.`
							: `level ${probe.level}: ${message}`,
					);
				}
			}

			const summary = summarise(results);

			const host = new URL(base).host;

			// 先读上一份：同一模型 + 同一端点时，把它的结论带进新记录。
			// 「改了写法有没有用」只能跟上一份比 —— 只留最后一次等于永远测不出改进。
			let previous: ProbeSummary | undefined;
			try {
				const raw = await ctx.storage.readFile(PROBE_STATE_PATH, "utf8");
				const prior = raw ? (JSON.parse(raw) as ProbeRecord) : null;
				if (prior && prior.model === model && prior.host === host && prior.summary) previous = prior.summary;
			} catch {
				/* 没有旧记录或读不动：当作第一次探测。 */
			}

			// 落盘给面板用：工具写、面板读同一份，面板不猜、不解析 Markdown。
			// 写失败不影响本次输出：结论已经在下面这份文本里了。
			try {
				await ctx.storage.writeFile(
					PROBE_STATE_PATH,
					JSON.stringify(toRecord({ at: new Date().toISOString(), model, host, lang, previous }, results)),
					"utf8",
				);
			} catch {
				/* 只读存储或配额满：面板看不到历史，但本次结论仍然成立。 */
			}
			const lines = [
				`# 拒答梯度探测 · ${model}`,
				"",
				`- 端点：\`${base}\``,
				key ? `- 密钥：\`${maskSecret(key)}\`（写进 ${header}，输出里始终打码）` : "- 密钥：未提供（端点必须是免认证的）",
				`- 档位：${custom ? "自定义单条" : `1–${Math.max(...ladder.map(item => item.level))}`} · 语言 ${lang}`,
				`- 结论：**${summary.headline}**`,
				...(previous
					? [
							`- 与上次对比：之前 ${previous.firstRefusal === null ? "全部回答" : `从第 ${previous.firstRefusal} 档起被拦`} → 本次 ${
								summary.firstRefusal === null ? "全部回答" : `从第 ${summary.firstRefusal} 档起被拦`
							}`,
						]
					: []),
				"",
				results.length > 0 ? renderTable(results) : "_没有任何一条拿到可判定的回复。_",
			];

			if (results.length > 0) {
				lines.push("", "## 逐档原文（前 240 字）", "");
				for (const item of results) {
					lines.push(`**${item.probe.level}. ${item.probe.name}** — ${item.verdict}`, "", item.excerpt || "_(空正文)_", "");
				}
			}

			if (failures.length > 0) {
				lines.push("## 请求失败（不计入拒答统计）", "");
				for (const line of failures) lines.push(`- ${line}`);
			}

			lines.push(
				"",
				"## 怎么读这张表",
				"",
				"- **refused** 从第几档开始 → 换写法（评审式重述、给容器与边界）往往能过；同一种写法重发无效。",
				"- **empty**（HTTP 200 + 空正文）→ 服务端拦截，换端点或换中转，不是改提示词能解决的。",
				"- 第 1、2 档就被拒 → 问题在端点/模型本身，不在提示词。",
				"- 本工具只观测，不改任何配置；密钥用过即弃，需要长期使用请在宿主侧配置 provider。",
			);

			return lines.join("\n");
		},
	});
}
