import { useStudioRuntimeReady } from "../hooks/use-studio-runtime-ready";
import { StudioBootSkeleton } from "./StudioBootSkeleton";
import { WorkbenchSurface } from "./WorkbenchSurface";

/**
 * 标签页的入口。
 *
 * 宿主可能在 `activate` 之前就渲染标签（冷启动 / 热重载 / 停用后再点开），所以这里
 * 只在运行时确认到位后才挂载工作台；否则先给一块同形的纸，到位即换。
 */
export function WorkbenchScreen() {
	const ready = useStudioRuntimeReady();
	return ready ? <WorkbenchSurface mode="panel" /> : <StudioBootSkeleton />;
}
