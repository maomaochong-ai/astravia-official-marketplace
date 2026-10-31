/**
 * 启动骨架：运行时还没到时的占位。
 *
 * 不放文字——翻译要走运行时，这时正好没有；一块同形的纸比一句「正在启动」更不会撒谎。
 * 形状与真界面一致（一条窄栏 + 一张纸），出现时不跳。
 */
import { useHostMode } from "../hooks/use-host-mode";

export function StudioBootSkeleton() {
	const hostMode = useHostMode();

	return (
		<div className="mahua-root flex h-full min-h-0 gap-2 bg-canvas p-3" data-mahua-mode={hostMode}>
			<div className="hidden w-[208px] shrink-0 rounded-panel bg-inset/60 @min-[720px]:block" />
			<div className="flex min-h-0 flex-1 flex-col gap-3 rounded-sheet bg-surface p-4 shadow-raise">
				<div className="h-5 w-40 rounded-control bg-inset" />
				<div className="h-4 w-64 rounded-control bg-inset" />
				<div className="min-h-0 flex-1 rounded-panel bg-inset/70" />
			</div>
		</div>
	);
}
