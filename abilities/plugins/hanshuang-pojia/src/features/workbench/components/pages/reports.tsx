import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { formatBytes, renderMarkdown } from "../../../../domain/report/report";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { EmptyState } from "../shell/empty-state";
import { Icon } from "../shell/icon";
import { Markdown } from "../shell/markdown";
import { PageHeader } from "../shell/page-header";
import { SegmentedControl } from "../shell/segmented-control";
import { StatTile } from "../shell/stat-tile";
import { Tag } from "../shell/tag";
import type { ReportFile } from "../../bridge";
import { useDialogBehavior } from "../../hooks/use-dialog-behavior";
import type { PageProps } from "./overview";

type Tab = "report" | "library";

function when(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * 报告页：把「这次评估写成了什么」摊开，而不是只列一份历史清单。
 *
 * 之前的页面只有「样本库 + 存储状态 + 当前样本三个按钮」，读者进来看不到任何结论——
 * 报告标题在，报告正文不在。现在两栏合一页：
 *   · 报告视图：直接渲染当前评估的 Markdown（与 `copyReport` / `exportReport` 同一份
 *     `renderMarkdown` 输出，所以屏幕上看到的和复制/导出的逐字一致），右侧给风险与证据摘要；
 *   · 库视图：本次会话分析过的样本，点开即载入。
 *
 * 页面上不生成报告：写报告仍是 `write_assessment_report` 的职责（四节：概要 / 判定点 /
 * 验证证据 / 纵深防御）。这里只做「看、复制、导出、交给对话继续写」。
 */
export function ReportsPage({ model }: PageProps) {
	const { t } = useTranslation();
	const [tab, setTab] = useState<Tab>("report");
	// 对话里产出的报告落在工作区 reports/；面板只读它们，不生成。
	const [workspaceReports, setWorkspaceReports] = useState<ReportFile[] | null>(null);
	const [previewPath, setPreviewPath] = useState<string | null>(null);
	const [previewBody, setPreviewBody] = useState<string | null>(null);

	// 只在挂载时读一次工作区报告。
	//
	// 依赖原本写成 `[model]`，而 `useWorkbench` 每次渲染都返回一个新对象：只要面板重渲染
	// （流式输出、活动事件、时间线 tick），effect 就再发一次 listReports。它不是无界死循环
	// （本组件自己 setState 不会推动父级），但一次会话里会白跑几十上百次 IO。
	// 函数本体从 ref 取最新，依赖留空。
	const listReports = useRef(model.listReports);
	listReports.current = model.listReports;
	useEffect(() => {
		let alive = true;
		void listReports.current().then(
			files => {
				if (alive) setWorkspaceReports(files);
			},
			() => {
				if (alive) setWorkspaceReports([]);
			},
		);
		return () => {
			alive = false;
		};
	}, []);
	const report = model.report;

	// 与 copyReport/exportReport 同一份渲染结果：屏幕上看到的就是会被复制出去的那份。
	const markdown = useMemo(() => (report ? renderMarkdown(report, { mode: model.settings.mode }) : ""), [report, model.settings.mode]);

	const severity = useMemo(() => {
		const counts = new Map<string, number>();
		for (const finding of report?.findings ?? []) counts.set(finding.severity, (counts.get(finding.severity) ?? 0) + 1);
		return [...counts.entries()].sort((left, right) => right[1] - left[1]);
	}, [report]);

	const hasReport = report !== null;

	return (
		<>
			<PageHeader
				title={t("page.reports.title")}
				description={t("page.reports.lead")}
				actions={
					<>
						<SegmentedControl<Tab>
							size="sm"
							value={tab}
							onValueChange={setTab}
							ariaLabel={t("page.reports.title")}
							items={[
								{ value: "report", label: t("reports.tab.report") },
								{ value: "library", label: t("reports.tab.library") },
							]}
						/>
						<button
							type="button"
							onClick={() => model.copyReport("markdown")}
							disabled={!hasReport}
							className="flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
						>
							<Icon name="copy" className="size-3" />
							{t("reports.copy")}
						</button>
						<button
							type="button"
							onClick={() => model.exportReport("markdown")}
							disabled={!hasReport}
							className="flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
						>
							<Icon name="save" className="size-3" />
							{t("reports.export")}
						</button>
						{/* 清理只清当前评估，不动 reports/ 里的文件：文件是交付物，不是缓存。
						    它只属于「报告」视图 —— 放在页头常驻会让样本库里的人也以为要清列表。 */}
						{tab === "report" && hasReport ? (
							<button
								type="button"
								onClick={() => model.clearReport()}
								className="flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-risk-high"
							>
								<Icon name="close" className="size-3" />
								{t("reports.clearCurrent")}
							</button>
						) : null}
					</>
				}
			/>

			<div className="fb-page">
				{tab === "report" ? (
					hasReport ? (
						<>
							<div className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
								<StatTile label={t("reports.stat.score")} value={`${report.risk.score} · ${report.risk.grade}`} />
								<StatTile label={t("reports.stat.findings")} value={report.findings.length} />
								<StatTile label={t("reports.stat.size")} value={formatBytes(report.target.size)} />
								<StatTile label={t("reports.stat.mode")} value={t(`mode.${report.mode}`)} />
							</div>

							<div className="fb-fill grid min-h-0 gap-2.5 @min-[900px]:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
								<Card title={t("reports.preview.title")} bodyClassName="p-0" fill>
									<div className="fb-scroll fb-fill-scroll overflow-y-auto px-3.5 py-3">
										<Markdown source={markdown} />
									</div>
								</Card>

								<div className="flex min-h-0 flex-col gap-2.5">
									<Card title={t("reports.severity.title")} bodyClassName="divide-y divide-line-subtle">
										{severity.length === 0 ? (
											<p className="px-3.5 py-2 text-[10.5px] text-text-4">{t("reports.severity.none")}</p>
										) : (
											severity.map(([level, count]) => (
												<div key={level} className="fb-field px-3.5 py-1.5">
													<span className="fb-field-label font-mono">{level}</span>
													<span className="fb-field-value font-mono tabular-nums">{count}</span>
												</div>
											))
										)}
									</Card>

									<Card title={t("reports.sections.title")} bodyClassName="divide-y divide-line-subtle">
										{/* 序号而不是 check：这四项是「报告应有的结构」，不是「已验证通过」。 */}
										{(["summary", "decision", "evidence", "defence"] as const).map((key, index) => (
											<div key={key} className="flex items-start gap-2 px-3.5 py-1.5">
												<span className="mt-0.5 shrink-0 font-mono text-[9.5px] tabular-nums text-text-4">{index + 1}</span>
												<span className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-text-3">{t(`reports.sections.${key}`)}</span>
											</div>
										))}
									</Card>

									<Card bodyClassName="p-3">
										<div className="flex flex-col gap-1.5">
											<AiButton label={t("ai.report")} onClick={() => model.ask("report")} busy={model.chat.sending} />
											<button
												type="button"
												onClick={() => model.exportReport("json")}
												className="rounded-md border border-line-subtle px-2 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
											>
												{t("reports.exportJson")}
											</button>
										</div>
									</Card>
								</div>
							</div>
						</>
					) : (
						<Card fill bodyClassName="flex items-center justify-center p-6">
							<EmptyState
								icon="nav-reports"
								title={t("reports.empty.title")}
								body={t("reports.empty.body")}
								action={
									<button
										type="button"
										onClick={() => model.go("samples")}
										className="rounded-md border border-line-subtle px-2.5 py-1 text-[11.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
									>
										{t("reports.empty.action")}
									</button>
								}
							/>
						</Card>
					)
				) : (
					<Card
						title={t("reports.library")}
						actions={
							model.entries.length > 0 ? (
								<button
									type="button"
									onClick={model.clearLibrary}
									className="rounded px-1.5 py-0.5 text-[10.5px] text-text-4 transition-colors hover:bg-surface-hover hover:text-risk-high"
								>
									{t("reports.clear")}
								</button>
							) : null
						}
						bodyClassName="p-0"
						fill
					>
						{model.entries.length === 0 ? (
							<EmptyState icon="file" title={t("reports.empty.title")} body={t("reports.empty.body")} />
						) : (
							<div className="fb-scroll fb-fill-scroll divide-y divide-line-subtle overflow-y-auto">
								{model.entries.map(entry => (
									<button
										key={entry.id}
										type="button"
										onClick={() => model.openEntry(entry.id)}
										title={entry.path}
										className="flex w-full min-w-0 items-center gap-2 px-3.5 py-2 text-left transition-colors hover:bg-surface-hover"
									>
										<span className="min-w-0 flex-1 fb-wrap text-[11.5px] text-text">{entry.name}</span>
										<Tag tone="neutral">{entry.format.toUpperCase()}</Tag>
										<span className="shrink-0 font-mono text-[10.5px] tabular-nums text-text-2">
											{entry.score} · {entry.grade}
										</span>
										<span className="shrink-0 font-mono text-[9.5px] text-text-4">{when(entry.analysedAt)}</span>
									</button>
								))}
							</div>
						)}
					</Card>
				)}

				{/* 工作区 reports/：对话里 Agent 写下的报告。点开就地预览，不离开面板。 */}
				<Card
					title={t("reports.workspace.title")}
					actions={<span className="font-mono text-[10.5px] text-text-4">{workspaceReports?.length ?? "…"}</span>}
					bodyClassName="p-0"
				>
					{workspaceReports === null ? (
						<p className="px-3.5 py-2 text-[10.5px] text-text-4">{t("reports.workspace.loading")}</p>
					) : workspaceReports.length === 0 ? (
						<p className="px-3.5 py-2 text-[10.5px] leading-relaxed text-text-4">{t("reports.workspace.empty")}</p>
					) : (
						<div className="fb-scroll max-h-[var(--fb-h-xs)] divide-y divide-line-subtle overflow-y-auto">
							{workspaceReports.map(file => (
								<button
									key={file.path}
									type="button"
									onClick={() => {
										setPreviewPath(file.path);
										setPreviewBody(null);
										void model.readReport(file.path).then(setPreviewBody);
									}}
									title={file.path}
									className="flex w-full min-w-0 items-center gap-2 px-3.5 py-1.5 text-left transition-colors hover:bg-surface-hover"
								>
									<Icon name="file" className="size-3 shrink-0 text-text-4" />
									<span className="min-w-0 flex-1 fb-wrap text-[11.5px] text-text">{file.name}</span>
									<span className="shrink-0 font-mono text-[9.5px] text-text-4">{formatBytes(file.bytes)}</span>
								</button>
							))}
						</div>
					)}
				</Card>

				{/* 存储状态是事实，不是提示：放在页尾一行，不占一整个卡片。 */}
				<div className="flex shrink-0 items-center gap-1.5 px-1 text-[10.5px] text-text-4">
					<Icon name={model.persisted ? "check" : "alert"} className={`size-3 shrink-0 ${model.persisted ? "text-risk-low" : "text-risk-medium"}`} />
					<span className="min-w-0 fb-wrap">{model.persisted ? t("reports.storage.on") : t("reports.storage.off")}</span>
				</div>
			</div>

			{/* 工作区报告的预览：抽成组件才能用 useDialogBehavior（hooks 不能写在条件分支里）。 */}
			<WorkspacePreview path={previewPath} body={previewBody} onClose={() => setPreviewPath(null)} />
		</>
	);
}

/**
 * 工作区报告预览。
 *
 * 抽出来的唯一理由是 hooks 规则：Esc / 焦点 / `role="dialog"` 必须写在组件顶层，
 * 不能跟着 `previewPath ? … : null` 一起放进条件分支。
 */
function WorkspacePreview({ path, body, onClose }: { path: string | null; body: string | null; onClose(): void }) {
	const { t } = useTranslation();
	const dialog = useDialogBehavior(path !== null, onClose);

	if (!path) return null;

	return (
		<div className="fb-overlay" onClick={onClose}>
			<div
				ref={dialog}
				role="dialog"
				aria-modal="true"
				aria-label={path}
				tabIndex={-1}
				className="flex max-h-[88%] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line-strong outline-none"
				onClick={event => event.stopPropagation()}
				data-testid="workspace-report-preview"
			>
				<div className="flex shrink-0 items-center gap-2 border-b border-line-subtle px-3.5 py-2">
					<button
						type="button"
						onClick={onClose}
						className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						<Icon name="chevron" className="size-3 rotate-180" />
						{t("reports.workspace.back")}
					</button>
					<span className="min-w-0 flex-1 fb-wrap font-mono text-[10.5px] text-text-4">{path}</span>
				</div>
				<div className="fb-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
					{body === null ? (
						<p className="text-[11.5px] text-text-4">{t("reports.workspace.loading")}</p>
					) : (
						<Markdown source={body} />
					)}
				</div>
			</div>
		</div>
	);
}
