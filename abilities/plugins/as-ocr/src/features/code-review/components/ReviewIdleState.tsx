import type { JSX } from "react";

/** 空面板：说明怎么产生一次审查，以及首次使用会发生什么（自动装 ocr CLI）。 */
export function ReviewIdleState(): JSX.Element {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
			<span className="icon-[mdi--clipboard-check-outline] size-8 opacity-50" />
			<p className="text-sm">还没有审查记录</p>
			<p className="max-w-64 text-xs leading-5">
				在对话里让 agent「审查一下改动」，或直接说 code review——结果会出现在这里。
			</p>
			<p className="max-w-64 text-xs leading-5">
				首次使用会自动安装 ocr CLI（npm 全局包），进度显示在本面板顶部。
			</p>
		</div>
	);
}
