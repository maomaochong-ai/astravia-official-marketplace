/**
 * REA 错误契约解释器：扫描 provider status.recentOutput 里的最后一行 JSON，
 * 若匹配 rea/docs/error-contract.schema.json 结构则渲染「code / category / retryable / remediation」卡。
 *
 * 不需要联网：契约是结构化的（rea 自己输出的 JSON 错误），最末一行是 JSON 即可解析。
 * 解析失败时不渲染（旧版本 rea 文本错误时回退到原始 log）。
 */

import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";

interface ReaErrorObject {
	code?: string;
	category?: string;
	message?: string;
	retryable?: boolean;
	remediation?: { action?: string };
	details?: Record<string, unknown>;
}

export function tryParseReaError(recentOutput: string | undefined): ReaErrorObject | null {
	if (!recentOutput) return null;
	const lines = recentOutput.split("\n");
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i]!.trim();
		if (!line.startsWith("{") || !line.endsWith("}")) continue;
		try {
			const parsed = JSON.parse(line) as unknown;
			if (
				parsed &&
				typeof parsed === "object" &&
				"code" in parsed &&
				"category" in parsed &&
				"message" in parsed
			) {
				return parsed as ReaErrorObject;
			}
		} catch {
			// 继续向上找
		}
	}
	return null;
}

export interface ReaErrorExplainerProps {
	readonly error: ReaErrorObject;
}

export function ReaErrorExplainer({ error }: ReaErrorExplainerProps): JSX.Element {
	const { t } = useTranslation();
	const [expanded, setExpanded] = useState<boolean>(false);

	const code = error.code ?? "unknown";
	const category = error.category ?? "unknown";
	const message = error.message ?? "";
	const retryable = error.retryable ?? false;
	const action = error.remediation?.action ?? "";

	const tone = retryable ? "warning" : "danger";

	return (
		<div
			className={
				tone === "danger"
					? "mt-1.5 rounded-control border border-danger/40 bg-danger/10 px-2 py-1.5 text-micro leading-relaxed text-danger"
					: "mt-1.5 rounded-control border border-honey bg-apricot-light px-2 py-1.5 text-micro leading-relaxed text-ochre"
			}
			role="alert"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<p className="font-mono text-[10.5px] font-semibold uppercase tracking-wide">
						{code} · {category}
					</p>
					<p className="mt-0.5 text-foreground/90">{message}</p>
				</div>
				<span
					className={
						retryable
							? "inline-flex h-5 items-center rounded-full border border-honey bg-apricot px-1.5 text-micro-up font-medium text-ochre"
							: "inline-flex h-5 items-center rounded-full border border-danger/40 bg-danger/12 px-1.5 text-micro-up font-medium text-danger"
					}
				>
					{retryable ? t("setup.error.retryable") : t("setup.error.fatal")}
				</span>
			</div>
			{action ? (
				<div className="mt-1.5">
					<button
						type="button"
						className="inline-flex items-center gap-1 text-[10.5px] font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						onClick={() => setExpanded((v) => !v)}
						aria-expanded={expanded}
					>
						<span aria-hidden>{expanded ? "▾" : "▸"}</span>
						<span>{t("setup.error.remediation")}</span>
					</button>
					{expanded ? (
						<pre className="mt-1 overflow-auto rounded bg-background/50 px-2 py-1 font-mono text-[10.5px] leading-relaxed text-foreground/90">
{action}
						</pre>
					) : null}
				</div>
			) : null}
			{error.details ? (
				<details className="mt-1.5">
					<summary className="cursor-pointer text-[10px] uppercase tracking-wide opacity-70">
						{t("setup.error.details")}
					</summary>
					<pre className="mt-1 overflow-auto rounded bg-background/50 px-2 py-1 font-mono text-[10px] leading-relaxed text-foreground/80">
{JSON.stringify(error.details, null, 2)}
					</pre>
				</details>
			) : null}
		</div>
	);
}
