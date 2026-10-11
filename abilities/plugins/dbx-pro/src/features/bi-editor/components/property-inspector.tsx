/**
 * property-inspector.tsx — 右栏属性面板（按设计稿 PropertyInspector 简化）。
 *
 * Phase C1：只显示页面级设置（主题/背景/尺寸）。
 * Phase C2：选中节点后切换到节点属性表单。
 */

import { type JSX } from "react";
import type { BigscreenPage } from "../hooks/use-bigscreen-pages";

export function PropertyInspector({
	page,
	theme,
	onThemeChange,
}: {
	page: BigscreenPage;
	theme: "dark" | "default";
	onThemeChange: (t: "dark" | "default") => void;
}): JSX.Element {
	const isScreen = page.style === "bigScreen";

	return (
		<div className="flex w-72 shrink-0 flex-col border-l border-border bg-surface-raised">
			<div className="flex h-9 shrink-0 items-center border-b border-border px-3 text-[12px] font-medium text-muted">
				属性 · <span className="text-surface-foreground">页面</span>
			</div>

			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto p-3 space-y-4">
				{/* 基本信息 */}
				<section>
					<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">基本信息</h3>
					<div className="space-y-1.5">
						<Row label="名称">
							<span className="truncate text-[12px] text-surface-foreground">{page.name}</span>
						</Row>
						<Row label="类型">
							<span className="text-[12px] text-surface-foreground">{isScreen ? "大屏" : "看板"}</span>
						</Row>
						<Row label="ID">
							<span className="font-mono truncate text-[11px] text-faint">{page.id}</span>
						</Row>
					</div>
				</section>

				{/* 主题设置 */}
				<section>
					<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">主题</h3>
					<div className="grid grid-cols-2 gap-1.5">
						<ThemeSwatch
							active={theme === "default"}
							label="明亮"
							onClick={() => onThemeChange("default")}
							colors={["#f8fafc", "#e2e8f0", "#3b82f6"]}
						/>
						<ThemeSwatch
							active={theme === "dark"}
							label="深色"
							onClick={() => onThemeChange("dark")}
							colors={["#0b1424", "#1e293b", "#3b82f6"]}
						/>
					</div>
				</section>

				{/* 画布尺寸 */}
				<section>
					<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">画布尺寸</h3>
					<div className="grid grid-cols-2 gap-1.5">
						<SizeBtn active={isScreen} label="1920 × 1080 (16:9)" hint="大屏" />
						<SizeBtn active={!isScreen} label="自适应" hint="看板" />
					</div>
				</section>

				{/* 统计 */}
				<section>
					<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">统计</h3>
					<div className="grid grid-cols-2 gap-1.5">
						<Stat label="保存次数" value={page.updateCount} />
						<Stat label="访问量" value={page.visits} />
					</div>
				</section>

				{/* 选中节点提示 */}
				<div className="rounded-card border border-dashed border-border p-3 text-center text-[11px] text-muted">
					<span className="font-mono text-faint">◈</span>
					<p className="mt-1">未选中任何节点</p>
					<p className="mt-0.5 text-faint">画布中点击组件以编辑其属性</p>
				</div>
			</div>
		</div>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-14 shrink-0 text-[11px] text-muted">{label}</span>
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}

function ThemeSwatch({
	active,
	label,
	colors,
	onClick,
}: {
	active: boolean;
	label: string;
	colors: string[];
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex flex-col gap-1 rounded-control border p-1.5 transition ${active ? "border-accent ring-1 ring-accent/30" : "border-border hover:border-border-strong"}`}
		>
			<div className="flex gap-0.5">
				{colors.map((c, i) => (
					<div key={i} className="h-4 flex-1 rounded-control" style={{ background: c }} />
				))}
			</div>
			<span className="text-[10px] text-muted">{label}</span>
		</button>
	);
}

function SizeBtn({ active, label, hint }: { active: boolean; label: string; hint: string }) {
	return (
		<div className={`rounded-control border p-1.5 text-[10px] ${active ? "border-accent bg-accent/5 text-accent" : "border-border text-muted"}`}>
			<div>{label}</div>
			<div className="font-mono text-[9px] text-faint">{hint}</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-control border border-border bg-surface p-2">
			<div className="font-mono text-[14px] tabular-nums text-surface-foreground">{value}</div>
			<div className="text-[10px] text-faint">{label}</div>
		</div>
	);
}
