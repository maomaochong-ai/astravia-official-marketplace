import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import type { GatewayController, MagpieState } from "../../../controller";
import { GatewayConnectionForm } from "./gateway-connection-form";
import { GatewayModelList } from "./gateway-model-list";
import { GatewaySetupCard } from "./gateway-setup-card";
import { GatewayStatusCard } from "./gateway-status-card";
import { Button, Panel, StatusDot } from "./ui";

const MODEL_ROW_LIMIT = 200;

interface GatewayViewProps {
	controller: GatewayController;
}

/**
 * 工作区视图：一整页，不绑定某一个对话。
 *
 * 0.4.1 的版面只有**一个**圆角容器，从上到下一列，节奏固定：
 *
 *   头部   —— 状态点 + 标题 + 一行副标题 + 唯一的主行动
 *   网关   —— 四格统计条 + 三个动作
 *   连接   —— 两个字段 + 保存
 *   运行环境 —— 状态行 + 动作 + 三格诊断
 *   模型   —— 过滤 + 表格
 *   脚注   —— 一句边界说明
 *
 * 为什么不再左右分栏：面板是可拖拽的 tab，半栏在 900px 窗口里只有约 400px，
 * 地址、路径这类长标识符必然被截断；单列时它们有整宽可用。分节靠发丝线，
 * 不靠空白。
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

	// 主行动：离线且没装 → 装并启动；离线但装了 → 启动；其余 → 重新检测。
	const primary = !online
		? runtime.binPath
			? { label: t("actions.startGateway"), run: () => void controller.startRuntime() }
			: { label: t("actions.installAndStart"), run: () => void controller.installAndStart() }
		: { label: state.busy ? t("actions.working") : t("actions.refresh"), run: () => void controller.refresh() };

	const subtitle = online
		? t("view.subtitleOnline", { count: state.summary.total, provider: state.summary.providers.length })
		: t("view.description");

	return (
		<div className="mp-root flex h-full min-h-0 flex-col overflow-hidden" style={{ background: "var(--background)" }}>
			<div className="drag-region h-4 shrink-0" />

			<div className="min-h-0 flex-1 overflow-auto px-3 pb-4 sm:px-4">
				<div className="mx-auto w-full max-w-[56rem]">
					<Panel
						title={
							<span className="flex min-w-0 items-center gap-2">
								<StatusDot tone={online ? "ok" : state.phase === "probing" ? "working" : "bad"} pulse={state.phase === "probing"} />
								<span className="mp-title truncate">{t("view.label")}</span>
							</span>
						}
						subtitle={subtitle}
						aside={
							<Button tone={online ? "outline" : "primary"} onClick={primary.run} disabled={installing || state.busy}>
								{primary.label}
							</Button>
						}
					>
						<GatewayStatusCard
							state={state}
							onPublish={() => void controller.publish()}
							onDisconnect={() => void controller.disconnect()}
							onOpenConsole={() => void controller.openConsole()}
						/>

						<GatewayConnectionForm controller={controller} disabled={state.busy} />

						{online && !runtimeBroken && !installing ? null : (
							<GatewaySetupCard
								state={state}
								onInstallAndStart={() => void controller.installAndStart()}
								onStart={() => void controller.startRuntime()}
								onStop={() => void controller.stopRuntime()}
							/>
						)}

						<GatewayModelList
							state={state}
							limit={MODEL_ROW_LIMIT}
							onOpenConsole={() => void controller.openConsole()}
						/>

						{state.catalogPartial ? (
							<div
								className="mp-meta mp-faint border-t px-3 py-2"
								style={{ borderColor: "var(--mp-rule)", color: "var(--mp-warn)" }}
							>
								{t("models.partial", { shown: state.summary.total })}
							</div>
						) : null}

						<p className="mp-meta mp-faint border-t px-3 py-2" style={{ borderColor: "var(--mp-rule)" }}>
							{t("note.body")}
						</p>
					</Panel>
				</div>
			</div>
		</div>
	);
}
