import { useTranslation } from "@astravia-org/plugin-sdk";
import type { WorkbenchModel } from "../../hooks/use-workbench";

/**
 * 面板主流程的横向引导条：样本 → 分析 → 取证 → 工具与安装。
 *
 * 它不是静态装饰，而是把「流程现在走到哪一步、下一步该去哪一页」用可点击
 * 的步骤表达出来。每步的可用性由当前模型状态推出：没有样本时分析/取证是
 * 锁的，装了工具前自检页是下一步要去的地方。
 */
export interface WorkflowBarProps {
	model: WorkbenchModel;
}

interface Step {
	id: "setup" | "pick" | "analyse" | "forensic" | "toolbox";
	/** 可用时点击跳转的目标页。 */
	page: "overview" | "findings" | "compare" | "selfcheck";
	/** 是否已满足前置条件（点亮而不是锁住）。 */
	ready: boolean;
}

export function WorkflowBar({ model }: WorkflowBarProps) {
	const { t } = useTranslation();
	const hasSample = model.report !== null;
	const hasFindings = (model.report?.findings.length ?? 0) > 0;

	const steps: Step[] = [
		{ id: "setup", page: "selfcheck", ready: true },
		{ id: "pick", page: "overview", ready: hasSample },
		{ id: "analyse", page: "findings", ready: hasFindings },
		{ id: "forensic", page: "compare", ready: hasFindings },
		{ id: "toolbox", page: "selfcheck", ready: true },
	];

	return (
		// 通栏直角带与面板里的圆角卡片不是一套语言：改成同形的圆角带（无下边框）。
		<div className="mb-1 flex items-center gap-0.5 rounded-xl bg-surface-2 px-1.5 py-1.5 ring-1 ring-line-subtle">
			{steps.map((step, index) => {
				const active = model.page === step.page;
				return (
					<button
						key={step.id}
						type="button"
						onClick={() => model.go(step.page)}
						disabled={!step.ready}
						aria-current={active ? "step" : undefined}
						className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors ${
							active
								? "bg-surface-active text-text"
								: step.ready
									? "text-text-2 hover:bg-surface-hover hover:text-text"
									: "cursor-not-allowed text-text-4 opacity-50"
						}`}
					>
						<span
							className={`flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10.5px] ${
								active ? "bg-purple text-white" : step.ready ? "bg-surface-4 text-text-2" : "bg-surface-3 text-text-4"
							}`}
						>
							{index + 1}
						</span>
						<span className="truncate text-[11.5px] font-medium" title={t(`workflow.${step.id}.title`)}>{t(`workflow.${step.id}.title`)}</span>
					</button>
				);
			})}
		</div>
	);
}