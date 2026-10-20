import { useTranslation } from "@astravia-org/plugin-sdk";

export interface PanelHeaderProps {
	guideOpen: boolean;
	onToggleGuide: () => void;
}

/**
 * 面板常驻头部。结果页会把首屏说明挤走，所以「这个面板能做什么」必须有一个不随状态消失的入口。
 */
export function PanelHeader({ guideOpen, onToggleGuide }: PanelHeaderProps) {
	const { t } = useTranslation();
	return (
		<header className="flex shrink-0 items-center gap-2 border-b border-black/[0.07] px-3 py-2 dark:border-white/10">
			<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-foreground/[0.07] text-foreground/60">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-3 w-3" aria-hidden>
					<path d="M12 3l7 3v5c0 4.4-2.9 8.3-7 10-4.1-1.7-7-5.6-7-10V6l7-3z" strokeLinejoin="round" />
					<path d="M9.2 12.1l2 2L15 9.7" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate text-[12px] font-semibold leading-tight text-foreground/80">{t("plugin.name")}</p>
				<p className="truncate text-[10px] leading-tight text-foreground/40">{t("panel.header.subtitle")}</p>
			</div>
			<button
				type="button"
				onClick={onToggleGuide}
				aria-pressed={guideOpen}
				className={`shrink-0 rounded border px-2 py-1 text-[10.5px] font-medium transition-colors ${
					guideOpen
						? "border-foreground/25 bg-foreground/[0.06] text-foreground/75"
						: "border-black/10 text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground/80 dark:border-white/10"
				}`}
			>
				{guideOpen ? t("panel.header.guideClose") : t("panel.header.guide")}
			</button>
		</header>
	);
}
