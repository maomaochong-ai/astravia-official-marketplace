import { useEffect, useRef } from "react";
import { useActivityTab, useTranslation, type PluginContext } from "@astravia-org/plugin-sdk";
import { AutomationOverlay } from "./automation-overlay";
import { BoardmixSurface } from "./boardmix-surface";
import { useBoardmixEntry } from "../hooks/use-boardmix-entry";
import { setBoardmixTab, type BoardmixTabHandle } from "../services/tab-registry";
import { setBoardmixWorkspace } from "../services/workspace-cwd";

export interface BoardmixWorkspaceProps {
	ctx: PluginContext;
}

/**
 * 活动面板的内容根：把「阶梯怎么来」和「webview 怎么走」接起来，
 * 并把句柄交给工具层。组件本身不决定任何地址。
 */
export function BoardmixWorkspace({ ctx }: BoardmixWorkspaceProps) {
	const { t } = useTranslation();
	const { cwd } = useActivityTab();
	// 截图要落在项目里，而工具侧拿不到 cwd：由面板把当前 scope 交过去。
	useEffect(() => {
		setBoardmixWorkspace(cwd);
	}, [cwd]);
	const entry = useBoardmixEntry(ctx);
	const surfaceRef = useRef<BoardmixTabHandle | null>(null);

	useEffect(() => {
		if (!entry.ready) return;
		const handle = surfaceRef.current;
		if (!handle) return;
		setBoardmixTab(handle);
		return () => setBoardmixTab(null);
	}, [entry.ready]);

	if (!entry.ready) {
		return (
			<div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
				{t("panel.loading")}
			</div>
		);
	}

	return (
		<div className="relative flex h-full w-full flex-col">
			<AutomationOverlay ctx={ctx} translate={t} />
			<BoardmixSurface
				ref={element => {
					surfaceRef.current = element;
				}}
				ladder={entry.ladder}
				onLanded={entry.persistLanded}
				openExternal={entry.openExternal}
				translate={t}
			/>
		</div>
	);
}
