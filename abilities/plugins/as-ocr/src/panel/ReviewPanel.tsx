/**
 * 活动面板「审查」标签：ocr 安装状态条（含安装日志）+ 运行审查 + 结果列表（按严重度分组、行号定位）。
 * Tailwind className（宿主规范：禁手写业务 CSS）。
 */

import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Disposable, PluginCliProviderPhase, PluginCliProviderStatus } from "@astravia-org/plugin-sdk";
import type { OcrProviderBridge } from "../review/provider";
import { isProviderBusy, outputTail, phaseLabel } from "../review/provider.ts";
import type { ReviewFinding, ReviewRun, ReviewStore } from "../review/store";

const SEVERITY_ORDER: readonly ReviewFinding["severity"][] = ["critical", "major", "minor", "info"];

const SEVERITY_STYLE: Record<ReviewFinding["severity"], string> = {
	critical: "bg-red-500/15 text-red-600 dark:text-red-400",
	major: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
	minor: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
	info: "bg-muted text-muted-foreground",
};

const PHASE_TONE: Record<PluginCliProviderPhase, string> = {
	disabled: "bg-muted text-muted-foreground",
	checking: "bg-primary/10 text-primary",
	installing: "bg-primary/10 text-primary",
	verifying: "bg-primary/10 text-primary",
	ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
	failed: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function ReviewPanel({
	store,
	provider,
}: {
	store: ReviewStore;
	provider: OcrProviderBridge;
}): JSX.Element {
	const [, force] = useState(0);
	useEffect(() => store.subscribe(() => force((n) => n + 1)), [store]);

	const status = useOcrStatus(provider);
	const runs = store.getRuns();

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b border-border px-3 py-2">
				<span className="text-sm font-medium">代码审查</span>
				<span className="text-xs text-muted-foreground">ocr · alibaba/open-code-review</span>
			</div>
			<OcrStatusBar provider={provider} status={status} />
			<div className="flex-1 overflow-y-auto px-3 py-2">
				{runs.length === 0 ? (
					<EmptyHint />
				) : (
					[...runs].reverse().map((run) => <RunCard key={run.id} run={run} />)
				)}
			</div>
		</div>
	);
}

/** 订阅宿主的 ocr provider 状态（探测 / 安装 / 校验 / 就绪 / 失败）。 */
function useOcrStatus(provider: OcrProviderBridge): PluginCliProviderStatus | null {
	const [status, setStatus] = useState<PluginCliProviderStatus | null>(null);
	useEffect(() => {
		let alive = true;
		void provider
			.getStatus()
			.then((next) => {
				if (alive) setStatus(next);
			})
			.catch(() => {
				/* 读不到快照就只留「正在检测」，不阻塞面板渲染 */
			});
		const subscription: Disposable = provider.onStatusChanged((next) => setStatus(next));
		return () => {
			alive = false;
			subscription.dispose();
		};
	}, [provider]);
	return status;
}

/** 顶部状态条：一句话状态 + 安装日志（安装中默认展开、实时刷新）+ 失败重试。 */
function OcrStatusBar({
	provider,
	status,
}: {
	provider: OcrProviderBridge;
	status: PluginCliProviderStatus | null;
}): JSX.Element {
	const phase = status?.phase ?? "checking";
	const busy = isProviderBusy(phase);
	const tail = status ? outputTail(status.recentOutput) : "";
	return (
		<div className="border-b border-border px-3 py-2" aria-live="polite">
			<div className="flex items-center gap-2">
				<span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PHASE_TONE[phase]}`}>
					{phaseLabel(phase)}
				</span>
				{busy ? <span className="icon-[mdi--loading] h-3.5 w-3.5 animate-spin text-primary" /> : null}
				{phase === "ready" ? (
					<span className="icon-[mdi--check-circle-outline] h-3.5 w-3.5 text-emerald-500" />
				) : null}
				{phase === "failed" ? (
					<button
						type="button"
						onClick={() => void provider.retry()}
						className="rounded border border-border px-2 py-0.5 text-[11px] text-foreground/80 hover:bg-accent"
					>
						重试安装
					</button>
				) : null}
				{phase === "ready" ? (
					<button
						type="button"
						onClick={() => void provider.retry()}
						className="ml-auto rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
					>
						重新检测
					</button>
				) : null}
			</div>
			{phase === "failed" && status?.message ? (
				<p className="mt-1 text-[11px] text-red-500">{status.message}</p>
			) : null}
			{tail ? (
				<details className="mt-1.5 text-[11px] text-muted-foreground" open={busy}>
					<summary className="cursor-pointer select-none">
						{busy ? "安装过程（实时）" : "安装过程"}
					</summary>
					<pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-muted/60 p-2 font-mono text-[11px] leading-4">
						{tail}
					</pre>
				</details>
			) : null}
		</div>
	);
}

function EmptyHint(): JSX.Element {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
			<span className="icon-[mdi--clipboard-check-outline] h-8 w-8 opacity-50" />
			<p className="text-sm">还没有审查记录</p>
			<p className="max-w-64 text-xs leading-5">
				在对话里让 agent「审查一下改动」，或直接说 code review——结果会出现在这里。
			</p>
			<p className="max-w-64 text-xs leading-5">
				首次使用会自动安装 ocr CLI（npm 全局包），进度显示在本面板顶部。
			</p>
		</div>
	);
}

function RunCard({ run }: { run: ReviewRun }): JSX.Element {
	const grouped = new Map<string, ReviewFinding[]>();
	for (const f of run.findings) {
		const list = grouped.get(f.severity) ?? [];
		list.push(f);
		grouped.set(f.severity, list);
	}
	return (
		<div className="mb-3 rounded-lg border border-border">
			<div className="flex items-center gap-2 px-3 py-1.5 text-xs">
				<span className={run.ok ? "text-muted-foreground" : "text-red-500"}>
					{run.ok ? (run.findings.length === 0 ? "通过" : `${run.findings.length} 个发现`) : "失败"}
				</span>
				<span className="text-muted-foreground/60">
					{run.scope} · {(run.durationMs / 1000).toFixed(1)}s
				</span>
			</div>
			{!run.ok && run.error ? (
				<div className="border-t border-border px-3 py-2 text-xs text-red-500">{run.error}</div>
			) : null}
			{SEVERITY_ORDER.filter((s) => grouped.has(s)).map((severity) => (
				<div key={severity} className="border-t border-border">
					<div className="px-3 pt-2">
						<span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${SEVERITY_STYLE[severity]}`}>
							{severity} · {grouped.get(severity)?.length}
						</span>
					</div>
					<div className="px-3 py-2">
						{(grouped.get(severity) ?? []).map((f, index) => (
							<div key={`${f.file}-${f.line}-${index}`} className="mb-1.5 text-xs leading-5">
								<span className="font-mono text-muted-foreground">
									{f.file}
									{f.line > 0 ? `:${f.line}` : ""}
								</span>
								{f.rule ? <span className="ml-1 text-muted-foreground/60">[{f.rule}]</span> : null}
								<div className="text-foreground/90">{f.message}</div>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
