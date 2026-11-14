import { useTranslation } from "@astravia-org/plugin-sdk";
import type { MagpieState } from "../../../controller";
import type { RuntimePhase } from "../../../runtime-manager";
import { binDisplayPath } from "../../../platform-shell";
import { Button, Card, Fact, StatusDot } from "./ui";

interface SetupCardProps {
	state: MagpieState;
	onInstallAndStart: () => void;
	onStart: () => void;
	onStop: () => void;
}

const PHASE_KEY: Record<RuntimePhase, string> = {
	unknown: "runtime.phase.unknown",
	checking: "runtime.phase.checking",
	absent: "runtime.phase.absent",
	downloading: "runtime.phase.downloading",
	starting: "runtime.phase.starting",
	running: "runtime.phase.running",
	stopped: "runtime.phase.stopped",
	failed: "runtime.phase.failed",
};

const PHASE_TONE: Record<RuntimePhase, "ok" | "working" | "bad" | "idle"> = {
	unknown: "idle",
	checking: "working",
	absent: "bad",
	downloading: "working",
	starting: "working",
	running: "ok",
	stopped: "idle",
	failed: "bad",
};

function formatMegabytes(bytes: number): string {
	const mb = bytes / (1024 * 1024);
	return `${mb >= 100 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

/**
 * 运行环境：网关没响应时，用户在这里一键取回官方二进制并启动它。
 *
 * 三件事，按用户排查的顺序排：现在是什么状态 → 点哪个按钮 → 刚才到底跑了什么。
 * 「刚才跑了什么」这一行（用了哪个 shell、装到哪个路径、最后一行输出）是这次修的重点：
 * 0.1.3 只把错误原文丢进一个灰框，用户看到 `sh (ENOENT)` 却不知道它意味着什么都完了。
 */
export function GatewaySetupCard({ state, onInstallAndStart, onStart, onStop }: SetupCardProps) {
	const { t } = useTranslation();
	const runtime = state.runtime;
	const downloading = runtime.phase === "downloading";
	const starting = runtime.phase === "starting";
	const working = downloading || starting || runtime.phase === "checking";
	const installed = Boolean(runtime.binPath);
	const running = runtime.phase === "running";
	const verifying = runtime.installStep === "verifying";

	const progress = runtime.progress;
	const percent =
		progress && progress.total > 0 ? Math.min(100, Math.floor((progress.downloaded / progress.total) * 100)) : undefined;
	const elapsedSeconds =
		runtime.phaseStartedAt !== undefined ? Math.max(0, Math.round((Date.now() - runtime.phaseStartedAt) / 1000)) : undefined;

	const readout: string[] = [];
	if (verifying) {
		readout.push(t("runtime.progress.verifying"));
	} else if (progress && percent !== undefined) {
		readout.push(`${percent}%`);
		readout.push(`${formatMegabytes(progress.downloaded)} / ${formatMegabytes(progress.total)}`);
		const seconds = elapsedSeconds ?? 0;
		const bytesPerSecond = seconds > 1 ? progress.downloaded / seconds : 0;
		if (bytesPerSecond > 0) {
			readout.push(t("runtime.progress.speed", { speed: (bytesPerSecond / (1024 * 1024)).toFixed(1) }));
			const left = Math.round((progress.total - progress.downloaded) / bytesPerSecond);
			if (left > 0) readout.push(t("runtime.progress.eta", { seconds: left }));
		} else if (seconds > 0) {
			readout.push(t("runtime.progress.elapsed", { seconds }));
		}
	} else if (starting) {
		readout.push(t("runtime.phase.starting"));
	} else if (downloading) {
		readout.push(t("runtime.progress.contacting"));
	}

	const barWidth = verifying || starting ? 100 : (percent ?? 0);
	const primaryLabel = working
		? downloading
			? verifying
				? t("runtime.action.verifying")
				: percent !== undefined
					? t("runtime.action.downloadingPercent", { percent })
					: t("runtime.action.downloading")
			: t("runtime.action.starting")
		: runtime.phase === "failed" && installed
			? t("runtime.action.retry")
			: installed
				? t("runtime.action.start")
				: t("runtime.action.installAndStart");

	const installPath = binDisplayPath(runtime.shell === "windows" ? "windows" : "posix");

	return (
		<Card
			title={
				<span className="flex items-center gap-2">
					<StatusDot tone={PHASE_TONE[runtime.phase]} pulse={working} />
					<span className="truncate">{t("runtime.title")}</span>
				</span>
			}
			aside={
				<div className="flex gap-2">
					{running ? (
						<Button tone="outline" size="sm" onClick={onStop} disabled={working}>
							{t("runtime.action.stop")}
						</Button>
					) : (
						<Button size="sm" onClick={installed ? onStart : onInstallAndStart} disabled={working}>
							{primaryLabel}
						</Button>
					)}
				</div>
			}
		>
			<p className="text-xs text-muted-foreground">
				{t(PHASE_KEY[runtime.phase])}
				{runtime.pid ? ` · pid ${runtime.pid}` : ""}
				{runtime.version ? ` · ${runtime.version}` : ""}
				{runtime.releaseVersion ? ` · ${t("runtime.release")} ${runtime.releaseVersion}` : ""}
			</p>

			{downloading || starting ? (
				<div className="mt-3">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className={`h-full rounded-full bg-amber-500 transition-[width] duration-500 ease-out ${
								verifying || starting || percent === undefined ? "animate-pulse" : ""
							}`}
							style={{ width: `${barWidth}%` }}
						/>
					</div>
					<p className="mt-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">{readout.join(" · ")}</p>
					{downloading && !verifying ? (
						<p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("runtime.progress.hint")}</p>
					) : null}
				</div>
			) : null}

			{runtime.messageKey ? (
				<div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
					<p className="text-xs font-medium text-destructive">{t(runtime.messageKey)}</p>
					{runtime.messageKey === "runtime.noShell" ? (
						<p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("runtime.noShellHint")}</p>
					) : null}
					{runtime.messageKey === "runtime.denied" ? (
						<p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("runtime.deniedHint")}</p>
					) : null}
				</div>
			) : null}

			{/* 诊断：这一层是本次改造的重点 —— 用户要能看见它到底跑了什么。 */}
			<dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
				<Fact label={t("runtime.diagnosis.shell")} value={runtime.shell ?? "—"} />
				<Fact label={t("runtime.diagnosis.path")} value={runtime.binPath ?? installPath} />
				<Fact label={t("runtime.diagnosis.endpoint")} value={state.endpoint} />
			</dl>

			{runtime.detail ? (
				<pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
					{runtime.detail}
				</pre>
			) : null}

			<p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{t("runtime.note")}</p>
			<a
				href="https://usemagpie.ai"
				target="_blank"
				rel="noreferrer"
				className="mt-1 inline-block text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
			>
				{t("runtime.manual")} — usemagpie.ai
			</a>
		</Card>
	);
}
