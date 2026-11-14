import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import type { GatewayController, MagpieState } from "../../../controller";
import { GatewayConnectionForm } from "./gateway-connection-form";
import { GatewayModelList } from "./gateway-model-list";
import { GatewaySetupCard } from "./gateway-setup-card";
import { GatewayStatusCard } from "./gateway-status-card";
import { Button, Card, StatusDot } from "./ui";

const MODEL_ROW_LIMIT = 200;

interface GatewayViewProps {
	controller: GatewayController;
}

/**
 * 工作区视图：一整页，不绑定某一个对话。
 *
 * 布局按「先看结论、再看目录、出事再看运行环境」排：
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ 标题 · 状态胶囊 · 主行动（检测 / 一键装并启动） │  固定头部
 *   ├──────────────────────────┬────────────────────┤
 *   │ 网关状态 + 一键发布      │ 运行环境（诊断）    │
 *   │ 模型目录（滚动，可过滤）  │ 连接设置            │
 *   └──────────────────────────┴────────────────────┘
 *
 * 宽屏两栏、窄屏单栏；卡片本身只吃宿主的主题令牌（`bg-card` / `border-border` /
 * `text-muted-foreground` …），没有一处写死的背景色，所以跟随宿主亮/暗与主题包。
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
			<div className="drag-region h-6 shrink-0" />

			{/* 固定头部：状态与主行动永远在视野里，滚目录时也不会消失。 */}
			<header className="shrink-0 border-b border-border px-4 pb-3 sm:px-6">
				<div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3">
					<div className="min-w-0 flex-1">
						<h1 className="flex items-center gap-2 text-base font-semibold">
							<StatusDot
								tone={online ? "ok" : state.phase === "probing" ? "working" : "bad"}
								pulse={state.phase === "probing"}
							/>
							<span className="truncate">{t("view.label")}</span>
						</h1>
						<p className="mt-0.5 truncate text-xs text-muted-foreground">
							{online
								? t("view.subtitleOnline", { count: state.summary.total, provider: state.summary.providers.length })
								: t("view.description")}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Button tone="outline" size="sm" onClick={() => void controller.refresh()} disabled={state.busy}>
							{t("actions.refresh")}
						</Button>
						<Button size="sm" onClick={primary.run} disabled={installing || state.busy}>
							{primary.label}
						</Button>
					</div>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-auto px-4 pb-8 pt-4 sm:px-6">
				<div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
					<div className="flex min-w-0 flex-col gap-4">
						<GatewayStatusCard
							state={state}
							onRefresh={() => void controller.refresh()}
							onPublish={() => void controller.publish()}
							onDisconnect={() => void controller.disconnect()}
							onOpenConsole={() => void controller.openConsole()}
						/>
						<GatewayModelList state={state} limit={MODEL_ROW_LIMIT} />
					</div>

					<div className="flex min-w-0 flex-col gap-4">
						{needsSetup ? (
							<GatewaySetupCard
								state={state}
								onInstallAndStart={() => void controller.installAndStart()}
								onStart={() => void controller.startRuntime()}
								onStop={() => void controller.stopRuntime()}
							/>
						) : null}
						<GatewayConnectionForm controller={controller} disabled={state.busy} />
						<Card title={t("note.title")}>
							<p className="text-xs leading-relaxed text-muted-foreground">{t("note.body")}</p>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
