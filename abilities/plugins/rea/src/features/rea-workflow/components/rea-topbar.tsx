/**
 * 顶栏：面包屑（工作区 / 当前目录 / 分节）+ 「宿主 AI 已连接」+ 主行动按钮。
 *
 * 主按钮不自己做交接逻辑，只把意图抛回容器：交接涉及 sendPrompt / insertPrompt
 * 两条回退通道和状态回执，全部在 useWorkbench 里，顶栏拿不到也不该拿。
 *
 * 面包屑里的目录用等宽字体并截断（`min-w-0` + `truncate`）：macOS 深层路径很长，
 * 不截断会把右侧按钮挤出可视区。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";

interface ReaTopbarProps {
	readonly sectionLabel: string;
	readonly cwd: string | null;
	readonly canSend: boolean;
	readonly sending: boolean;
	readonly onSend: () => void;
	readonly fullscreenAvailable: boolean;
	readonly fullscreen: boolean;
	readonly onToggleFullscreen: () => void;
	readonly sendHint: string;
}

export function ReaTopbar({
	sectionLabel,
	cwd,
	canSend,
	sending,
	onSend,
	fullscreenAvailable,
	fullscreen,
	onToggleFullscreen,
	sendHint,
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

				<button
					type="button"
					onClick={onSend}
					disabled={!canSend || sending}
					title={sendHint}
					className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-caption font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-45"
				>
					{sending ? (
						<span aria-hidden className="icon-[lucide--loader-circle] size-3.5 motion-safe:animate-spin" />
					) : (
						<span aria-hidden className="icon-[lucide--send] size-3.5" />
					)}
					<span className="@max-[420px]:sr-only">{t("ui.topbar.send")}</span>
				</button>

				{fullscreenAvailable ? (
					<button
						type="button"
						onClick={onToggleFullscreen}
						aria-pressed={fullscreen}
						title={t(fullscreen ? "tab.panel.restoreHint" : "tab.panel.fullscreenHint")}
						className="inline-flex size-7 items-center justify-center rounded-md text-text-3 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span
							aria-hidden
							className={`size-3.5 ${fullscreen ? "icon-[lucide--minimize]" : "icon-[lucide--maximize]"}`}
						/>
						<span className="sr-only">{t(fullscreen ? "tab.panel.restore" : "tab.panel.fullscreen")}</span>
					</button>
				) : null}
			</div>
		</header>
	);
}
