import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { maskSecret, probesFor, renderTable, summarise, toResult, type ProbeLang, type ProbeResult } from "../../domain/refusal-probe";

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
}

const TIMEOUT_MS = 60_000;
const DEFAULT_HEADER = "Authorization";


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
			"or `prompt` to send one custom message instead of the ladder. At most four requests per call;",
			"nothing is written to disk and no configuration is changed.",
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
				authHeader: { type: "string", description: "Header carrying the key. Default: Authorization." },
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
			const ladder = custom
				? [{ level: 1, name: "自定义提示词", expect: "answer" as const, text: custom }]
				: probesFor(lang, input.level);

			const header = (input.authHeader ?? DEFAULT_HEADER).trim() || DEFAULT_HEADER;
			const key = input.apiKey?.trim();
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (key) headers[header] = header.toLowerCase() === "authorization" ? `Bearer ${key}` : key;

			const results: ProbeResult[] = [];
			const failures: string[] = [];

			for (const probe of ladder) {
				try {
					const response = await network.request({
						url: `${base}/chat/completions`,
						method: "POST",
						headers,
						// 宿主网络层要求显式声明 body 类型；`json` 下 value 就是那个对象。
						body: { type: "json", value: { model, messages: [{ role: "user", content: probe.text }], temperature: 0, max_tokens: 800 } },
						timeoutMs: TIMEOUT_MS,
						responseType: "json",
					});
					const payload = response.body as
						| { choices?: { message?: { content?: string | null }; finish_reason?: string }[]; error?: { message?: string } }
						| undefined;
					const text = payload?.choices?.[0]?.message?.content ?? "";
					if (response.status >= 400) {
						// 4xx/5xx 不是模型的回答，单独记一行，不混进拒答统计。
						failures.push(`level ${probe.level}: HTTP ${response.status} ${payload?.error?.message ?? ""}`.trim());
						continue;
					}
					results.push(toResult(probe, text));
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
			const lines = [
				`# 拒答梯度探测 · ${model}`,
				"",
				`- 端点：\`${base}\``,
				key ? `- 密钥：\`${maskSecret(key)}\`（写进 ${header}，输出里始终打码）` : "- 密钥：未提供（端点必须是免认证的）",
				`- 档位：${custom ? "自定义单条" : `1–${Math.max(...ladder.map(item => item.level))}`} · 语言 ${lang}`,
				`- 结论：**${summary.headline}**`,
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
