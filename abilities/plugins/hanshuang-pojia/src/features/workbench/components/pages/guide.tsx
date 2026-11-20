import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { AiButton } from "../shell/ai-button";
import { planNextSteps } from "../../../../domain/case/next-step";
import type { PageId } from "../../state";
import type { PageProps } from "./overview";

/**
 * 使用指南：一条**工序线** + 每段交付什么、在哪看、下一步拿它干什么。
 *
 * 三个约定，改动前先读：
 *   1. 工序线是**一行**。语义是顺序，所以宁可横向滚也不折行 —— 折行后每行末尾会留一个
 *      指向空白的箭头，读者会以为漏了一段。段卡宽度 150px 是硬下限，6 段 + 箭头的自然
 *      宽度约 1064px，面板常态装不下。
 *   2. 「在哪看」是**可点的**。这页的存在意义就是告诉人下一步去哪个页面动手；把页名写成
 *      不可点的 9.5px 小字，等于把唯一的动作藏起来。
 *   3. 页名与产出文案都从 locales 取（`nav.<page>` / `guide.stage.<stage>.out|next`），
 *      组件里不留中文字面量 —— 否则英文界面这一页永远是中文。
 */
const FLOW = ["intake", "static", "knowledge", "dynamic", "deliver", "review"] as const;
type Stage = (typeof FLOW)[number];

/** 每段结束时该去哪些页面。顺序即推荐顺序，chip 点了直接跳过去。 */
const STAGE_PAGES: Record<Stage, readonly PageId[]> = {
	intake: ["samples"],
	static: ["findings", "strings", "disasm", "static"],
	knowledge: ["knowledge"],
	dynamic: ["prompts"],
	deliver: ["reports"],
	review: ["selfcheck", "activity"],
};

/**
 * 三条任务线。
 *
 * 这一页原来的问题是「按工序讲」，而人来这里问的是「我要做 X，从哪开始」。
 * 工序线回答的是「整体长什么样」，任务线回答的是「我现在该点哪」。两者都要，但顺序反过来：
 * 先任务，后全貌。
 */
const TRACKS = [
	{ id: "assess", steps: ["intake", "static", "knowledge", "deliver"] as const },
	{ id: "prompt", steps: ["knowledge", "dynamic"] as const },
	{ id: "harden", steps: ["deliver", "review"] as const },
] as const;

/** 边界：反向清单。折叠起来是因为它不推进任何事，但要能随时查。 */
const LIMITS = ["execute", "network", "size", "scope", "tools"] as const;

/** 置信度 → 徽标配色。写死映射，禁止在 JSX 里拼条件类名（拼错了 tailwind 会直接丢掉）。 */
const STEP_TONE: Record<"strong" | "weak" | "fallback", string> = {
	strong: "bg-accent-soft text-accent",
	weak: "bg-surface-3 text-text-2",
	fallback: "bg-surface-3 text-text-4",
};

export function GuidePage({ model }: PageProps) {
	const { t } = useTranslation();
	const busy = model.chat.sending;
	const [active, setActive] = useState<Stage>("intake");

	const pages = STAGE_PAGES[active];
	const pageLabel = (page: PageId) => t(`nav.${page}`);
	const steps = model.report ? planNextSteps({ format: model.report.target.format, ruleIds: model.report.findings.map(item => item.ruleId) }) : [];

	return (
		<>
			<PageHeader
				title={t("page.guide.title")}
				description={t("page.guide.lead")}
				// 页头只留一个：三个按钮在 420px 面板下会挤成三行，而它们讲的是同一件事
				// ——「把这条流程交给对话」。另外两个挪进「下一步」卡底，与计划放在一起。
				actions={<AiButton label={t("ai.workflow")} onClick={() => model.ask("continue")} busy={busy} />}
			/>

			<div className="fb-page">
				{/* 任务线：先回答「我要做哪件事、从哪开始」。 */}
				<div className="grid shrink-0 gap-2 @min-[620px]:grid-cols-3">
					{TRACKS.map(track => (
						<Card key={track.id} title={t(`guide.track.${track.id}.title`)} bodyClassName="flex flex-col gap-1.5 p-3">
							<p className="text-[10.5px] leading-relaxed text-text-3">{t(`guide.track.${track.id}.body`)}</p>
							<ol className="flex flex-col gap-0.5">
								{track.steps.map((step, order) => (
									<li key={step} className="flex items-baseline gap-1.5 text-[10.5px] text-text-2">
										<span className="shrink-0 font-mono text-[9.5px] tabular-nums text-text-4">{order + 1}</span>
										<button
											type="button"
											onClick={() => setActive(step)}
											className="min-w-0 flex-1 fb-wrap text-left transition-colors hover:text-accent"
										>
											{t(`guide.stage.${step}.title`)}
										</button>
									</li>
								))}
							</ol>
							<button
								type="button"
								onClick={() => model.go(STAGE_PAGES[track.steps[0]][0] ?? "samples")}
								className="mt-auto inline-flex items-center gap-1 self-start rounded-md bg-surface-3 px-2 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-accent-soft hover:text-accent"
							>
								{t("guide.track.start")}
								<Icon name="chevron" className="size-3" />
							</button>
						</Card>
					))}
				</div>

				{/* 工序线：一行到底，横向滚。箭头始终贴在段后，不折到下一行行尾。 */}
				<Card title={t("guide.flow.title")} bodyClassName="p-3">
					<div className="fb-scroll -mx-3 overflow-x-auto px-3">
						<ol className="flex w-max snap-x items-stretch gap-1.5 pb-1">
							{FLOW.map((stage, index) => {
								const selected = active === stage;
								return (
									<li key={stage} className="flex shrink-0 snap-start items-stretch gap-1.5">
										<button
											type="button"
											onClick={() => setActive(stage)}
											aria-current={selected ? "step" : undefined}
											title={`${t(`guide.stage.${stage}.title`)} · ${STAGE_PAGES[stage].map(pageLabel).join(" / ")}`}
											className={`flex w-[150px] flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors ${
												selected ? "border-accent/50 bg-accent-soft" : "border-line-subtle bg-surface hover:bg-surface-hover"
											}`}
										>
											<span className="flex items-center gap-1.5">
												<span aria-hidden className="flex size-4 shrink-0 items-center justify-center rounded-full bg-surface-4 font-mono text-[9.5px] text-text-2">
													{index + 1}
												</span>
												<span className={`truncate text-[11.5px] font-medium ${selected ? "text-accent" : "text-text"}`}>
													{t(`guide.stage.${stage}.title`)}
												</span>
											</span>
											<span className="line-clamp-2 text-[10.5px] leading-snug text-text-4">
												{STAGE_PAGES[stage].map(pageLabel).join(" / ")}
											</span>
										</button>
										{index < FLOW.length - 1 ? (
											<span aria-hidden className="flex shrink-0 items-center px-0.5 text-text-4">
												<Icon name="chevron" className="size-3" />
											</span>
										) : null}
									</li>
								);
							})}
						</ol>
					</div>
					<p className="mt-2 text-[10.5px] leading-relaxed text-text-4">{t("guide.flow.note")}</p>
				</Card>

				{/* 选中段的工件：在哪看（可点） → 产出 → 下一步。三行同一左缘。 */}
				<Card
					title={t(`guide.stage.${active}.title`)}
					actions={<span className="font-mono text-[10.5px] text-text-4">{t("guide.artifacts.title")}</span>}
					bodyClassName="divide-y divide-line-subtle"
				>
					<div className="flex items-start gap-2.5 px-3.5 py-2">
						<Icon name="folder" className="mt-0.5 size-3 shrink-0 text-text-4" />
						<div className="min-w-0 flex-1">
							<div className="text-[10.5px] text-text-4">{t("guide.artifacts.where")}</div>
							<div className="mt-1 flex flex-wrap gap-1" data-testid="guide-where">
								{pages.map(page => (
									<button
										key={page}
										type="button"
										onClick={() => model.go(page)}
										className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-accent-soft hover:text-accent"
									>
										{pageLabel(page)}
									</button>
								))}
							</div>
						</div>
					</div>
					<div className="flex items-start gap-2.5 px-3.5 py-2">
						<Icon name="check" className="mt-0.5 size-3 shrink-0 text-accent" />
						<div className="min-w-0 flex-1">
							<div className="text-[10.5px] text-text-4">{t("guide.artifacts.out")}</div>
							<div className="fb-wrap mt-0.5 text-[11.5px] leading-relaxed text-text-2">{t(`guide.stage.${active}.out`)}</div>
						</div>
					</div>
					<div className="flex items-start gap-2.5 px-3.5 py-2">
						<Icon name="chevron" className="mt-0.5 size-3 shrink-0 text-text-4" />
						<div className="min-w-0 flex-1">
							<div className="text-[10.5px] text-text-4">{t("guide.artifacts.next")}</div>
							<div className="fb-wrap mt-0.5 text-[11.5px] leading-relaxed text-text-2">{t(`guide.stage.${active}.next`)}</div>
						</div>
					</div>
					{/* 无图标行：用 ps-9 对齐到上面三行的文字左缘（14 + 12 + 10 = 36px）。 */}
					<div className="fb-wrap py-2 pe-3.5 ps-9 text-[10.5px] leading-relaxed text-text-3">{t(`guide.stage.${active}.body`)}</div>
				</Card>

				{/* 下一步：与 `plan_next_step` 同一份实现，面板与对话给出的计划因此不会分叉。 */}
				<Card
					title={t("guide.next.title")}
					actions={<span className="font-mono text-[10.5px] text-text-4">{steps.length}</span>}
					bodyClassName="divide-y divide-line-subtle"
				>
					{steps.length === 0 ? (
						// 空态：整张卡消失会让人以为页面坏了，必须解释「为什么现在是空的」。
						<div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
							<p className="fb-wrap min-w-0 flex-1 text-[10.5px] leading-relaxed text-text-3">{t("guide.next.empty")}</p>
							<button
								type="button"
								onClick={() => model.go("samples")}
								className="shrink-0 rounded-md bg-surface-3 px-2 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-accent-soft hover:text-accent"
							>
								{t("guide.next.goSamples")}
							</button>
						</div>
					) : (
						steps.map(step => (
							<div key={step.id} className="flex flex-col gap-1 px-3.5 py-2">
								<div className="flex items-center gap-1.5">
									<span className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] ${STEP_TONE[step.confidence]}`}>{t(`guide.next.confidence.${step.confidence}`)}</span>
									<span className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-text">{step.hypothesis}</span>
								</div>
								<code className="fb-wrap font-mono text-[10.5px] text-text-2">{`${step.action.tool} ${step.action.args}`}</code>
								<span className="text-[10.5px] leading-relaxed text-text-3">
									{t("guide.next.disproof")} {step.disproof}
								</span>
								<span className="text-[10.5px] leading-relaxed text-text-4">
									{t("guide.next.else")} {step.elseDo}
								</span>
							</div>
						))
					)}
					{/* 另外两个入口：与计划同处一卡 —— 它们都是「让对话接着干」。 */}
					<div className="flex flex-wrap items-center gap-1.5 px-3.5 py-2">
						<AiButton label={t("ai.report")} onClick={() => model.ask("report")} busy={busy} disabled={!model.report} />
						<AiButton label={t("ai.toolchain")} onClick={() => model.ask("toolchain")} busy={busy} />
					</div>
				</Card>

				{/* 边界：反向清单折叠收起。它不推进任何事，但随时可查；主操作留在页头。 */}
				<details className="fb-collapse overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line-subtle">
					<summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-text transition-colors hover:bg-surface-hover">
						<Icon name="ban" className="size-3.5 shrink-0 text-text-4" />
						<span className="min-w-0 flex-1 truncate" title={t("guide.limit.title")}>
							{t("guide.limit.title")}
						</span>
						<span className="shrink-0 font-mono text-[10.5px] text-text-4">{LIMITS.length}</span>
						<Icon name="chevron" className="size-3 shrink-0 text-text-4" />
					</summary>
					<div className="divide-y divide-line-subtle border-t border-line-subtle">
						{LIMITS.map(item => (
							<div key={item} className="flex gap-1.5 px-3.5 py-1.5">
								<Icon name="ban" className="mt-0.5 size-3 shrink-0 text-text-4" />
								<span className="fb-wrap min-w-0 flex-1 text-[10.5px] leading-relaxed text-text-3">{t(`guide.limit.${item}`)}</span>
							</div>
						))}
					</div>
				</details>
			</div>
		</>
	);
}
