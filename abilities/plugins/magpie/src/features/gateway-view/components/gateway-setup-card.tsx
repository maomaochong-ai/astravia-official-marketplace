import { useTranslation } from "@astravia-org/plugin-sdk";
import type { MagpieState } from "../../../controller";
import { binDisplayPath } from "../../../platform-shell";
import type { RuntimePhase } from "../../../runtime-manager";
import { Button, Fact, PanelSection, StatusDot } from "./ui";

interface SetupSectionProps {
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

/** 运行环境：网关没响应时，用户在这里一键取回官方二进制并启动它。 */
export function GatewaySetupCard({ state, onInstallAndStart, onStart, onStop }: SetupSectionProps) {
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

	const seconds = elapsedSeconds ?? 0;
	// 官方 feed 不再发布字节数，所以「总长未知」是常态：此时报告已下多少、过了多久、当前速度。
	const readout: string[] = [];
	if (verifying) {
		readout.push(t("runtime.progress.verifying"));
	} else if (progress && percent !== undefined) {
		readout.push(`${percent}%`);
		readout.push(`${formatMegabytes(progress.downloaded)} / ${formatMegabytes(progress.total)}`);
		const bytesPerSecond = seconds > 1 ? progress.downloaded / seconds : 0;
		if (bytesPerSecond > 0) {
			readout.push(t("runtime.progress.speed", { speed: (bytesPerSecond / (1024 * 1024)).toFixed(1) }));
			const left = Math.round((progress.total - progress.downloaded) / bytesPerSecond);
			if (left > 0) readout.push(t("runtime.progress.eta", { seconds: left }));
		} else if (seconds > 0) {
			readout.push(t("runtime.progress.elapsed", { seconds }));
		}
	} else if (progress && progress.downloaded > 0) {
		readout.push(t("runtime.progress.downloadedOnly", { size: formatMegabytes(progress.downloaded) }));
		const bytesPerSecond = seconds > 1 ? progress.downloaded / seconds : 0;
		if (bytesPerSecond > 0) {
			readout.push(t("runtime.progress.speed", { speed: (bytesPerSecond / (1024 * 1024)).toFixed(1) }));
		}
		if (seconds > 0) readout.push(t("runtime.progress.elapsed", { seconds }));
		if (runtime.releaseVersion) readout.push(runtime.releaseVersion);
	} else if (starting) {
		readout.push(t("runtime.phase.starting"));
	} else if (downloading) {
		readout.push(t("runtime.progress.contacting"));
	}

	const indeterminate = downloading && percent === undefined;
	const barWidth = verifying || starting || indeterminate ? 100 : (percent ?? 0);
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
		<PanelSection
			title={
				<span className="flex items-center gap-2">
					<StatusDot tone={PHASE_TONE[runtime.phase]} pulse={working} />
					<span className="mp-heading normal-case tracking-normal" style={{ color: "var(--mp-text)" }}>
						{t("runtime.title")}
					</span>
					<span className="mp-meta normal-case tracking-normal">
						{t(PHASE_KEY[runtime.phase])}
						{runtime.pid ? ` · pid ${runtime.pid}` : ""}
						{runtime.version ? ` · ${runtime.version}` : ""}
						{runtime.releaseVersion ? ` · ${t("runtime.release")} ${runtime.releaseVersion}` : ""}
					</span>
				</span>
			}
			aside={
				running ? (
					<Button tone="outline" onClick={onStop} disabled={working}>
						{t("runtime.action.stop")}
					</Button>
				) : (
					<Button onClick={installed ? onStart : onInstallAndStart} disabled={working}>
						{primaryLabel}
					</Button>
				)
			}
		>
			{downloading || starting ? (
				<div>
					<div className="mp-bar">
						<span
							className={verifying || starting || indeterminate ? "animate-pulse" : ""}
							style={{ width: `${barWidth}%` }}
						/>
					</div>
					<p className="mp-meta mp-mono mp-num mt-1.5">{readout.join(" · ")}</p>
					{downloading && !verifying ? (
						<p className="mp-meta mp-faint mt-0.5">
							{percent !== undefined ? t("runtime.progress.hint") : t("runtime.progress.noTotal")}
						</p>
					) : null}
				</div>
			) : null}

			{runtime.messageKey ? (
				<div
					className="mt-2 rounded-lg border px-2.5 py-1.5"
					style={{
						borderColor: "color-mix(in srgb, var(--destructive) 34%, transparent)",
						background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
					}}
				>
					<p className="mp-body font-medium" style={{ color: "var(--destructive)" }}>
						{t(runtime.messageKey)}
					</p>
					{runtime.messageKey === "runtime.noShell" ? (
						<p className="mp-meta mp-faint mt-0.5">{t("runtime.noShellHint")}</p>
					) : null}
					{runtime.messageKey === "runtime.denied" ? (
						<p className="mp-meta mp-faint mt-0.5">{t("runtime.deniedHint")}</p>
					) : null}
				</div>
			) : null}

			<dl className="mp-strip mt-2">
				<Fact label={t("runtime.diagnosis.shell")} value={runtime.shell ?? "—"} />
				<Fact label={t("runtime.diagnosis.path")} value={runtime.binPath ?? installPath} />
				<Fact label={t("runtime.diagnosis.endpoint")} value={state.endpoint} />
			</dl>

			{runtime.detail ? (
				<pre
					className="mp-mono mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg border px-2.5 py-1.5"
					style={{ borderColor: "var(--mp-rule)", background: "color-mix(in srgb, var(--foreground) 4%, transparent)" }}
				>
					{runtime.detail}
				</pre>
			) : null}

			<p className="mp-meta mp-faint mt-2">
				{t("runtime.note")}{" "}
				<a href="https://usemagpie.ai" target="_blank" rel="noreferrer" className="underline underline-offset-4">
					usemagpie.ai
				</a>
			</p>
		</PanelSection>
	);
}
