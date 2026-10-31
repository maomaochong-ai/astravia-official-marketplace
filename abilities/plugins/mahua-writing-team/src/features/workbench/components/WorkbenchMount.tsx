import { useStudioRuntimeReady } from "../hooks/use-studio-runtime-ready";
import { StudioBootSkeleton } from "./StudioBootSkeleton";
import { WorkbenchSurface } from "./WorkbenchSurface";

/**
 * 装配门：运行时没到位就先给骨架，到位即换。
 *
 * 宿主可能在 `activate` 之前就渲染界面（冷启动 / 热重载 / 停用后再点开）。两个入口（活动面板
 * 文案与对话里的落章卡片）各自写一次守卫，就必然有一个写得不对——漏写的那个，冷启动时
 * 强制取运行时的下一下就抛了，整棵子树不渲染（白屏）。所以守卫只留在这里一处。
 */
export function WorkbenchMount() {
	const ready = useStudioRuntimeReady();
	return ready ? <WorkbenchSurface /> : <StudioBootSkeleton />;
}
