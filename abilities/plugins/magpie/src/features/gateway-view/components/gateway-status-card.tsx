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
				<span className="flex items-center gap-2">
					<StatusDot tone={PHASE_TONE[state.phase]} pulse={state.phase === "probing"} />
					<span className="mp-heading normal-case tracking-normal" style={{ color: "var(--mp-text)" }}>
						{t("section.gateway")}
					</span>
					<span className="mp-meta normal-case tracking-normal">{t(`status.${state.phase}`)}</span>
				</span>
			}
			aside={<span className="mp-mono truncate">{state.endpoint}</span>}
		>
			{state.messageKey ? (
				<div
					className="mb-2 rounded-lg border px-2.5 py-1.5"
					style={{
						borderColor: "color-mix(in srgb, var(--destructive) 34%, transparent)",
						background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
					}}
				>
					<p className="mp-body font-medium" style={{ color: "var(--destructive)" }}>
						{t(state.messageKey)}
					</p>
					{state.failure === "unreachable" || state.failure === "timeout" ? (
						<p className="mp-meta mp-faint mt-0.5">{t("status.offlineHint")}</p>
					) : null}
				</div>
			) : null}

			<dl className="mp-strip">
				<Fact label={t("status.version")} value={state.version ?? "—"} />
				<Fact label={t("status.models")} value={state.summary.total} />
				<Fact label={t("models.images")} value={state.summary.imageCount} />
				<Fact label={t("status.synced")} value={published ? state.publishedCount : "—"} />
			</dl>

			<div className="mt-2.5 flex flex-wrap items-center gap-1.5">
				<Button onClick={onPublish} disabled={busy || !online}>
					{t("actions.sync")}
				</Button>
				<Button tone="outline" onClick={onDisconnect} disabled={busy || !published}>
					{t("actions.disconnect")}
				</Button>
				<Button tone="ghost" onClick={onOpenConsole}>
					{t("actions.openConsole")}
				</Button>
				{published && state.publishedAt ? (
					<span className="mp-meta mp-faint mp-num ml-auto">{new Date(state.publishedAt).toLocaleTimeString()}</span>
				) : null}
			</div>
		</PanelSection>
	);
}
