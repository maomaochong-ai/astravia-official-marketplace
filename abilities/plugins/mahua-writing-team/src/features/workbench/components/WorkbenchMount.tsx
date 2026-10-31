import { useStudioRuntimeReady } from "../hooks/use-studio-runtime-ready";
import { StudioBootSkeleton } from "./StudioBootSkeleton";
import { WorkbenchSurface } from "./WorkbenchSurface";

/**
 * 两个宿主位置共用的装配门：运行时没到位就先给骨架，到位即换。
 *
 * 宿主可能在 `activate` 之前就渲染界面（冷启动 / 热重载 / 停用后再点开），活动面板标签
 * 与工作区视图都会碰上这件事。两个入口各自写一次守卫，就必然有一个写得不对——工作区
 * 视图从前没有守卫，冷启动点「全屏」直接白屏：强制取运行时的下一下就抛了，子树不渲染。
 * 所以守卫只留在这里一处，`surface` 只决定挂哪种形态。
 */
export function WorkbenchMount({ surface = "panel" }: { surface?: "panel" | "page" }) {
	const ready = useStudioRuntimeReady();
	return ready ? <WorkbenchSurface surface={surface} /> : <StudioBootSkeleton />;
}
