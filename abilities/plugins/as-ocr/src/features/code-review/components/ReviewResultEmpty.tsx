import type { JSX } from "react";

/**
 * 四种「没有发现」必须分开说，否则用户会把漏审当通过：
 *   clean             审完了，确实没发现问题
 *   nothing-to-review 本来就没有可审查的改动（工作区干净 / 全被规则排除）
 *   partial           有文件没取到 diff，这次结论不完整
 *   filtered          有发现，但全被当前筛选/标记隐藏了
 */
export type EmptyKind = "clean" | "nothing-to-review" | "partial" | "filtered";

const COPY: Record<EmptyKind, { icon: string; title: string; body: string; tone: string }> = {
	clean: {
		icon: "icon-[mdi--check-decagram-outline]",
		title: "没有需要修改的问题",
		body: "本次覆盖的改动没有发现可确认的缺陷。",
		tone: "text-emerald-500",
	},
	"nothing-to-review": {
		icon: "icon-[mdi--file-hidden]",
		title: "没有可审查的改动",
		body: "工作区没有未提交改动，或改动全部被 ocr 的规则排除（生成物、锁文件、二进制等）。",
		tone: "text-muted-foreground",
	},
	partial: {
		icon: "icon-[mdi--alert-outline]",
		title: "这次审查不完整",
		body: "有文件没取到 diff（宿主未授权 git 或超出预算），本次结论不能算通过。",
		tone: "text-amber-500",
	},
	filtered: {
		icon: "icon-[mdi--filter-off-outline]",
		title: "当前筛选下没有发现",
		body: "有发现，但都被级别/类别筛选或「已标记」隐藏了。",
		tone: "text-muted-foreground",
	},
};

export function ReviewResultEmpty({
	kind,
	onReset,
}: {
	kind: EmptyKind;
	onReset?: () => void;
}): JSX.Element {
	const copy = COPY[kind];
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
			<span className={`size-7 ${copy.icon} ${copy.tone}`} />
			<p className="text-sm text-foreground/90">{copy.title}</p>
			<p className="max-w-72 text-xs leading-5 text-muted-foreground">{copy.body}</p>
			{onReset ? (
				<button
					type="button"
					onClick={onReset}
					className="mt-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
				>
					重置筛选
				</button>
			) : null}
		</div>
	);
}
