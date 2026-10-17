import type { JSX } from "react";
import type { PluginCliProviderPhase, PluginCliProviderStatus } from "@astravia-org/plugin-sdk";
import type { OcrProviderBridge } from "../../../review/provider.ts";
import { isProviderBusy, outputTail, phaseLabel } from "../../../review/provider.ts";

const PHASE_TONE: Record<PluginCliProviderPhase, string> = {
	disabled: "bg-muted text-muted-foreground",
	checking: "bg-primary/10 text-primary",
	installing: "bg-primary/10 text-primary",
	verifying: "bg-primary/10 text-primary",
	ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
	failed: "bg-red-500/15 text-red-600 dark:text-red-400",
};

/**
 * ocr 依赖状态条：一句话阶段 + 忙碌指示 + 失败重试 + 安装日志尾部。
 * 安装中默认展开日志（用户能看见活着），就绪时收起（不占视线）。
 */
export function OcrStatusBar({
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
				{busy ? <span className="icon-[mdi--loading] size-3.5 animate-spin text-primary" /> : null}
				{phase === "ready" ? (
					<span className="icon-[mdi--check-circle-outline] size-3.5 text-emerald-500" />
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
					<summary className="cursor-pointer select-none">{busy ? "安装过程（实时）" : "安装过程"}</summary>
					<pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-muted/60 p-2 font-mono text-[11px] leading-4">
						{tail}
					</pre>
				</details>
			) : null}
		</div>
	);
}
