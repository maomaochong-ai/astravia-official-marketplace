/**
 * 活动栏「代码审查」tab —— 复刻 GitHub PR Review 的 Files changed 视觉。
 *
 * 真实数据将由未来的 agent tool `code_review_run` 提供；本轮先用 mock 数据。
 *
 * 视觉语言：参考 GitHub Primer PR Review 的版面（左：文件树 / 中：diff / 右：评论），
 * 但颜色全部跟随宿主语义 token：
 *   error   红    --destructive
 *   warning 黄    --warning（plugin 本地派生，跟随宿主 [data-mode] 亮暗）
 *   info    蓝    --primary
 *   hint    灰    --muted-foreground
 *   diff +  绿    --success（plugin 本地派生）
 *   diff -  红    --destructive
 *
 * 布局：在活动栏宽度内采用 视图状态机（files / diff / finding）做单视图切换，
 * 比三栏更贴近真实使用密度。
 */
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { CodeMapStore } from "../store/codemap-store";
import {
	type ReviewFile,
	type ReviewFinding,
	type ReviewSeverity,
	selectReviewFiles,
} from "./review-data";

type View = { kind: "files" } | { kind: "diff"; filePath: string } | { kind: "finding"; filePath: string; findingId: string };

/**
 * 严重度四级 token 集合。
 * 颜色全部走宿主语义 token：error→--destructive, warning→plugin 本地 --warning,
 * info→--primary, hint→--muted-foreground。alpha 修饰符跟随宿主 [data-mode] 自动亮暗。
 */
const SEVERITY_TONE: Record<ReviewSeverity, {
	dot: string;
	chip: string;
	glow: string;
	iconText: string;
}> = {
	error: {
		dot: "bg-destructive",
		chip: "bg-destructive/12 text-destructive border-destructive/30",
		glow: "before:bg-destructive",
		iconText: "icon-[mdi--alert-circle]",
	},
	warning: {
		dot: "bg-warning",
		chip: "bg-warning/12 text-warning border-warning/30",
		glow: "before:bg-warning",
		iconText: "icon-[mdi--alert]",
	},
	info: {
		dot: "bg-primary",
		chip: "bg-primary/12 text-primary border-primary/30",
		glow: "before:bg-primary",
		iconText: "icon-[mdi--information-outline]",
	},
	hint: {
		dot: "bg-muted-foreground",
		chip: "bg-muted-foreground/12 text-muted-foreground border-muted-foreground/30",
		glow: "before:bg-muted-foreground",
		iconText: "icon-[mdi--lightbulb-on-outline]",
	},
};

function severityTotals(files: ReviewFile[]): Record<ReviewSeverity, number> {
	const totals: Record<ReviewSeverity, number> = { error: 0, warning: 0, info: 0, hint: 0 };
	for (const f of files) for (const fd of f.findings) totals[fd.severity] += 1;
	return totals;
}

function FileRow({
	file,
	active,
	expanded,
	onSelect,
}: {
	file: ReviewFile;
	active: boolean;
	expanded: boolean;
	onSelect: () => void;
}): JSX.Element {
	const maxFinding = file.findings.reduce<ReviewSeverity | null>((acc, f) => {
		if (acc === null) return f.severity;
		const order: Record<ReviewSeverity, number> = { error: 0, warning: 1, info: 2, hint: 3 };
		return order[f.severity] < order[acc] ? f.severity : acc;
	}, null);
	const tone = maxFinding ? SEVERITY_TONE[maxFinding] : null;
	const statusIcon =
		file.status === "added" ? "icon-[mdi--plus-circle-outline] text-success"
		: file.status === "deleted" ? "icon-[mdi--minus-circle-outline] text-destructive"
		: file.status === "renamed" ? "icon-[mdi--rename-box] text-context-segment-4"
		: file.status === "modified" ? "icon-[mdi--pencil-circle-outline] text-warning"
		: "icon-[mdi--circle-outline] text-muted-foreground";
	return (
		<button
			type="button"
			onClick={onSelect}
			className={
				"group flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition " +
				(active
					? "border-border bg-accent"
					: "hover:border-border hover:bg-accent")
			}
		>
			<span className={"h-3 w-3 shrink-0 " + (tone ? tone.dot : "bg-border")} />
			<span className={"h-3.5 w-3.5 shrink-0 " + statusIcon} />
			<span className="min-w-0 flex-1 truncate font-mono text-[12px]">{file.path}</span>
			<span className="shrink-0 font-mono text-[10px] leading-none text-muted-foreground">
				<span className="text-success">+{file.additions}</span>
				{" "}
				<span className="text-destructive">−{file.deletions}</span>
			</span>
			{file.findings.length > 0 ? (
				<span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border bg-card px-1 text-[10px] text-muted-foreground">
					{file.findings.length}
				</span>
			) : null}
			<span
				aria-hidden
				className={"h-3 w-3 shrink-0 transition-transform " + (expanded ? "rotate-90" : "") + " icon-[mdi--chevron-right] text-muted-foreground"}
			/>
		</button>
	);
}

function DiffView({
	file,
	selectedFindingId,
	onSelectFinding,
	t,
}: {
	file: ReviewFile;
	selectedFindingId: string | null;
	onSelectFinding: (id: string) => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}): JSX.Element {
	const findingByLine = new Map<number, ReviewFinding>();
	for (const f of file.findings) findingByLine.set(f.line, f);

	return (
		<div className="overflow-x-auto rounded-md border border-border text-[12px]">
			<div className="flex items-center gap-2 border-b border-border bg-accent px-3 py-1.5">
				<span className="font-mono">{file.path}</span>
				{file.previousPath ? (
					<span className="text-[10px] text-muted-foreground">
						{file.previousPath}
					</span>
				) : null}
			</div>
			{file.hunks.map((hunk, hunkIdx) => (
				<div key={hunkIdx} className="font-mono leading-5">
					<div className="border-b border-border bg-muted px-3 py-0.5 text-[10px] text-muted-foreground">
						@@ -{hunk.start} +{hunk.start} @@
					</div>
					{hunk.lines.map((line, lineIdx) => {
						const isAdd = line.kind === "add";
						const isDel = line.kind === "del";
						const isContext = line.kind === "context";
						const finding = line.number !== null ? findingByLine.get(line.number) : undefined;
						const tone = finding ? SEVERITY_TONE[finding.severity] : null;
						const selected = finding && finding.id === selectedFindingId;
						const rowBg = isAdd
							? "bg-success/12"
							: isDel
								? "bg-destructive/12"
								: "bg-card";
						const lineNumberColor = isAdd
							? "text-success"
							: isDel
								? "text-destructive"
								: "text-muted-foreground";
						const marker = isAdd ? "+" : isDel ? "−" : " ";
						return (
							<div
								key={lineIdx}
								role={finding ? "button" : undefined}
								tabIndex={finding ? 0 : undefined}
								onClick={finding ? () => onSelectFinding(finding.id) : undefined}
								onKeyDown={finding ? (e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onSelectFinding(finding.id);
									}
								} : undefined}
								className={
									"relative flex " +
									(tone ? tone.glow + " before:absolute before:bottom-0 before:left-0 before:top-0 before:w-0.5 " : "") +
									rowBg +
									(selected ? " outline outline-1 outline-primary -outline-offset-1" : "") +
									(finding ? " cursor-pointer hover:brightness-95" : "")
								}
							>
								<span className={
									"sticky left-0 inline-block w-10 select-none px-2 text-right " + lineNumberColor + " " + rowBg
								}>
									{line.number ?? ""}
								</span>
								<span className={
									"sticky left-10 inline-block w-4 select-none text-center " + lineNumberColor + " " + rowBg
								}>
									{marker}
								</span>
								<span className="flex-1 whitespace-pre px-2 text-foreground">
									{isContext ? " " : ""}
									{line.text}
									{finding ? (
										<span className={
											"ml-2 inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-sans " + tone!.chip
										}>
											<span className={"h-2.5 w-2.5 " + tone!.iconText} />
											{finding.rule}
										</span>
									) : null}
								</span>
							</div>
						);
					})}
				</div>
			))}
			{file.findings.length === 0 ? (
				<div className="px-3 py-2 text-[10px] text-muted-foreground">
					{t("review.empty.title")}
				</div>
			) : null}
		</div>
	);
}

function FindingDetail({
	file,
	finding,
	t,
}: {
	file: ReviewFile;
	finding: ReviewFinding;
	t: (key: string, params?: Record<string, string | number>) => string;
}): JSX.Element {
	const tone = SEVERITY_TONE[finding.severity];
	return (
		<div className={"rounded-md border p-3 " + tone.chip}>
			<div className="flex items-center gap-2">
				<span className={"h-3 w-3 " + tone.iconText} />
				<span className="font-medium">
					{t("review.severity." + finding.severity)}
				</span>
				<span className="font-mono text-[10px] opacity-80">{finding.rule}</span>
			</div>
			<p className="mt-1.5 text-[12px] leading-relaxed">{finding.message}</p>
			<div className="mt-2 flex items-center gap-3 text-[10px] opacity-80">
				<span>
					{t("review.column.file")}: <span className="font-mono">{file.path}</span>
				</span>
				<span>
					{t("review.column.line")}: <span className="font-mono">{finding.line}</span>
				</span>
			</div>
		</div>
	);
}

export function ReviewTab({ store }: { store: CodeMapStore }): JSX.Element {
	const { t } = useTranslation();
	const [view, setView] = useState<View>({ kind: "files" });
	const [filter, setFilter] = useState<ReviewSeverity | "all">("all");

	// 强制 store 变化时重渲（保持与 CodeMapPanel 相同的订阅习惯）。
	const [, force] = useState(0);
	useEffect(() => store.subscribe(() => force((n) => n + 1)), [store]);

	const files = useMemo(() => selectReviewFiles(store), [store]);
	const totals = useMemo(() => severityTotals(files), [files]);
	const visibleFiles = useMemo(
		() => filter === "all" ? files : files.map((f) => ({
			...f,
			findings: f.findings.filter((fd) => fd.severity === filter),
		})),
		[files, filter],
	);

	const activeFile =
		view.kind === "diff" || view.kind === "finding"
			? visibleFiles.find((f) => f.path === view.filePath) ?? null
			: null;
	const activeFinding =
		view.kind === "finding" && activeFile
			? activeFile.findings.find((f) => f.id === view.findingId) ?? null
			: null;

	return (
		<div className="flex h-full flex-col">
			{/* 顶部 summary */}
			<div className="border-b border-border bg-card px-3 py-2">
				<div className="flex items-center gap-2">
					<span className="h-3.5 w-3.5 icon-[mdi--shield-check-outline] text-primary" />
					<span className="text-sm font-medium text-foreground">
						{t("review.header.title")}
					</span>
					<span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
						{t("review.summary.total", { count: files.reduce((s, f) => s + f.findings.length, 0) })}
					</span>
				</div>
				<p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
					{t("review.header.subtitle")}
				</p>
				<div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
					{(["error", "warning", "info"] as const).map((s) => {
						const tone = SEVERITY_TONE[s];
						const active = filter === s;
						return (
							<button
								key={s}
								type="button"
								onClick={() => setFilter((cur) => (cur === s ? "all" : s))}
								className={
									"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition " +
									(active ? tone.chip + " ring-1 ring-current/30" : "border-border bg-card text-muted-foreground hover:bg-accent")
								}
							>
								<span className={"h-1.5 w-1.5 rounded-full " + tone.dot} />
								{t("review.summary.severity." + s, { count: totals[s] })}
							</button>
						);
					})}
					<button
						type="button"
						onClick={() => setFilter("all")}
						className={
							"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition " +
							(filter === "all"
								? "border-primary bg-primary/12 text-primary"
								: "border-border bg-card text-muted-foreground hover:bg-accent")
						}
					>
						{t("review.toolbar.all")}
					</button>
				</div>
			</div>

			{/* 视图区 */}
			<div className="min-h-0 flex-1 overflow-y-auto bg-background px-3 py-2">
				{view.kind === "files" ? (
					<div className="space-y-0.5">
						{visibleFiles.map((file) => (
							<FileRow
								key={file.path}
								file={file}
								active={false}
								expanded={false}
								onSelect={() => setView({ kind: "diff", filePath: file.path })}
							/>
						))}
						{visibleFiles.length === 0 ? (
							<div className="flex h-32 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
								<span className="h-6 w-6 icon-[mdi--shield-check-outline] opacity-50" />
								<p className="text-[12px]">{t("review.empty.title")}</p>
								<p className="max-w-56 text-[10px] leading-relaxed">{t("review.empty.hint")}</p>
							</div>
						) : null}
					</div>
				) : null}

				{view.kind === "diff" && activeFile ? (
					<div className="space-y-2">
						<button
							type="button"
							onClick={() => setView({ kind: "files" })}
							className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
						>
							<span className="h-3 w-3 icon-[mdi--arrow-left]" />
							<span>{t("review.toolbar.all")}</span>
						</button>
						<DiffView
							file={activeFile}
							selectedFindingId={null}
							onSelectFinding={(id) => setView({ kind: "finding", filePath: activeFile.path, findingId: id })}
							t={t}
						/>
						{activeFile.findings.length > 0 ? (
							<div className="space-y-1.5">
								<div className="text-[10px] font-medium text-muted-foreground">
									{t("review.column.findings")} ({activeFile.findings.length})
								</div>
								{activeFile.findings.map((finding) => (
									<button
										key={finding.id}
										type="button"
										onClick={() => setView({ kind: "finding", filePath: activeFile.path, findingId: finding.id })}
										className="w-full text-left"
									>
										<FindingDetail file={activeFile} finding={finding} t={t} />
									</button>
								))}
							</div>
						) : null}
					</div>
				) : null}

				{view.kind === "finding" && activeFile && activeFinding ? (
					<div className="space-y-2">
						<button
							type="button"
							onClick={() => setView({ kind: "diff", filePath: activeFile.path })}
							className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
						>
							<span className="h-3 w-3 icon-[mdi--arrow-left]" />
							<span>{activeFile.path}</span>
						</button>
						<FindingDetail file={activeFile} finding={activeFinding} t={t} />
						<DiffView
							file={activeFile}
							selectedFindingId={activeFinding.id}
							onSelectFinding={(id) => setView({ kind: "finding", filePath: activeFile.path, findingId: id })}
							t={t}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
