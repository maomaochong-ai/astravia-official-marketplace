/**
 * 面板「样本」页：**一个浏览面**，不是一堆圆角卡片。
 *
 * 上一版的形状是「左卡（选择器）+ 右列两张说明卡」。两个问题：
 *   1. 面板拖宽时右列两张卡各只有三五行，格里剩下的高度全空着 —— 用户看到的是
 *      「卡片底部大量无用空间」；
 *   2. 19 个文件堆成 19 张圆角卡，卡间距比行距还大，读起来像 19 个不同的东西。
 *
 * 现在：一张卡、两个格（列表 / 说明），说明那一格是**整列**而不是浮在格子上方的小卡。
 * 窄面板时说明落到页脚并自带高度上限，列表始终吃满剩余高度 —— 任何宽度下都没有空着的格子。
 *
 * 与宿主的交互都落在行上：行内「交接」走 handoff 对话框（同一份 buildPrompt），
 * 行内「更多」与右键是同一份菜单，已分析的文件直接显示得分并可重开报告。
 */

import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo } from "react";
import type { LibraryEntry } from "../../state";
import { usePanelMenu, type PanelMenu } from "../../hooks/use-panel-menu";
import { Card } from "../shell/card";
import { ContextMenu } from "../shell/context-menu";
import { DataTable, type DataTableRow } from "../shell/data-table";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { SamplePicker } from "../workbench/sample-picker";
import type { PageProps } from "./overview";

const FORMATS = ["apk", "ipa", "jar", "native", "dex", "other"] as const;

/** 报告时间：本地化到秒。解析不了就给一个破折号，不编时间。 */
function when(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

/** 样本页：左边选文件，右边说清楚当前这份与每种格式会解析到什么。 */
export function SamplesPage({ model }: PageProps) {
	const { t } = useTranslation();
	const menu = usePanelMenu();

	const rows: DataTableRow[] = FORMATS.map(id => ({
		key: id,
		cells: [t(`format.${id}.name`), t(`format.${id}.detail`)],
	}));

	// 路径 → 已分析摘要。只按路径精确匹配：报告来自对话时路径可能不同，宁可显示「未分析」也不猜。
	const analysed = useMemo(() => {
		const map = new Map<string, LibraryEntry>();
		for (const entry of model.entries) map.set(entry.path, entry);
		return map;
	}, [model.entries]);

	const report = model.report;
	const record = model.selectedPath ? analysed.get(model.selectedPath) : undefined;

	/**
	 * 一份样本上的动作。
	 *
	 * 菜单里只放「行内没地方放」的那些：分析是主操作（点行即可），交接与重开在行上已有按钮，
	 * 菜单里重复一份是为了「右键就能做完」，不是因为它们是另一条路径。
	 * 右键与「更多」按钮共用这一份内容 —— 两份各写一遗必然只修一处。
	 */
	const sampleMenu = (path: string): Omit<PanelMenu, "left" | "top"> => {
		const known = analysed.get(path);
		return {
			heading: path,
			groups: [
				{
					id: "run",
					items: [
						{ id: "analyse", label: t("samples.row.analyse"), icon: "scan", run: () => model.analyse(path) },
						...(known ? [{ id: "open", label: t("samples.row.reopen"), icon: "eye", run: () => model.openEntry(known.id) }] : []),
					],
				},
				{
					id: "chat",
					items: [
						{ id: "handoff", label: t("panel.rail.handoff"), icon: "send", run: () => model.openHandoff(path) },
						{
							id: "ask",
							label: t("menu.askAbout"),
							icon: "sparkle",
							run: () =>
								model.askText(
									`看一下 ${path}：先用 triage_binary 做一遍静态体检，再把最值得进一步验的三处写清楚（每处给出工具与判据）。`,
								),
						},
					],
				},
				{
					id: "more",
					items: [
						{
							id: "copy",
							label: t("menu.copyPath"),
							icon: "copy",
							run: () => {
								navigator.clipboard?.writeText(path).then(
									() => model.notify(t("menu.copied"), "success"),
									() => model.notify(t("menu.copyFailed"), "error"),
								);
							},
						},
					],
				},
			],
		};
	};


	const exportButtons = (
		<div className="mt-2 flex flex-wrap items-center gap-1.5">
			<button
				type="button"
				onClick={() => model.exportReport("markdown")}
				className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
			>
				<Icon name="save" className="size-3" />
				{t("panel.action.exportMarkdown")}
			</button>
			<button
				type="button"
				onClick={() => model.exportReport("json")}
				className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
			>
				<Icon name="save" className="size-3" />
				{t("panel.action.exportJson")}
			</button>
			<button
				type="button"
				onClick={() => model.go("reports")}
				className="inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
			>
				<Icon name="book" className="size-3" />
				{t("samples.detail.report")}
			</button>
		</div>
	);

	return (
		<>
			<PageHeader title={t("page.samples.title")} description={t("page.samples.lead")} />
			<div className="fb-page fb-fill">
				<Card testId="samples-browser" title={t("page.samples.picker")} bodyClassName="p-0" fill>
					<div className="fb-samples">
						<div className="fb-samples-list flex min-h-0 min-w-0 flex-col">
							<SamplePicker
								cwd={model.cwd}
								files={model.files}
								loading={model.filesLoading}
								busy={model.phase === "loading"}
								selectedPath={model.selectedPath}
								analysed={analysed}
								onRefresh={model.refreshFiles}
								onAnalyse={model.analyse}
								onImport={files => model.importFile(files[0])}
								onOpenReport={id => model.openEntry(id)}
								onHandOff={path => model.openHandoff(path)}
								onMenu={(event, path) => menu.openAt(event, sampleMenu(path))}
								onMenuNear={(node, path) => {
									if (node) menu.openNear(node, sampleMenu(path));
								}}
							/>
						</div>

						{/*
						 * 说明列：整列到底，自己滚。它是「这一份样本此刻是什么」的边栏，
						 * 不是第二张浮在格子里的卡 —— 后者必然在内容短时留出一片空白。
						 */}
						<aside data-testid="sample-facts" className="fb-samples-detail fb-scroll min-w-0 overflow-y-auto">
							<section className="px-3 py-2">
								<div className="flex items-center gap-1.5">
									<span className="min-w-0 flex-1 text-[9.5px] uppercase tracking-wider text-text-4">{t("samples.current")}</span>
									{record ? <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-text-3">{record.formatLabel}</span> : null}
								</div>
								{report ? (
									<>
										<div className="mt-1 flex flex-wrap items-baseline gap-x-2">
											<span className="min-w-0 fb-wrap text-[12px] font-medium text-text">{report.target.name}</span>
											{model.fromAgent ? (
												<span className="shrink-0 rounded border border-line-subtle px-1 py-0.5 text-[9.5px] text-text-4">
													{t("samples.detail.agent")}
												</span>
											) : null}
										</div>
										<div className="fb-wrap font-mono text-[10.5px] text-text-4" title={report.target.path}>
											{report.target.path}
										</div>
										<dl className="fb-field mt-2">
											<dt>{t("risk.score")}</dt>
											<dd>
												<span className="font-mono tabular-nums">{report.risk.score}</span>
												<span className="ms-1.5 font-mono text-text-3">{report.risk.grade}</span>
											</dd>
											<dt>{t("samples.detail.findings")}</dt>
											<dd className="font-mono tabular-nums">{report.findings.length}</dd>
											<dt>{t("samples.detail.sha")}</dt>
											<dd className="font-mono text-text-3" title={report.target.sha256}>
												{report.target.sha256.slice(0, 24)}…
											</dd>
											<dt>{t("samples.detail.at")}</dt>
												<dd className="font-mono text-text-3">{when(report.target.generatedAt)}</dd>
										</dl>
										{exportButtons}
									</>
								) : (
									<>
										<p className="mt-1 text-[11.5px] leading-relaxed text-text-2">{t("samples.detail.empty")}</p>
										<p className="mt-1 text-[10.5px] leading-relaxed text-text-4">{t("samples.detail.emptyBody")}</p>
										<button
											type="button"
											onClick={() => model.go("findings")}
											className="mt-2 inline-flex items-center gap-1 rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
										>
											<Icon name="activity" className="size-3" />
											{t("samples.detail.observe")}
										</button>
									</>
								)}
							</section>

							<section className="border-t border-line-subtle">
								<div className="px-3 pb-1 pt-2 text-[9.5px] uppercase tracking-wider text-text-4">{t("page.samples.formats")}</div>
								<DataTable columns={[t("page.samples.col.format"), t("page.samples.col.parsed")]} rows={rows} mono={[true, false]} />
							</section>

							<section className="border-t border-line-subtle px-3 py-2">
								<div className="pb-1 text-[9.5px] uppercase tracking-wider text-text-4">{t("page.samples.scope")}</div>
								<ul className="space-y-1.5 text-[10.5px] leading-relaxed text-text-3">
									<li>· {t("page.samples.scope.project")}</li>
									<li>· {t("page.samples.scope.size")}</li>
									<li>· {t("page.samples.scope.readonly")}</li>
									<li>· {t("page.samples.scope.dex")}</li>
								</ul>
							</section>
						</aside>
					</div>
				</Card>
			</div>
			<ContextMenu menu={menu.menu} onClose={menu.close} />
		</>
	);
}
