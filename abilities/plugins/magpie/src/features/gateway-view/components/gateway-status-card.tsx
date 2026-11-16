import { useTranslation } from "@astravia-org/plugin-sdk";
import type { MagpieState } from "../../../controller";
import { Button, Fact, PanelSection, StatusDot } from "./ui";

const PHASE_TONE: Record<MagpieState["phase"], "ok" | "working" | "bad" | "idle"> = {
	idle: "idle",
	probing: "working",
	online: "ok",
	offline: "bad",
};

interface StatusSectionProps {
	state: MagpieState;
	onPublish: () => void;
	onDisconnect: () => void;
	onOpenConsole: () => void;
}

/**
 * 第一段：网关在不在、什么版本、多少模型、有没有写进 Astravia。
 *
 * 这一段不再自带「重新检测」——那个动作在整页唯一的头部，出现两次只会让读者挑一个猜。
 * 失败时的下一步也并进同一段：地址、原因、该点哪个按钮，都在视线里。
 */
export function GatewayStatusCard({ state, onPublish, onDisconnect, onOpenConsole }: StatusSectionProps) {
	const { t } = useTranslation();
	const busy = state.busy;
	const published = typeof state.publishedCount === "number";
	const online = state.phase === "online";

	return (
		<PanelSection
			title={
				<span className="flex items-center gap-2 normal-case tracking-normal">
					<StatusDot tone={PHASE_TONE[state.phase]} pulse={state.phase === "probing"} />
					<span className="text-xs font-medium text-foreground">{t("section.gateway")}</span>
					<span className="text-[11px] font-normal text-muted-foreground">{t(`status.${state.phase}`)}</span>
				</span>
			}
			aside={<span className="truncate font-mono text-[11px] text-muted-foreground">{state.endpoint}</span>}
		>
			{state.messageKey ? (
				<div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
					<p className="text-xs font-medium text-destructive">{t(state.messageKey)}</p>
					{state.failure === "unreachable" || state.failure === "timeout" ? (
						<p className="mt-1 text-[11px] text-muted-foreground">{t("status.offlineHint")}</p>
					) : null}
				</div>
			) : null}

			<dl className="grid grid-cols-2 gap-3 @[26rem]:grid-cols-4">
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
		</PanelSection>
	);
}
