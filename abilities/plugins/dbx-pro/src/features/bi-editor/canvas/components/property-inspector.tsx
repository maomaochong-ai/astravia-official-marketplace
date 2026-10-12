/**
 * property-inspector.tsx — 右栏属性面板。
 *
 * 双模式：
 *   · 无节点选中 → 页面级设置（主题/画布尺寸/统计）
 *   · 有节点选中 → 按 kind 渲染节点属性表单
 *
 * 节点属性 schema 在 node-schema.ts 定义，PropertyInspector 读 kind 查字段。
 */

import { type JSX } from "react";
import type { BigscreenPage } from "../hooks/use-bigscreen-pages";
import type { NodePos, Link } from "./node-graph";
import { NODE_SCHEMA } from "./node-schema";
import { Icon } from "../../shar../../shared/component../../shar../../shared/component../../shar../../shared/component../../shar../../shared/components/ui/icon";
import type { EngineConnectionSummary } from "../../../../shared/services/engine-client";
import type { NodeResult } from "../hooks/use-canvas-execution";

export interface SelectedNodeInfo {
	id: string;
	node: NodePos;
}

export function PropertyInspector({
	page,
	theme,
	onThemeChange,
	selectedNode,
	onNodeUpdate,
	collapsed = false,
	onToggleCollapsed,
	nodes,
	links = [],
	connections = [],
	nodeResults = {},
}: {
	page: BigscreenPage;
	theme: "dark" | "default";
	onThemeChange: (t: "dark" | "default") => void;
	selectedNode?: SelectedNodeInfo | null;
	onNodeUpdate?: (id: string, patch: Partial<NodePos>) => void;
	collapsed?: boolean;
	onToggleCollapsed?: () => void;
	nodes?: Record<string, NodePos>;
	links?: Link[];
	connections?: EngineConnectionSummary[];
	nodeResults?: Record<string, NodeResult>;
}): JSX.Element {
	const isScreen = page.style === "bigScreen";

	if (collapsed) {
		return (
			<div className="flex w-10 shrink-0 flex-col items-center gap-1 border-l border-border bg-surface-raised py-2">
				<button type="button" onClick={onToggleCollapsed}
					className="grid size-7 place-items-center rounded-control text-faint hover:bg-accent-soft hover:text-accent" title="展开属性面板">
					<Icon name="icon-[lucide--panel-right-open]" className="size-3.5" />
				</button>
			</div>
		);
	}

	return (
		<div className="flex w-72 shrink-0 flex-col border-l border-border bg-surface-raised">
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-[12px] font-medium">
				<span className="text-muted">属性</span>
				<span className="text-surface-foreground">·</span>
				<span className="text-accent">
					{selectedNode ? `节点 · ${selectedNode.node.kind ?? selectedNode.id.slice(0, 8)}` : "页面"}
				</span>
				<button type="button" onClick={onToggleCollapsed}
					className="ml-auto grid size-6 place-items-center rounded-control text-faint hover:bg-accent-soft hover:text-accent" title="收起属性面板">
					<Icon name="icon-[lucide--panel-right-close]" className="size-3.5" />
				</button>
			</div>

			<div className="dbx-scroll min-h-0 flex-1 overflow-y-auto p-3 space-y-4">
				{selectedNode && onNodeUpdate ? (
					<NodePropertyForm
						id={selectedNode.id}
						node={selectedNode.node}
						onUpdate={onNodeUpdate}
						nodes={nodes}
						links={links}
						connections={connections}
						nodeResults={nodeResults}
					/>
				) : (
					<>
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
								<ThemeSwatch active={theme === "default"} label="明亮" onClick={() => onThemeChange("default")} colors={["#f8fafc", "#e2e8f0", "#3b82f6"]} />
								<ThemeSwatch active={theme === "dark"} label="深色" onClick={() => onThemeChange("dark")} colors={["#0b1424", "#1e293b", "#3b82f6"]} />
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
					</>
				)}
			</div>
		</div>
	);
}

function NodePropertyForm({
	id, node, onUpdate, nodes, links, connections, nodeResults,
}: { id: string; node: NodePos; onUpdate: (id: string, patch: Partial<NodePos>) => void; nodes?: Record<string, NodePos>; links?: Link[]; connections?: EngineConnectionSummary[]; nodeResults?: Record<string, NodeResult> }) {
	const kind = node.kind ?? "";
	const schema = NODE_SCHEMA[kind] ?? NODE_SCHEMA._default;
	const isSource = kind.startsWith("source-");

	// ── 取数链路：从 links 反推上游数据源 ──
	const upstreamNodes = (links ?? [])
		.filter((l) => l.to === id)
		.map((l) => nodes?.[l.from])
		.filter((n): n is NodePos => !!n);

	// ── 消费者：links 中 from === id 的下游节点 ──
	const downstreamLinks = (links ?? []).filter((l) => l.from === id);
	const consumerNodes = downstreamLinks.map((l) => nodes?.[l.to]).filter((n): n is NodePos => !!n);

	// ── 当前节点的执行结果 ──
	const result = nodeResults?.[id];

	return (
		<>
			<section>
				<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">节点信息</h3>
				<div className="space-y-1.5">
					<Row label="Kind">
						<span className="font-mono text-[11px] text-surface-foreground">{kind || "(未指定)"}</span>
					</Row>
					<Row label="ID">
						<span className="font-mono text-[11px] text-faint">{id}</span>
					</Row>
					<Row label="尺寸">
						<span className="font-mono text-[11px] text-muted">{Math.round(node.w)} × {Math.round(node.h)}</span>
					</Row>
					<Row label="位置">
						<span className="font-mono text-[11px] text-muted">({Math.round(node.x)}, {Math.round(node.y)})</span>
					</Row>
				</div>
			</section>

			{/* 数据源节点增强面板 — 对齐设计稿 data.tsx */}
			{isSource && upstreamNodes.length > 0 ? (
				<section>
					<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">取数链路</h3>
					<div className="flex flex-wrap items-center gap-1.5">
						{upstreamNodes.map((n, i) => (
							<div key={i} className="flex items-center gap-1.5">
								<span className="rounded-chip border border-border bg-surface px-2 py-0.5 text-[10px] text-surface-foreground">
									{n.kind ?? "node"}
								</span>
								<Icon name="icon-[lucide--arrow-right]" className="size-3 text-faint" />
							</div>
						))}
						<span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[10px] text-accent">
							→ {kind}
						</span>
					</div>
				</section>
			) : null}

			{/* 数据源节点消费者面板 */}
			{isSource && consumerNodes.length > 0 ? (
				<section>
					<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">谁在用 ({consumerNodes.length})</h3>
					<div className="space-y-0.5">
						{consumerNodes.map((n, i) => (
							<div key={i} className="flex h-6 items-center gap-1.5 rounded-control border border-transparent px-1 text-[11px] hover:border-border hover:bg-surface">
								<Icon name="icon-[lucide--corner-down-left]" className="size-3 shrink-0 text-faint" />
								<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-surface-foreground">{n.kind ?? "node"}</span>
								<span className="shrink-0 text-[9px] text-faint">→ 下游</span>
							</div>
						))}
					</div>
				</section>
			) : null}

			<section>
				<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">属性 · {schema.label}</h3>
				<div className="space-y-2">
					{schema.fields.map((f) => (
						<Field key={f.key} field={f} node={node} onUpdate={(patch) => onUpdate(id, patch)} connections={connections} />
					))}
				</div>
			</section>

			{/* 执行结果 */}
			{result && (
				<section>
					<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">执行结果</h3>
					<div className="space-y-1.5">
						{result.error ? (
							<div className="rounded-card border border-danger/30 bg-danger/5 p-2 text-[11px] text-danger">
								{result.error}
							</div>
						) : (
							<>
								<Row label="行数">
									<span className="font-mono text-[11px] text-surface-foreground">{result.rowCount}</span>
								</Row>
								<Row label="耗时">
									<span className="font-mono text-[11px] text-surface-foreground">{result.durationMs}ms</span>
								</Row>
								<Row label="列">
									<span className="font-mono text-[10px] text-muted truncate">{result.columns.join(", ") || "(无)"}</span>
								</Row>
							</>
						)}
					</div>
				</section>
			)}

			<section>
				<h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">外观</h3>
				<div className="space-y-1.5">
					<Row label="Tone">
						<div className="flex gap-1">
							{["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"].map((c) => (
								<button
									type="button"
									key={c}
									onClick={() => onUpdate(id, { tone: c })}
									className={`size-5 rounded-[3px] border-2 ${node.tone === c ? "border-surface-foreground" : "border-border"}`}
									style={{ background: c }}
								/>
							))}
						</div>
					</Row>
					<Row label="宽">
						<input
							type="number"
							value={Math.round(node.w)}
							onChange={(e) => onUpdate(id, { w: Number(e.target.value) })}
							className="h-7 w-full rounded-control border border-border bg-surface px-2 font-mono text-[11px] text-surface-foreground"
						/>
					</Row>
					<Row label="高">
						<input
							type="number"
							value={Math.round(node.h)}
							onChange={(e) => onUpdate(id, { h: Number(e.target.value) })}
							className="h-7 w-full rounded-control border border-border bg-surface px-2 font-mono text-[11px] text-surface-foreground"
						/>
					</Row>
				</div>
			</section>
		</>
	);
}

function Field({
	field, node, onUpdate, connections,
}: { field: { key: string; label: string; type: "text" | "number" | "select" | "textarea"; options?: string[] }; node: NodePos; onUpdate: (patch: Partial<NodePos>) => void; connections?: EngineConnectionSummary[] }) {
	const values = node.values ?? {};
	const current = values[field.key];
	const setVal = (v: unknown) => onUpdate({ values: { ...values, [field.key]: v } });

	// 数据源下拉：使用真实连接列表
	const isDatasourceField = field.key === "datasourceId";
	const datasourceOptions = connections ?? [];

	return (
		<Row label={field.label}>
			{field.type === "select" && (isDatasourceField || field.options) ? (
				<select
					value={String(current ?? "")}
					onChange={(e) => setVal(e.target.value)}
					className="h-7 w-full rounded-control border border-border bg-surface px-1 text-[11px] text-surface-foreground"
				>
					<option value="">— 选择数据源 —</option>
					{isDatasourceField
						? datasourceOptions.map((c) => (
							<option key={c.name} value={c.name}>
								{c.name} ({c.type})
							</option>
						))
						: field.options?.map((o) => <option key={o} value={o}>{o}</option>)
					}
				</select>
			) : field.type === "textarea" ? (
				<textarea
					rows={2}
					value={String(current ?? "")}
					onChange={(e) => setVal(e.target.value)}
					className="w-full rounded-control border border-border bg-surface px-2 py-1 font-mono text-[11px] text-surface-foreground"
					placeholder={`// ${field.key}`}
				/>
			) : field.type === "number" ? (
				<input
					type="number"
					value={current === undefined || current === "" ? "" : Number(current)}
					onChange={(e) => setVal(e.target.value === "" ? "" : Number(e.target.value))}
					className="h-7 w-full rounded-control border border-border bg-surface px-2 font-mono text-[11px] text-surface-foreground"
				/>
			) : (
				<input
					type="text"
					value={String(current ?? "")}
					onChange={(e) => setVal(e.target.value)}
					className="h-7 w-full rounded-control border border-border bg-surface px-2 text-[11px] text-surface-foreground"
					placeholder={field.key}
				/>
			)}
		</Row>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-start gap-2">
			<span className="w-14 shrink-0 pt-1 text-[11px] text-muted">{label}</span>
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}

function ThemeSwatch({ active, label, colors, onClick }: { active: boolean; label: string; colors: string[]; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex flex-col gap-1 rounded-control border p-1.5 transition ${active ? "border-accent ring-1 ring-accent/30" : "border-border hover:border-border-strong"}`}
		>
			<div className="flex gap-0.5">
				{colors.map((c, i) => <div key={i} className="h-4 flex-1 rounded-control" style={{ background: c }} />)}
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
