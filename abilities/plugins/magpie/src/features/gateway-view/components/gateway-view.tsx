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
 * 0.4.0 的版面只有**一个**圆角容器：
 *
 *  1. **一框到底**：以前左一卡、右一卡，中间一条 gap；窄屏时那条 gap 就是纯损失，而且
 *     读者要在两块之间自己拼因果（地址在右、状态在左）。现在所有设置都在这一个框里，
 *     框内按「网关 → 连接 → 模型 → 运行环境」分节，节与节之间用发丝线，节内再嵌自己的
 *     圆角输入框 / 表格 / 提示框。
 *  2. **一个动作只出现一次**：「重新检测」只留在头部；状态段不再重复同一个按钮。
 *  3. **说明只写必须写的**：长段落换成一句，指向性的话（点哪儿、缺什么）留在原地，
 *     解释性的废话删掉。
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

	const subtitle = online
		? t("view.subtitleOnline", { count: state.summary.total, provider: state.summary.providers.length })
		: t("view.description");

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
			<div className="drag-region h-5 shrink-0" />

			<div className="min-h-0 flex-1 overflow-auto px-3 py-2.5 sm:px-4">
				<div className="mx-auto w-full max-w-4xl">
					<Panel
						title={
							<span className="flex min-w-0 items-center gap-2">
								<StatusDot tone={online ? "ok" : state.phase === "probing" ? "working" : "bad"} pulse={state.phase === "probing"} />
								<span className="truncate text-sm font-semibold">{t("view.label")}</span>
							</span>
						}
						subtitle={subtitle}
						aside={
							<Button size="sm" tone={online ? "outline" : "primary"} onClick={primary.run} disabled={installing || state.busy}>
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

						{/* 连接与运行环境都是「这台网关」，并排成一节里的两栏；没有运行环境段时连接占满整宽。
						    并排时用竖线分隔，且第二栏不再保留那条上边线。 */}
						<div
							className={`grid border-t border-border/70 first:border-t-0 ${
								needsSetup ? "@lg:grid-cols-2 @lg:[&>*+*]:border-t-0 @lg:[&>*+*]:border-l @lg:[&>*+*]:border-border/70" : ""
							}`}
						>
							<GatewayConnectionForm controller={controller} disabled={state.busy} />
							{needsSetup ? (
								<GatewaySetupCard
									state={state}
									onInstallAndStart={() => void controller.installAndStart()}
									onStart={() => void controller.startRuntime()}
									onStop={() => void controller.stopRuntime()}
								/>
							) : null}
						</div>

						<GatewayModelList state={state} limit={MODEL_ROW_LIMIT} />

						<p className="border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">{t("note.body")}</p>
					</Panel>
				</div>
			</div>
		</div>
	);
}
