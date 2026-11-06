import { useCallback, useEffect, useRef, useState } from "react";
import { useActivityTab, useTranslation, type PluginContext } from "@astravia-org/plugin-sdk";
import { AutomationOverlay } from "./automation-overlay";
import { BoardmixSurface } from "./boardmix-surface";
import { useBoardmixEntry } from "../hooks/use-boardmix-entry";
import { usePromptAttachment } from "../hooks/use-prompt-attachment";
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
	const { cwd, active } = useActivityTab();
	// 截图要落在项目里，而工具侧拿不到 cwd：由面板把当前 scope 交过去。
	useEffect(() => {
		setBoardmixWorkspace(cwd);
	}, [cwd]);
	const entry = useBoardmixEntry(ctx);
	const surfaceRef = useRef<BoardmixTabHandle | null>(null);

	// 面板自己会跳转，工具侧看不到它去了哪里；落一次记一次，胶囊里写的就是这个地址。
	const [landedUrl, setLandedUrl] = useState<string | null>(null);
	const onLanded = useCallback(
		(url: string, landedAt: string) => {
			setLandedUrl(url);
			entry.persistLanded(url, landedAt);
		},
		[entry],
	);

	usePromptAttachment(ctx, {
		active: active === true,
		ready: entry.ready,
		landedUrl: landedUrl ?? entry.ladder[0]?.url ?? null,
		label: t("tab.title"),
	});

	useEffect(() => {
		// Only the unmount half lives here: the surface registers itself through the ref
		// below the moment it mounts. Waiting for `entry.ready` was the bug — that flag
		// means "storage read", not "webview attached", so a panel opened by a tool call
		// stayed invisible to every tool until the user clicked the tab by hand.
		return () => setBoardmixTab(null);
	}, []);

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
					setBoardmixTab(element);
				}}
				ladder={entry.ladder}
				onLanded={onLanded}
				openExternal={entry.openExternal}
				translate={t}
			/>
		</div>
	);
}
