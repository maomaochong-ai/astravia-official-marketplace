/**
 * 启动骨架：运行时还没到时的占位。
 *
 * 不放文字——翻译要走运行时，这时正好没有；一块同形的纸比一句「正在启动」更不会撒谎。
 * 形状必须与真界面逐层对齐：报头 48px、绕一圈 12px 托底、左边一条窄栏、右边一张纸。
 * 少一层，真界面一到纸面就要往下跳一次，那一下比空白更扎眼。
 *
 * 深浅两支不需要在这里判断：`.mahua-root` 的取值走 `light-dark()`，`color-scheme` 由宿主继承。
 */
export function StudioBootSkeleton() {
	return (
		<div className="@container mahua-root flex h-full min-h-0 w-full flex-col overflow-hidden bg-canvas">
			<div className="flex h-12 shrink-0 items-center gap-3 px-4">
				<div className="h-4 w-24 rounded-control bg-inset" />
				<div className="ml-5 h-3 w-40 rounded-control bg-inset/70" />
			</div>
			<div className="flex min-h-0 flex-1 items-stretch gap-2 pb-3 pl-2 pr-3 pt-3 @max-[640px]:gap-1.5 @max-[640px]:pb-2 @max-[640px]:pl-1.5 @max-[640px]:pr-2 @max-[640px]:pt-2">
				<div className="hidden w-[208px] shrink-0 rounded-sheet bg-inset/60 @min-[720px]:block" />
				<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-sheet bg-surface p-6 shadow-raise @max-[640px]:rounded-panel">
					<div className="h-5 w-40 shrink-0 rounded-control bg-inset" />
					<div className="h-4 w-64 shrink-0 rounded-control bg-inset/70" />
					<div className="mt-2 min-h-0 flex-1 rounded-panel bg-inset/70" />
				</div>
			</div>
		</div>
	);
}
