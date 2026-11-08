import { useTranslation } from "@astravia-org/plugin-sdk";
import { Button, cn } from "@astravia-org/ui";
import type { MagpieState } from "../../../controller";

const PHASE_TONE: Record<MagpieState["phase"], string> = {
	idle: "bg-muted-foreground/50",
	probing: "bg-amber-500",
	online: "bg-emerald-500",
	offline: "bg-destructive",
};

interface StatusCardProps {
	state: MagpieState;
	onRefresh: () => void;
	onPublish: () => void;
	onDisconnect: () => void;
	onOpenConsole: () => void;
}

/** 第一屏回答四件事：网关在不在、什么版本、有多少模型、有没有发布到 Astravia。 */
export function GatewayStatusCard({ state, onRefresh, onPublish, onDisconnect, onOpenConsole }: StatusCardProps) {
	const { t } = useTranslation();
	const busy = state.busy;
	const published = typeof state.publishedCount === "number";

	return (
		<section className="rounded-xl border border-border/70 bg-card/60 p-5">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<span className={cn("h-2 w-2 shrink-0 rounded-full", PHASE_TONE[state.phase])} />
						<h2 className="truncate text-sm font-medium">
							{t(`status.${state.phase}`)}
						</h2>
					</div>
					<p className="mt-1 truncate font-mono text-xs text-muted-foreground">{state.endpoint}</p>
				</div>
				<Button variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
					{busy ? t("actions.working") : t("actions.refresh")}
				</Button>
			</div>

			{state.messageKey ? (
				<p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
					{t(state.messageKey)}
				</p>
			) : null}

			<dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
				<div>
					<dt className="text-muted-foreground">{t("status.version")}</dt>
					<dd className="mt-0.5 font-mono">{state.version ?? "—"}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">{t("status.models")}</dt>
					<dd className="mt-0.5 font-mono">{state.summary.total}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">{t("models.images")}</dt>
					<dd className="mt-0.5 font-mono">{state.summary.imageCount}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">{t("status.synced")}</dt>
					<dd className="mt-0.5 font-mono">{published ? state.publishedCount : "—"}</dd>
				</div>
			</dl>

			<div className="mt-4 flex flex-wrap gap-2">
				<Button size="sm" onClick={onPublish} disabled={busy || state.phase !== "online"}>
					{t("actions.sync")}
				</Button>
				<Button variant="outline" size="sm" onClick={onDisconnect} disabled={busy || !published}>
					{t("actions.disconnect")}
				</Button>
				<Button variant="ghost" size="sm" onClick={onOpenConsole}>
					{t("actions.openConsole")}
				</Button>
			</div>

			{published && state.publishedAt ? (
				<p className="mt-3 text-xs text-muted-foreground">
					{t("status.synced")} · {new Date(state.publishedAt).toLocaleTimeString()}
				</p>
			) : null}
		</section>
	);
}
