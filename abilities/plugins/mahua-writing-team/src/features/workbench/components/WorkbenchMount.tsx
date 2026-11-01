import { useEffect } from "react";
import { getStudioTranslator } from "../../../plugin-context.js";
import { useStudioRuntimeReady } from "../hooks/use-studio-runtime-ready";
import { StudioBootSkeleton } from "./StudioBootSkeleton";
import { WorkbenchBoundary } from "./WorkbenchBoundary";
import { WorkbenchNotice } from "./WorkbenchNotice";
import { WorkbenchSurface } from "./WorkbenchSurface";

/**
 * 装配门：运行时没到位就先给骨架，到位即换。
 *
 * 宿主可能在 `activate` 之前就渲染界面（冷启动 / 热重载 / 停用后再点开）。两个入口（活动面板
 * 文案与对话里的落章卡片）各自写一次守卫，就必然有一个写得不对——漏写的那个，冷启动时
 * 强制取运行时的下一下就抛了，整棵子树不渲染（白屏）。所以守卫只留在这里一处。
 *
 * 三条出口各自带 `data-mahua-state`：面板整块空白时，这条属性是「我们的子树到底挂上没挂上」
 * 的唯一判据。久等不到运行时不再静默——骨架会换成有字的等待页，同时仍在后台复查。
 */
export function WorkbenchMount() {
	const status = useStudioRuntimeReady();

	// 渲染层日志会落到主进程日志文件里，出问题时这是唯一不必开 DevTools 就能读到的痕迹。
	useEffect(() => {
		console.info("[mahua-writing-team] workbench mount state", status);
	}, [status]);

	const t = getStudioTranslator();

	return (
		<div
			className="mahua-root flex h-full min-h-[220px] w-full flex-col overflow-hidden"
			data-mahua-state={status}
		>
			{status === "ready" ? (
				// 运行时到位之后的炸点交给护栏：白屏面板既没有信息也没有出路，这里至少说清是哪一行。
				<WorkbenchBoundary>
					<WorkbenchSurface />
				</WorkbenchBoundary>
			) : status === "stalled" && t ? (
				<WorkbenchNotice title={t("window.starting")} hint={t("window.startingHint")} />
			) : (
				<StudioBootSkeleton />
			)}
		</div>
	);
}
