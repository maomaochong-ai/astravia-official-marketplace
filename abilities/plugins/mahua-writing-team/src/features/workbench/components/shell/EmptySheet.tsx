/**
 * 空的纸：没有书、没有伏笔、没有事件时都长这样。
 *
 * 只说明「现在没有」，不接着许诺「点击下面的按钮开始」或给一枚去处按钮——工作台的创建动作
 * 与「看它写」都在侧栏对话里，空态里多一枚键只会多一个会失效的入口。
 */
export function EmptySheet({ icon, title, note }: { icon: string; title: string; note?: string }) {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-line px-6 py-10 text-center">
			<span className={`${icon} size-5 text-ink-faint`} />
			<p className="text-body-sm font-medium text-ink">{title}</p>
			{note && <p className="max-w-[36ch] text-micro leading-5 text-ink-soft">{note}</p>}
		</div>
	);
}
