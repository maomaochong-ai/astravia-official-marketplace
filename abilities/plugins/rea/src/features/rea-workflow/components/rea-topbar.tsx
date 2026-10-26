/**
 * 顶栏：面包屑（工作区 / 当前目录 / 分节）+ 「宿主 AI 已连接」+ 面板全屏开关。
 *
 * 这里刻意没有「发送到对话」：顶栏不知道用户在做什么，一按下去发的是同一段文本。
 * 真正需要交接的地方各自有入口 —— 工作台卡片里有（带目标与目标类型），引擎自检页有
 * 「让 Agent 自检」（带的是引擎状态）。顶栏只承担导航与全局开关。
 *
 * 全屏是宿主能力 `setActivityPanelWidth("max")`：把活动面板拉到整个窗口宽，而不是
 * 浏览器全屏。按钮做成带文字、可 `aria-pressed` 的开关，按下后保持激活态，
 * 用户能看出「现在处于全屏」以及「再按一次会退出」。
 *
 * 面包屑里的目录用等宽字体并截断（`min-w-0` + `truncate`）：macOS 深层路径很长，
 * 不截断会把右侧按钮挤出可视区。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";

interface ReaTopbarProps {
	readonly sectionLabel: string;
	readonly cwd: string | null;
	readonly fullscreenAvailable: boolean;
	readonly fullscreen: boolean;
	readonly onToggleFullscreen: () => void;
}

export function ReaTopbar({
	sectionLabel,
	cwd,
	fullscreenAvailable,
	fullscreen,
	onToggleFullscreen,
}: ReaTopbarProps): JSX.Element {
	const { t } = useTranslation();

	return (
		<header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-2 px-4">
			<div className="flex min-w-0 items-center gap-1.5 text-caption">
				<span className="shrink-0 text-text-4">{t("ui.topbar.workspace")}</span>
				<span aria-hidden className="shrink-0 text-text-4">
					/
				</span>
				<span className="min-w-0 truncate font-mono text-text-3" title={cwd ?? t("ui.topbar.noCwd")}>
					{cwd ?? t("ui.topbar.noCwd")}
				</span>
				<span aria-hidden className="shrink-0 text-text-4">
					/
				</span>
				<span className="shrink-0 text-text-2">{sectionLabel}</span>
			</div>

			<div className="flex shrink-0 items-center gap-1.5">
				<span
					className="hidden items-center gap-1.5 rounded-md border border-purple/40 bg-purple/10 px-2.5 py-1 @min-[520px]:flex"
					title={t("ui.topbar.aiConnectedHint")}
				>
					<span aria-hidden className="size-1.5 rounded-full bg-purple" />
					<span className="whitespace-nowrap text-micro text-purple-ink">{t("ui.topbar.aiConnected")}</span>
				</span>

				{fullscreenAvailable ? (
					<button
						type="button"
						onClick={onToggleFullscreen}
						aria-pressed={fullscreen}
						title={t(fullscreen ? "tab.panel.restoreHint" : "tab.panel.fullscreenHint")}
						className={`inline-flex size-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 @min-[600px]:h-7 @min-[600px]:w-auto @min-[600px]:gap-1.5 @min-[600px]:px-2 ${
							fullscreen
								? "bg-surface-active text-text"
								: "text-text-3 hover:bg-surface-hover hover:text-text"
						}`}
					>
						<span
							aria-hidden
							className={`size-3.5 shrink-0 ${fullscreen ? "icon-[lucide--minimize]" : "icon-[lucide--maximize]"}`}
						/>
						<span className="whitespace-nowrap text-micro @max-[599px]:sr-only">
							{t(fullscreen ? "tab.panel.restore" : "tab.panel.fullscreen")}
						</span>
					</button>
				) : null}
			</div>
		</header>
	);
}
