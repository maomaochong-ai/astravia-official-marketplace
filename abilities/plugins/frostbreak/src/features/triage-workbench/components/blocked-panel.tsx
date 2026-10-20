import { useTranslation } from "@astravia-org/plugin-sdk";
import type { SampleFailure } from "../sample-error";
import { describeSampleFailure } from "../sample-error";

export interface BlockedPanelProps {
	failure: SampleFailure;
	/** 用来在「项目外」文案里点名当前项目根。 */
	root: string | null;
	/** 没有工作区目录时，Agent 也起不来会话，所以按钮置灰并说明原因。 */
	hasWorkspace: boolean;
	busy: boolean;
	onHandOff: () => void;
	onCopyPath: () => void;
}

/**
 * 项目外 / 超出宿主读取上限的样本不是死路：宿主 Agent 有完整的文件权限，能在对话里接着查。
 * 这块面板只做一件事——把「为什么引擎看不了」说清楚，并给一个能继续的按钮。
 */
export function BlockedPanel({ failure, root, hasWorkspace, busy, onHandOff, onCopyPath }: BlockedPanelProps) {
	const { t } = useTranslation();
	return (
		<div className="mx-auto flex w-full max-w-[460px] flex-col gap-2 px-6 py-6">
			<div className="space-y-1">
				<h2 className="text-[13px] font-semibold text-foreground/85">{t("panel.blocked.title")}</h2>
				<p className="break-words rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
					{describeSampleFailure(failure, t, root)}
				</p>
				<p className="text-[10.5px] leading-relaxed text-foreground/45">{t("panel.blocked.why")}</p>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				<button
					type="button"
					onClick={onHandOff}
					disabled={!hasWorkspace || busy}
					className="rounded bg-foreground px-2.5 py-1 text-[11px] font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
				>
					{t("panel.blocked.handoff")}
				</button>
				<button
					type="button"
					onClick={onCopyPath}
					className="rounded border border-black/10 px-2 py-1 text-[11px] text-foreground/65 transition-colors hover:bg-foreground/[0.06] hover:text-foreground dark:border-white/10"
				>
					{t("panel.blocked.copyPath")}
				</button>
			</div>

			{hasWorkspace ? null : <p className="text-[10.5px] leading-relaxed text-foreground/40">{t("panel.blocked.noWorkspace")}</p>}
		</div>
	);
}
