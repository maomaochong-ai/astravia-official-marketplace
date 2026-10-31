/**
 * 空的纸：没有书、没有伏笔、没有事件时都长这样。
 *
 * 只说明「现在没有」，不接着许诺「点击下面的按钮开始」或给一枚去处按钮——工作台的创建动作
 * 与「看它写」都在侧栏对话里，空态里多一枚键只会多一个会失效的入口。
 *
 * 从前这里是一圈虚线框。虚线在整套纸面语言里没有第二个用处，看起来像「这块还在加载」；
 * 现在它是一个圆角凹槽（`.mahua-well`），和台账的统计格、书房的「现在在写」同一档。
 */
export function EmptySheet({ icon, title, note }: { icon: string; title: string; note?: string }) {
	return (
		<div className="mahua-well flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
			<span className={`${icon} size-5 text-ink-faint`} />
			<p className="text-body-sm font-medium text-ink">{title}</p>
			{note && <p className="max-w-[36ch] text-micro leading-5 text-ink-soft">{note}</p>}
		</div>
	);
}
