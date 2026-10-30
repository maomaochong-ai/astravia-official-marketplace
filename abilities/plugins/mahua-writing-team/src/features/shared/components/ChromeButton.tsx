interface ChromeButtonProps {
	/** iconify class 字符串；与标签栏同一套图标源。 */
	icon: string;
	label: string;
	onClick: () => void;
}

/**
 * 顶栏上的入口按钮（ADR 0025 补注 / 0027 §1）。
 *
 * 只在两个入口之间换位：活动面板里的标签 ↔ 工作区视图。两者是同一个组件的两种
 * 挂载方式，样式跟激活页的返回键同一档——顶栏里的东西一律 7px 高的描边胶囊，
 * 不做主按钮，避免和页面里真正的主操作抢。
 */
export function ChromeButton({ icon, label, onClick }: ChromeButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex h-6 shrink-0 items-center gap-1 rounded-[7px] border border-border/70 px-2 text-[10.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			<span aria-hidden="true" className={`${icon} size-3`} />
			{label}
		</button>
	);
}
