import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import type { GatewayController, MagpieState } from "../../../controller";
import { GatewayConnectionForm } from "./gateway-connection-form";
import { GatewayModelList } from "./gateway-model-list";
import { GatewaySetupCard } from "./gateway-setup-card";
import { GatewayStatusCard } from "./gateway-status-card";

const MODEL_ROW_LIMIT = 200;

interface GatewayViewProps {
	controller: GatewayController;
}

/**
 * 工作区视图：一整页，不绑定某一个对话。
 * 状态全部来自 controller；组件自身只持有「过滤器文本」这种纯 UI 状态。
 */
export function GatewayView({ controller }: GatewayViewProps) {
	const { t } = useTranslation();
	const [state, setState] = useState<MagpieState>(() => controller.getState());
	const [query, setQuery] = useState("");

	useEffect(() => {
		setState(controller.getState());
		const subscription = controller.subscribe(setState);
		return () => subscription.dispose();
	}, [controller]);

	const settings = controller.getSettings();

	return (
		<div className="flex h-full flex-col overflow-auto">
			<div className="drag-region h-6 shrink-0" />
			<div className="mx-auto w-full max-w-3xl space-y-4 px-6 pb-10">
				<header>
					<h1 className="text-lg font-semibold">{t("view.label")}</h1>
					<p className="mt-1 text-xs text-muted-foreground">{t("view.description")}</p>
				</header>

				<GatewayStatusCard
					state={state}
					onRefresh={() => void controller.refresh()}
					onPublish={() => void controller.publish()}
					onDisconnect={() => void controller.disconnect()}
					onOpenConsole={() => void controller.openConsole()}
				/>

				{state.phase === "offline" ? <GatewaySetupCard endpoint={state.endpoint} /> : null}

				<GatewayConnectionForm
					baseUrl={settings.baseUrl}
					apiKey={settings.apiKey}
					disabled={state.busy}
					onSave={(patch) => void controller.updateSettings(patch)}
				/>

				<GatewayModelList
					state={state}
					query={query}
					limit={MODEL_ROW_LIMIT}
					onQueryChange={setQuery}
				/>

				<section className="rounded-xl border border-border/70 bg-card/60 p-5">
					<h2 className="text-sm font-medium">{t("note.title")}</h2>
					<p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("note.body")}</p>
				</section>
			</div>
		</div>
	);
}
