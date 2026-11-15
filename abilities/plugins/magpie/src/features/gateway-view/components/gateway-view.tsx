import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import type { GatewayController, MagpieState } from "../../../controller";
import { GatewayConnectionForm } from "./gateway-connection-form";
import { GatewayModelList } from "./gateway-model-list";
import { GatewaySetupCard } from "./gateway-setup-card";
import { GatewayStatusCard } from "./gateway-status-card";
import { Button, StatusDot } from "./ui";

const MODEL_ROW_LIMIT = 200;

interface GatewayViewProps {
	controller: GatewayController;
}

/**
 * 工作区视图：一整页，不绑定某一个对话。
 *
 * 0.3.0 重排的三条规矩：
 *
 *  1. **嵌套而不是平铺**：每列是一个带外框的容器，里面的卡片彼此只隔一条发丝线，
 *     不再用 `gap-4` 在卡与卡之间留白——留白在窄屏里就是被浪费的高度。
 *  2. **头部只占一条**：标题、状态、两个动作同一行；窗口窄了动作换行，但头部本身不涨高。
 *  3. **一列一职责**：左列「现在能不能用 + 有哪些模型」，右列「怎么装/怎么连 + 说明」。
 *     宽屏 1.45fr / 1fr，窄屏单列，顺序不变（先结论后设置）。
 */
export function GatewayView({ controller }: GatewayViewProps) {
	const { t } = useTranslation();
	const [state, setState] = useState<MagpieState>(() => controller.getState());

	useEffect(() => {
		setState(controller.getState());
		const subscription = controller.subscribe(setState);
		return () => subscription.dispose();
	}, [controller]);

	const runtime = state.runtime;
	const installing = runtime.phase === "downloading" || runtime.phase === "starting" || runtime.phase === "checking";
	const online = state.phase === "online";
	const runtimeBroken = runtime.phase === "failed" || runtime.phase === "absent";
	const needsSetup = !online || runtimeBroken || installing;

	// 主行动：离线且没装 → 装并启动；离线但装了 → 启动；其余 → 重新检测。
	const primary = !online
		? runtime.binPath
			? { label: t("actions.startGateway"), run: () => void controller.startRuntime() }
			: { label: t("actions.installAndStart"), run: () => void controller.installAndStart() }
		: { label: state.busy ? t("actions.working") : t("actions.refresh"), run: () => void controller.refresh() };

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
			<div className="drag-region h-5 shrink-0" />

			{/* 头部一条：状态与主行动永远在视野里，滚目录时也不会消失。 */}
			<header className="shrink-0 border-b border-border px-3 py-2 sm:px-4">
				<div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5">
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<StatusDot tone={online ? "ok" : state.phase === "probing" ? "working" : "bad"} pulse={state.phase === "probing"} />
						<h1 className="truncate text-sm font-semibold">{t("view.label")}</h1>
						{/* 副标题跟在标题后面而不是下面：省一行高度，宽屏读起来也更连贯。 */}
						<p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
							{online ? t("view.subtitleOnline", { count: state.summary.total, provider: state.summary.providers.length }) : t("view.description")}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						<Button tone="outline" size="sm" onClick={() => void controller.refresh()} disabled={state.busy}>
							{t("actions.refresh")}
						</Button>
						<Button size="sm" onClick={primary.run} disabled={installing || state.busy}>
							{primary.label}
						</Button>
					</div>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-auto px-3 py-2.5 sm:px-4">
				<div className="mx-auto grid w-full max-w-6xl items-start gap-2.5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
					{/* 左列：结论 + 目录。两块合成一个外框，中间一条线。 */}
					<div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-muted/20">
						<GatewayStatusCard
							state={state}
							onRefresh={() => void controller.refresh()}
							onPublish={() => void controller.publish()}
							onDisconnect={() => void controller.disconnect()}
							onOpenConsole={() => void controller.openConsole()}
						/>
						<div className="min-h-0 flex-1">
							<GatewayModelList state={state} limit={MODEL_ROW_LIMIT} />
						</div>
					</div>

					{/* 右列：怎么装、怎么连、看什么。同一外框，三节用发丝线隔开。 */}
					<div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-muted/20">
						{needsSetup ? (
							<GatewaySetupCard
								state={state}
								onInstallAndStart={() => void controller.installAndStart()}
								onStart={() => void controller.startRuntime()}
								onStop={() => void controller.stopRuntime()}
							/>
						) : null}
						<GatewayConnectionForm controller={controller} disabled={state.busy} />
						<p className="border-t border-border/70 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">{t("note.body")}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
