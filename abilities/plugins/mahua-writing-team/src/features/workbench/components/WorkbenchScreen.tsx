import { tryGetStudioRuntime } from "../../../plugin-context.js";
import { WorkbenchSurface } from "./WorkbenchSurface";

/**
 * 标签页的入口组件：只做一件事——确认运行时在，再交给 `WorkbenchSurface`。
 *
 * 为什么不在 `WorkbenchSurface` 里就地判：它整层都靠 hooks 拿事实，而 hooks 不能条件调用。
 * 运行时不在的唯一可能是宿主在 `activate` 之前就把标签渲染出来（热重载、插件被停用后再点开），
 * 这时不能抛错——抛了整块面板就是白的，而且错误落在宿主边界外，用户只会看到一个空标签。
 * 所以这里画一组不带文字的骨架条：没有 ctx 就没有 i18n，也就不假装有话说。
 */
export function WorkbenchScreen() {
	if (!tryGetStudioRuntime()) {
		return (
			<div className="mahua-root flex h-full min-h-0 flex-col gap-2 bg-canvas p-4">
				<div className="h-6 w-40 rounded-control bg-inset" />
				<div className="h-4 w-64 rounded-control bg-inset" />
				<div className="min-h-0 flex-1 rounded-panel bg-inset" />
			</div>
		);
	}
	return <WorkbenchSurface />;
}
