/**
 * 命令结果面板：状态 + 退出码 + 耗时 + 输出（stdout/stderr）。
 *
 * 宿主的 run 输出尾部保留约 64KB，这里只渲染首尾各一段，避免把面板撑爆；
 * 「复制」拿到的是完整文本，方便把 JSON 证据落盘。
 */

import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { StatusChip, type StatusTone } from "../../../shared/components/status-chip";
import type { CommandRunState } from "../hooks/use-command-runner";

const HEAD_CHARS = 2200;
const TAIL_CHARS = 1400;

interface OutputPanelProps {
	readonly state: CommandRunState;
	readonly onClear: () => void;
}

function toneFor(state: CommandRunState): StatusTone {
	if (state.phase === "running") return "progress";
	return state.phase === "done" ? "success" : "danger";
}

/** 超长输出保留头部（JSON 的 source/identity）与尾部（报错与统计）。 */
function clip(text: string): { body: string; clipped: number } {
	if (text.length <= HEAD_CHARS + TAIL_CHARS) return { body: text, clipped: 0 };
	const head = text.slice(0, HEAD_CHARS);
	const tail = text.slice(text.length - TAIL_CHARS);
	return { body: `${head}\n\n… ${text.length - HEAD_CHARS - TAIL_CHARS} chars omitted …\n\n${tail}`, clipped: text.length };
}

export function ReaCommandOutput({ state, onClear }: OutputPanelProps): JSX.Element {
	const { t } = useTranslation();
	const [copied, setCopied] = useState<boolean>(false);
	const stream = state.stderr.trim().length > 0 ? state.stderr : state.stdout;
	const { body, clipped } = clip(stream.trim());
	const empty = body.length === 0;

	const copy = (): void => {
		const text = [state.commandLine, "", stream].join("\n");
		void navigator.clipboard
			?.writeText(text)
			.then(() => {
				setCopied(true);
				window.setTimeout(() => setCopied(false), 1500);
			})
			.catch(() => setCopied(false));
	};

	return (
		<section className="mt-2 rounded-[min(var(--radius-md),10px)] border border-border bg-background/60">
			<header className="flex flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5">
				<StatusChip tone={toneFor(state)}>
					<span
						className={`size-1.5 rounded-full bg-current ${state.phase === "running" ? "motion-safe:animate-pulse" : ""}`}
						aria-hidden
					/>
					{t(`tab.run.phase.${state.phase}`)}
				</StatusChip>
				<span className="truncate text-[11px] text-foreground/85">{state.label}</span>
				{state.exitCode !== null ? (
					<span className="text-[10.5px] text-muted-foreground">{t("tab.run.exit", { code: state.exitCode })}</span>
				) : null}
				{state.durationMs > 0 ? (
					<span className="text-[10.5px] text-muted-foreground">
						{t("tab.run.duration", { seconds: (state.durationMs / 1000).toFixed(1) })}
					</span>
				) : null}
				<span className="ml-auto flex items-center gap-1">
					<button
						type="button"
						onClick={copy}
						className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						{copied ? t("tab.run.copied") : t("tab.run.copy")}
					</button>
					<button
						type="button"
						onClick={onClear}
						className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						{t("tab.run.clear")}
					</button>
				</span>
			</header>
			<code className="block truncate border-b border-border/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
				{state.commandLine}
			</code>
			{state.message ? (
				<p className="border-b border-border/60 px-2 py-1.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
					{state.message}
				</p>
			) : null}
			<pre className="max-h-44 overflow-auto px-2 py-1.5 font-mono text-[10px] leading-relaxed text-foreground/85">
{empty && state.phase === "running" ? t("tab.run.waiting") : body}
			</pre>
			{clipped > 0 ? (
				<p className="border-t border-border/60 px-2 py-1 text-[10px] text-muted-foreground">
					{t("tab.run.truncated", { total: clipped })}
				</p>
			) : null}
		</section>
	);
}
