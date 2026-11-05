import { useEffect, useRef } from "react";
import { useTranslation, type PluginContext } from "@astravia-org/plugin-sdk";
import { BoardmixSurface } from "./boardmix-surface";
import { useBoardmixEntry } from "../hooks/use-boardmix-entry";
import { setBoardmixTab, type BoardmixTabHandle } from "../services/tab-registry";

export interface BoardmixWorkspaceProps {
	ctx: PluginContext;
}

/**
 * 活动面板的内容根：把「阶梯怎么来」和「webview 怎么走」接起来，
 * 并把句柄交给工具层。组件本身不决定任何地址。
 */
export function BoardmixWorkspace({ ctx }: BoardmixWorkspaceProps) {
	const { t } = useTranslation();
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
		<BoardmixSurface
			ref={element => {
				surfaceRef.current = element;
			}}
			ladder={entry.ladder}
			onLanded={entry.persistLanded}
			openExternal={entry.openExternal}
			translate={t}
		/>
	);
}
