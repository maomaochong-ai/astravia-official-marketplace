import { useStudioRuntimeReady } from "../hooks/use-studio-runtime-ready";
import { StudioBootSkeleton } from "./StudioBootSkeleton";
import { WorkbenchSurface } from "./WorkbenchSurface";

/**
 * 整页（宿主的 workspace view）的入口。与标签页同一道闸、同一块骨架，
 * 只有宿主给的画布不同。
 */
export function WorkbenchFullPage() {
	const ready = useStudioRuntimeReady();
	return ready ? <WorkbenchSurface mode="fullpage" /> : <StudioBootSkeleton />;
}
