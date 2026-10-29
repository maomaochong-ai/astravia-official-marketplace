import { useTranslation } from "@astravia-org/plugin-sdk";
import { formatBytes } from "../../../../domain/report/report";
import { isHandoffFailure, type SampleFailure } from "../../sample-error";
import { AiButton } from "../shell/ai-button";
import { Icon } from "../shell/icon";

export interface BlockedPanelProps {
	failure: SampleFailure;
	/** 当前项目根；越界提示里要写清楚边界在哪。 */
	root: string | null;
	busy: boolean;
	onHandOff(): void;
	onClear(): void;
}

/**
 * 读不到样本时的说明页。
 *
 * 三种失败给三种出路：越界 → 说清项目根在哪；超限 → 说明面板与 Agent 的分工；
 * 其它 → 原样回显宿主报错，不做美化。
 */
export function BlockedPanel({ failure, root, busy, onHandOff, onClear }: BlockedPanelProps) {
	const { t } = useTranslation();
	const tooLarge = failure.kind === "too-large";
	// host-blocked 是宿主按 allowedRoots 拒掉的结果，与本地预检的 outside-project 是同一条出路。
	const outside = failure.kind === "outside-project" || failure.kind === "host-blocked";
	// 「能不能交给会话继续」只在领域层判一次，页面不自拼组合。
	const handoff = isHandoffFailure(failure.kind);

	const title = tooLarge ? t("blocked.tooLarge.title") : outside ? t("blocked.outside.title") : t("blocked.other.title");
	const body = tooLarge
		? t("blocked.tooLarge.body", { size: failure.size ? formatBytes(failure.size) : "—", limit: "32 MiB" })
		: outside
			? t("blocked.outside.body", { root: root ?? "—" })
			: t("blocked.other.body");

	return (
		<div className="rounded-lg border border-line bg-surface-2 p-4">
			<div className="flex items-start gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-risk-medium/12 text-risk-medium">
					<Icon name={tooLarge ? "chip" : outside ? "folder" : "alert"} className="size-4.5" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="text-[13px] font-medium text-text">{title}</div>
					<p className="mt-1 text-[11.5px] leading-relaxed text-text-3">{body}</p>
					<div className="mt-2 break-all rounded border border-line-subtle bg-surface px-2 py-1 font-mono text-[10.5px] text-text-3">{failure.detail}</div>
					{!tooLarge && !outside ? <p className="mt-2 text-[10.5px] leading-relaxed text-text-4">{t("blocked.other.hint")}</p> : null}

					<div className="mt-3 flex flex-wrap items-center gap-2">
						{handoff ? <AiButton label={t("blocked.handoff")} onClick={onHandOff} busy={busy} /> : null}
						<button
							type="button"
							onClick={onClear}
							className="rounded border border-line px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
						>
							{t("blocked.retry")}
						</button>
						{tooLarge ? <span className="text-[10px] text-text-4">{t("blocked.tooLarge.note")}</span> : null}
					</div>
				</div>
			</div>
		</div>
	);
}
