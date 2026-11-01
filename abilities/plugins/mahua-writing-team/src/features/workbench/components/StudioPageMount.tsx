import { useEffect } from "react";
import { forgetStudioFullscreen } from "../fullscreen";
import { useStudioRuntimeReady } from "../hooks/use-studio-runtime-ready";
import { useWorkspaceViewTitle } from "../hooks/use-workspace-view-title";
import { StudioBootSkeleton } from "./StudioBootSkeleton";
import { WorkbenchSurface } from "./WorkbenchSurface";

/**
 * 整页挂载门：与活动面板里的 `WorkbenchMount` 共用同一张工作台，只换 `mode`。
 *
 * 不另写一份界面：两份界面必然有一份先腐烂。差别只有三处——没有面板宽度可调、
 * 报头那枚键变成「退出全屏」、Esc 也变成退出。
 *
 * 卸载时把「这次是从标签页进来的」抹掉（`forgetStudioFullscreen`）：页面已经不在整页形态，
 * 那个标记再留着就会让下一次进入的人拿到一枚指向无关页面的退出键。
 */
export function StudioPageMount() {
	const ready = useStudioRuntimeReady();
	useWorkspaceViewTitle();
	useEffect(() => () => forgetStudioFullscreen(), []);
	return ready ? <WorkbenchSurface mode="page" /> : <StudioBootSkeleton />;
}
