/**
 * 竖向编号阶段轨道（宽面板用）。
 *
 * 与横向 StageStrip 是同一个信息的两套排布：
 *   宽面板 → 左栏竖向编号，编号圆盘本身表达「已过 / 正在 / 未开始 / 被越过」；
 *   窄面板 → 顶部横向六段轨道，省掉左侧一列。
 *
 * 状态来源只有真实信号：completed 来自会话里推进过的阶段，calls 来自真实工具调用，
 * bypassed 是「自己没有调用、下游已经调用」的阶段 —— 它不是完成，所以用虚线圈区分。
 */

import type { JSX } from "react";

export type StageRailState = "done" | "active" | "idle" | "bypassed";

export interface StageRailItem {
	readonly index: number;
	readonly label: string;
	readonly meta?: string;
	readonly state: StageRailState;
}

const DISC_CLASS: Record<StageRailState, string> = {
	done: "bg-sage-light text-sage-dark",
	active: "bg-primary text-primary-foreground",
	idle: "bg-mist text-faint",
	bypassed: "border border-dashed border-border-strong bg-transparent text-faint",
};

const ROW_CLASS: Record<StageRailState, string> = {
	done: "hover:bg-mist",
	active: "bg-accent text-foreground",
	idle: "hover:bg-mist",
	bypassed: "hover:bg-mist",
};

interface StageRailProps {
	readonly items: readonly StageRailItem[];
	readonly onSelect: (stage: number) => void;
	readonly ariaLabel: string;
}

export function ReaStageRail({ items, onSelect, ariaLabel }: StageRailProps): JSX.Element {
	return (
		<nav aria-label={ariaLabel} className="flex flex-col gap-0.5">
			{items.map((item) => (
				<button
					key={item.index}
					type="button"
					onClick={() => onSelect(item.index)}
					aria-current={item.state === "active" ? "step" : undefined}
					className={`group flex w-full items-center gap-2.5 rounded-tile px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${ROW_CLASS[item.state]}`}
				>
					<span
						aria-hidden
						className={`flex size-6 shrink-0 items-center justify-center rounded-pill font-mono text-micro-up leading-none tabular-nums ${DISC_CLASS[item.state]}`}
					>
						{item.state === "done" ? <span className="icon-[lucide--check] size-3" /> : String(item.index).padStart(2, "0")}
					</span>
					<span className="flex min-w-0 flex-col">
						<span className={`truncate text-caption leading-tight ${item.state === "active" ? "font-semibold text-foreground" : "text-foreground/85"}`}>
							{item.label}
						</span>
						{item.meta ? (
							<span className="mt-0.5 truncate text-micro-up leading-tight text-faint" title={item.meta}>
								{item.meta}
							</span>
						) : null}
					</span>
				</button>
			))}
		</nav>
	);
}
