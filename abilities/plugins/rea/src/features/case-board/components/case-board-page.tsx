/**
 * 案卷页：一次调查的全部可见结果集中在这里 —— 目标、路线、证据分级与未解问题。
 *
 * 数据来自 `useCaseBoard`（存储读侧），写入只发生在 Agent 侧（case_* 工具与取证
 * 钩子）。面板不编辑案卷内容：它是「读回证据」的地方，不是第二个编辑器。
 *
 * 布局：卡片网格铺满可用宽度，`@min-[880px]` 两列、`@min-[1400px]` 三列；
 * 每张卡 `h-full`，同一行的卡等高，不留下半格空洞。
 */
import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { CaseSummary } from "../domain/case-model";
import { routeDefinition } from "../domain/route-catalog";
import { Panel, PanelHeader } from "../../../shared/components/panel";
import { ReaPage, ReaPageHeader } from "../../rea-workflow/components/rea-app-shell";
import { useCaseBoard } from "../hooks/use-case-board";

export interface CaseBoardPageProps {
	readonly active: boolean;
	readonly cwd: string | null;
	/** 把「继续这条调查」交给对话：这里只提供意图，发送通道在 tab 里。 */
	readonly onContinue: (prompt: string) => void;
}

const GRADE_TONE: Record<"confirmed" | "inferred" | "unknown", string> = {
	confirmed: "text-risk-low",
	inferred: "text-risk-medium",
	unknown: "text-text-3",
};

function formatTime(timestamp: number): string {
	const date = new Date(timestamp);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface CaseCardProps {
	readonly summary: CaseSummary;
	readonly isActive: boolean;
	readonly onActivate: () => void;
	readonly onContinue: () => void;
}

function CaseCard({ summary, isActive, onActivate, onContinue }: CaseCardProps): JSX.Element {
	const { t } = useTranslation();
	const route = routeDefinition(summary.route);
	const grades = [
		{ key: "confirmed" as const, value: summary.confirmed },
		{ key: "inferred" as const, value: summary.inferred },
		{ key: "unknown" as const, value: summary.unknown },
	];

	return (
		<Panel className={`h-full ${isActive ? "border-primary/40" : ""}`}>
			<PanelHeader
				title={summary.title}
				badge={summary.evidenceCount}
				hint={`${t(route.labelKey)} · ${summary.target.kind}`}
				actions={
					isActive ? (
						<span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-micro-up font-medium text-primary">
							{t("case.board.active")}
						</span>
					) : (
						<button
							type="button"
							onClick={onActivate}
							className="inline-flex h-6 shrink-0 items-center rounded-sm px-1.5 text-micro text-text-3 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							{t("case.board.setActive")}
						</button>
					)
				}
			/>

			<div className="flex min-h-0 flex-1 flex-col gap-2.5 px-4 py-3">
				<p className="line-clamp-2 min-w-0 text-caption text-text-2">{summary.target.path ?? summary.target.label}</p>

				<dl className="grid min-w-0 grid-cols-3 gap-2">
					{grades.map((grade) => (
						<div key={grade.key} className="min-w-0 rounded-md bg-surface-3 px-2 py-1.5">
							<dt className="truncate text-micro-up text-text-4">{t(`grade.${grade.key}`)}</dt>
							<dd className={`text-body-sm font-semibold tabular-nums ${GRADE_TONE[grade.key]}`}>{grade.value}</dd>
						</div>
					))}
				</dl>

				<div className="mt-auto flex min-w-0 items-center justify-between gap-2 text-micro text-text-4">
					<span className="truncate">
						{t("case.board.updated")} {formatTime(summary.updatedAt)}
					</span>
					{summary.status === "closed" ? (
						<span className="shrink-0 rounded-full bg-surface-chip px-1.5 py-0.5">{t("case.status.closed")}</span>
					) : null}
				</div>
			</div>

			<div className="border-t border-border-subtle">
				<button
					type="button"
					onClick={onContinue}
					className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-caption text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
				>
					<span className="truncate">{t("case.board.openInAgent")}</span>
					<span aria-hidden className="icon-[lucide--arrow-up-right] size-3.5 shrink-0 text-text-4" />
				</button>
			</div>
		</Panel>
	);
}

export function CaseBoardPage({ active, cwd, onContinue }: CaseBoardPageProps): JSX.Element {
	const { t } = useTranslation();
	const board = useCaseBoard(cwd);

	return (
		<ReaPage active={active}>
			<ReaPageHeader
				title={t("case.board.title")}
				subtitle={t("case.board.subtitle")}
				actions={
					<>
						<span className="inline-flex h-7 items-center rounded-md border border-border bg-surface-3 px-2.5 text-caption tabular-nums text-text-2">
							{t("case.board.count", { count: board.cases.length })}
						</span>
						<button
							type="button"
							onClick={board.reload}
							aria-label={t("case.board.refresh")}
							title={t("case.board.refresh")}
							className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-surface-3 text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--refresh-cw] size-3.5" />
						</button>
					</>
				}
			/>

			{board.error === null ? null : (
				<div className="rounded-lg border border-risk-high/40 bg-risk-high/10 px-4 py-2.5 text-caption text-text-2">
					{board.error}
				</div>
			)}

			{board.cases.length === 0 ? (
				<Panel>
					<div className="flex min-h-32 flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
						<span aria-hidden className="icon-[lucide--folder-search] size-6 text-text-4" />
						<p className="text-caption text-text-3">{board.loading ? "…" : t("case.board.empty")}</p>
					</div>
				</Panel>
			) : (
				<div className="grid min-w-0 flex-1 auto-rows-min content-start gap-3 @min-[880px]:grid-cols-2 @min-[1400px]:grid-cols-3">
					{board.cases.map((summary) => (
						<CaseCard
							key={summary.id}
							summary={summary}
							isActive={summary.id === board.activeId}
							onActivate={() => board.activate(summary.id)}
							onContinue={() =>
								onContinue(
									t("case.board.openPrompt", {
										title: summary.title,
										target: summary.target.path ?? summary.target.label,
									}),
								)
							}
						/>
					))}
				</div>
			)}
		</ReaPage>
	);
}
