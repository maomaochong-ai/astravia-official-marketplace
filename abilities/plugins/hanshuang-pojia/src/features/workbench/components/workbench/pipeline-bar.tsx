import { useTranslation } from "@astravia-org/plugin-sdk";
import type { WorkbenchModel } from "../../hooks/use-workbench";

/**
 * Overview 的流水线状态条（G2）。
 *
 * 与跨页导航的 WorkflowBar 不同，这一条反映「当前样本走完多远」：四段
 * 画像 → 控制流 → 智库 → 验证，全部由模型里可观察的状态推出，不造假进度：
 * - 画像：报告已生成（有格式识别 / 风险评分）。
 * - 控制流：发现列表非空（引擎已产出控制流与调用证据）。
 * - 智库：知识库文档可浏览（docs 页可用），点击进入智库页。
 * - 验证：签名校验 / 工具链自检状态可见，点击进入自检页。
 *
 * 无样本时整条显示「等待样本」，四段灰掉，不为缺数据编造完成态。
 */
export interface PipelineBarProps {
	model: WorkbenchModel;
}

interface Stage {
	id: "profile" | "controlflow" | "knowledge" | "verify";
	/** 点亮条件：为该段注入真实状态。 */
	lit: boolean;
	/** 点击跳转的目标页；lit 才可点。 */
	page: "overview" | "findings" | "docs" | "selfcheck";
}

export function PipelineBar({ model }: PipelineBarProps) {
	const { t } = useTranslation();
	const hasReport = model.report !== null;
	const hasFindings = (model.report?.findings.length ?? 0) > 0;
	const hasSample = hasReport || model.selectedPath !== null;

	const stages: Stage[] = [
		{ id: "profile", page: "overview", lit: hasReport },
		{ id: "controlflow", page: "findings", lit: hasFindings },
		{ id: "knowledge", page: "docs", lit: true },
		{ id: "verify", page: "selfcheck", lit: true },
	];

	// 当前激活段跟页面走：findings->controlflow, docs->knowledge, selfcheck->verify, 其余->profile。
	const active =
		model.page === "findings" ? "controlflow" : model.page === "docs" ? "knowledge" : model.page === "selfcheck" ? "verify" : "profile";

	return (
		<div className="flex items-center gap-2 bg-surface-2 px-3 py-1.5">
			<div className="flex min-w-0 flex-1 items-center gap-0.5">
				{stages.map((stage, index) => {
					const now = active === stage.id;
					return (
						<div key={stage.id} className="flex min-w-0 flex-1 items-center gap-0.5">
							<button
								type="button"
								onClick={() => (hasSample && stage.lit ? model.go(stage.page) : undefined)}
								disabled={!hasSample || !stage.lit}
								aria-current={now ? "step" : undefined}
								className={`flex min-w-0 items-center gap-1 rounded px-1.5 py-1 transition-colors ${
									now ? "bg-surface-active text-text" : hasSample && stage.lit ? "text-text-2 hover:bg-surface-hover hover:text-text" : "cursor-not-allowed text-text-4 opacity-50"
								}`}
							>
								<span className={`size-1.5 shrink-0 rounded-full ${now ? "bg-purple" : hasSample && stage.lit ? "bg-surface-4" : "bg-surface-3"}`} />
								<span className="truncate text-[10px] font-medium">{t(`pipeline.${stage.id}.title`)}</span>
							</button>
							{index < stages.length - 1 && <span className="shrink-0 text-text-4">·</span>}
						</div>
					);
				})}
			</div>
			{!hasSample && <span className="shrink-0 text-[11px] text-text-3">{t("pipeline.idle")}</span>}
		</div>
	);
}