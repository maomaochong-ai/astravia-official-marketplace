import { useTranslation } from "@astravia-org/plugin-sdk";
import type { MagpieState } from "../../../controller";
import { Button, Card, Fact, StatusDot } from "./ui";

const PHASE_TONE: Record<MagpieState["phase"], "ok" | "working" | "bad" | "idle"> = {
	idle: "idle",
	probing: "working",
	online: "ok",
	offline: "bad",
};

interface StatusCardProps {
	state: MagpieState;
	onRefresh: () => void;
	onPublish: () => void;
	onDisconnect: () => void;
	onOpenConsole: () => void;
}

/**
 * 第一块：网关在不在、什么版本、有多少模型、有没有写进 Astravia。
 *
 * 失败时不再只丢一个红色 key：把「探的是哪个地址、为什么失败、下一步该点哪个按钮」
 * 放在同一块里，用户不必在两块卡片之间自己拼因果。
 */
export function GatewayStatusCard({ state, onRefresh, onPublish, onDisconnect, onOpenConsole }: StatusCardProps) {
	const { t } = useTranslation();
	const busy = state.busy;
	const published = typeof state.publishedCount === "number";
	const online = state.phase === "online";

	return (
		<Card
			title={
				<span className="flex items-center gap-2">
					<StatusDot tone={PHASE_TONE[state.phase]} pulse={state.phase === "probing"} />
					<span className="truncate">{t(`status.${state.phase}`)}</span>
				</span>
			}
			aside={
				<Button tone="outline" size="sm" onClick={onRefresh} disabled={busy}>
					{busy ? t("actions.working") : t("actions.refresh")}
				</Button>
			}
		>
			<p className="truncate font-mono text-xs text-muted-foreground">{state.endpoint}</p>

			{state.messageKey ? (
				<div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
					<p className="text-xs font-medium text-destructive">{t(state.messageKey)}</p>
					{state.failure === "unreachable" || state.failure === "timeout" ? (
						<p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("status.offlineHint")}</p>
					) : null}
				</div>
			) : null}

			<dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Fact label={t("status.version")} value={state.version ?? "—"} />
				<Fact label={t("status.models")} value={state.summary.total} />
				<Fact label={t("models.images")} value={state.summary.imageCount} />
				<Fact label={t("status.synced")} value={published ? state.publishedCount : "—"} />
			</dl>

			<div className="mt-3 flex flex-wrap items-center gap-2">
				<Button size="sm" onClick={onPublish} disabled={busy || !online}>
					{t("actions.sync")}
				</Button>
				<Button tone="outline" size="sm" onClick={onDisconnect} disabled={busy || !published}>
					{t("actions.disconnect")}
				</Button>
				<Button tone="ghost" size="sm" onClick={onOpenConsole}>
					{t("actions.openConsole")}
				</Button>
				{published && state.publishedAt ? (
					<span className="ml-auto text-[11px] text-muted-foreground">
						{new Date(state.publishedAt).toLocaleTimeString()}
					</span>
				) : null}
			</div>
		</Card>
	);
}
