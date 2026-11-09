import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button } from "@astravia-org/ui";
import type { MagpieState } from "../../../controller";
import type { RuntimePhase } from "../../../runtime-manager";

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

const TONE: Record<RuntimePhase, string> = {
	unknown: "bg-muted-foreground/50",
	checking: "bg-amber-500",
	absent: "bg-destructive",
	downloading: "bg-amber-500",
	starting: "bg-amber-500",
	running: "bg-emerald-500",
	stopped: "bg-muted-foreground/50",
	failed: "bg-destructive",
};

/**
 * 运行环境卡片：网关没响应时，用户在这里一键取回官方二进制并启动它。
 *
 * 它只说三件事：现在是什么状态、点哪个按钮、刚才最后一行输出是什么。
 * 具体的下载/校验/启动由 controller 经宿主 ctx.command 完成 —— 这一层不做副作用。
 */
export function GatewaySetupCard({ state, onInstallAndStart, onStart, onStop }: SetupCardProps) {
	const { t } = useTranslation();
	const runtime = state.runtime;
	const working = runtime.phase === "downloading" || runtime.phase === "starting" || runtime.phase === "checking";
	const installed = Boolean(runtime.binPath);
	const running = runtime.phase === "running";

	const primary = running
		? null
		: installed
			? { label: t("runtime.action.start"), action: onStart }
			: { label: t("runtime.action.installAndStart"), action: onInstallAndStart };

	const primaryLabel = working
		? runtime.phase === "downloading"
			? t("runtime.action.downloading")
			: t("runtime.action.starting")
		: runtime.phase === "failed" && installed
			? t("runtime.action.retry")
			: (primary?.label ?? t("runtime.action.installAndStart"));

	return (
		<section className="rounded-xl border border-border/70 bg-card/60 p-5">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<span className={`h-2 w-2 shrink-0 rounded-full ${TONE[runtime.phase]}`} />
						<h2 className="truncate text-sm font-medium">{t("runtime.title")}</h2>
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						{t(PHASE_KEY[runtime.phase])}
						{runtime.version ? ` · ${runtime.version}` : ""}
						{runtime.pid ? ` · pid ${runtime.pid}` : ""}
					</p>
				</div>
				<div className="flex shrink-0 gap-2">
					{primary ? (
						<Button size="sm" onClick={primary.action} disabled={working}>
							{primaryLabel}
						</Button>
					) : null}
					{running ? (
						<Button variant="outline" size="sm" onClick={onStop} disabled={working}>
							{t("runtime.action.stop")}
						</Button>
					) : null}
				</div>
			</div>

			<p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("runtime.body", { endpoint: state.endpoint })}</p>

			{runtime.binPath ? (
				<p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{runtime.binPath}</p>
			) : null}

			{runtime.messageKey ? (
				<p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
					{t(runtime.messageKey)}
				</p>
			) : null}

			{runtime.detail ? (
				<pre className="mt-2 overflow-x-auto rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground">
					{runtime.detail}
				</pre>
			) : null}

			<p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{t("runtime.note")}</p>

			<a
				href="https://usemagpie.ai"
				target="_blank"
				rel="noreferrer"
				className="mt-2 inline-block text-xs underline underline-offset-4"
			>
				{t("runtime.manual")} — usemagpie.ai
			</a>
		</section>
	);
}
