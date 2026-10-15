/**
 * 6 阶段流程原理图 —— 每阶段一张 inline SVG。
 *
 * 颜色策略：宿主 CSS variables（--primary / --card / --border / --muted / --warning）
 * 已经是 rgb(...) 字符串，不再包 hsl(...)。半透明用 `rgb(from var(--x) r g b / N)`
 * 相对色语法（Chromium 119+）。
 *
 * 风格约定：
 *   - 节点 12px 圆角矩形
 *   - 主干 stroke="var(--primary)" 高亮，失败分支 stroke="var(--warning, ...)"
 *   - 字体 10-11px
 *   - 不依赖外部资源，全部 inline
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { StageDiagram } from "../data/stages";

interface DiagramProps {
	readonly kind: StageDiagram;
}

const VIEW = { width: 720, height: 220 };
const PRIMARY = "var(--primary)";
const PRIMARY_FILL_8 = "rgb(from var(--primary) r g b / 0.08)";
const PRIMARY_FILL_10 = "rgb(from var(--primary) r g b / 0.10)";
const PRIMARY_FILL_12 = "rgb(from var(--primary) r g b / 0.12)";
const WARNING = "var(--warning, #d97706)";
const WARNING_FILL_10 = "rgb(from var(--warning, #d97706) r g b / 0.10)";

/** 节点：圆角矩形 + 子元素。 */
function Node({
	x,
	y,
	width,
	height,
	fill,
	stroke,
	strokeWidth = 1,
	children,
}: {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	stroke: string;
	strokeWidth?: number;
	children: React.ReactNode;
}): JSX.Element {
	return (
		<g>
			<rect
				x={x}
				y={y}
				width={width}
				height={height}
				rx={8}
				ry={8}
				fill={fill}
				stroke={stroke}
				strokeWidth={strokeWidth}
			/>
			{children}
		</g>
	);
}

function Arrow({ x1, y1, x2, y2, dashed }: { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }): JSX.Element {
	return (
		<line
			x1={x1}
			y1={y1}
			x2={x2}
			y2={y2}
			stroke="currentColor"
			strokeWidth={1.2}
			strokeDasharray={dashed ? "4 3" : undefined}
			markerEnd="url(#rea-arrow)"
		/>
	);
}

function ArrowDef(): JSX.Element {
	return (
		<defs>
			<marker id="rea-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
				<path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
			</marker>
		</defs>
	);
}

/** Stage 1 — Connect：探测 → 失败模式（3 种）→ 兜底 */
function ConnectDecisionTree(): JSX.Element {
	const { t } = useTranslation();
	return (
		<svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className="text-muted-foreground w-full" role="img" aria-label={t("tab.detail.connect.diagramAria")}>
			<ArrowDef />
			<Node x={20} y={90} width={120} height={44} fill={PRIMARY_FILL_8} stroke={PRIMARY} strokeWidth={1.5}>
				<text x={80} y={116} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={500}>
					rea doctor --json
				</text>
			</Node>
			<Arrow x1={140} y1={112} x2={190} y2={112} />
			<Node x={200} y={20} width={140} height={40} fill="transparent" stroke={WARNING} strokeWidth={1}>
				<text x={270} y={36} textAnchor="middle" className="fill-amber-700 dark:fill-amber-400" fontSize={10}>
					{`① ${t("tab.diagram.connect.fail1")}`}
				</text>
				<text x={270} y={50} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					not installed
				</text>
			</Node>
			<Node x={200} y={90} width={140} height={40} fill="transparent" stroke={WARNING} strokeWidth={1}>
				<text x={270} y={106} textAnchor="middle" className="fill-amber-700 dark:fill-amber-400" fontSize={10}>
					{`② ${t("tab.diagram.connect.fail2")}`}
				</text>
				<text x={270} y={120} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					version mismatch
				</text>
			</Node>
			<Node x={200} y={160} width={140} height={40} fill="transparent" stroke={WARNING} strokeWidth={1}>
				<text x={270} y={176} textAnchor="middle" className="fill-amber-700 dark:fill-amber-400" fontSize={10}>
					{`③ ${t("tab.diagram.connect.fail3")}`}
				</text>
				<text x={270} y={190} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					permission denied
				</text>
			</Node>
			<Arrow x1={140} y1={112} x2={190} y2={40} />
			<Arrow x1={140} y1={112} x2={190} y2={180} />
			<Arrow x1={340} y1={40} x2={410} y2={100} />
			<Arrow x1={340} y1={110} x2={410} y2={110} />
			<Arrow x1={340} y1={180} x2={410} y2={120} />
			<Node x={420} y={90} width={140} height={44} fill={PRIMARY_FILL_12} stroke={PRIMARY} strokeWidth={1.5}>
				<text x={490} y={108} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={500}>
					--dry-run
				</text>
				<text x={490} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					read-only verify
				</text>
			</Node>
			<Arrow x1={560} y1={112} x2={610} y2={112} />
			<Node x={620} y={90} width={84} height={44} fill="transparent" stroke="currentColor" strokeWidth={1}>
				<text x={662} y={108} textAnchor="middle" className="fill-foreground" fontSize={10}>
					→ rea route
				</text>
				<text x={662} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					{`(${t("tab.diagram.nextStage")})`}
				</text>
			</Node>
		</svg>
	);
}

/** Stage 2 — Route：22 类型 → 4 大类分流 */
function RouteFanOut(): JSX.Element {
	const { t } = useTranslation();
	return (
		<svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className="text-muted-foreground w-full" role="img" aria-label={t("tab.detail.route.diagramAria")}>
			<ArrowDef />
			<Node x={20} y={90} width={120} height={44} fill={PRIMARY_FILL_8} stroke={PRIMARY} strokeWidth={1.5}>
				<text x={80} y={108} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={500}>
					22 targets
				</text>
				<text x={80} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					native / .NET / JS / Android
				</text>
			</Node>
			<Arrow x1={140} y1={112} x2={200} y2={40} />
			<Arrow x1={140} y1={112} x2={200} y2={95} />
			<Arrow x1={140} y1={112} x2={200} y2={155} />
			<Arrow x1={140} y1={112} x2={200} y2={205} />
			<Node x={210} y={20} width={140} height={40} fill="transparent" stroke="currentColor" strokeWidth={1}>
				<text x={280} y={36} textAnchor="middle" className="fill-foreground" fontSize={10}>
					{`① ${t("tab.diagram.route.bucket1")}`}
				</text>
				<text x={280} y={50} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					{t("tab.diagram.route.bucket1Hint")}
				</text>
			</Node>
			<Node x={210} y={75} width={140} height={40} fill="transparent" stroke="currentColor" strokeWidth={1}>
				<text x={280} y={91} textAnchor="middle" className="fill-foreground" fontSize={10}>
					{`② ${t("tab.diagram.route.bucket2")}`}
				</text>
				<text x={280} y={105} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					{t("tab.diagram.route.bucket2Hint")}
				</text>
			</Node>
			<Node x={210} y={135} width={140} height={40} fill="transparent" stroke="currentColor" strokeWidth={1}>
				<text x={280} y={151} textAnchor="middle" className="fill-foreground" fontSize={10}>
					{`③ ${t("tab.diagram.route.bucket3")}`}
				</text>
				<text x={280} y={165} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					{t("tab.diagram.route.bucket3Hint")}
				</text>
			</Node>
			<Node x={210} y={185} width={140} height={40} fill="transparent" stroke="currentColor" strokeWidth={1}>
				<text x={280} y={201} textAnchor="middle" className="fill-foreground" fontSize={10}>
					{`④ ${t("tab.diagram.route.bucket4")}`}
				</text>
				<text x={280} y={215} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					{t("tab.diagram.route.bucket4Hint")}
				</text>
			</Node>
			<Arrow x1={350} y1={40} x2={400} y2={112} dashed />
			<Arrow x1={350} y1={95} x2={400} y2={112} dashed />
			<Arrow x1={350} y1={155} x2={400} y2={112} dashed />
			<Arrow x1={350} y1={205} x2={400} y2={112} dashed />
			<Node x={410} y={90} width={160} height={44} fill={PRIMARY_FILL_12} stroke={PRIMARY} strokeWidth={1.5}>
				<text x={490} y={108} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={500}>
					{t("tab.diagram.route.mode")}
				</text>
				<text x={490} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					auto | guided | step
				</text>
			</Node>
			<Arrow x1={570} y1={112} x2={620} y2={112} />
			<Node x={630} y={90} width={80} height={44} fill="transparent" stroke="currentColor" strokeWidth={1}>
				<text x={670} y={108} textAnchor="middle" className="fill-foreground" fontSize={10}>
					→ rea summary
				</text>
				<text x={670} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					{`(${t("tab.diagram.nextStage")})`}
				</text>
			</Node>
		</svg>
	);
}

/** Stage 3 — Summary：5 字段报告 */
function SummaryFiveFields(): JSX.Element {
	const { t } = useTranslation();
	return (
		<svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className="text-muted-foreground w-full" role="img" aria-label={t("tab.detail.summary.diagramAria")}>
			<Node x={20} y={90} width={130} height={44} fill={PRIMARY_FILL_8} stroke={PRIMARY} strokeWidth={1.5}>
				<text x={85} y={108} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={500}>
					raw findings
				</text>
				<text x={85} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					multi-source
				</text>
			</Node>
			<Arrow x1={150} y1={112} x2={190} y2={112} />
			<Node x={200} y={90} width={150} height={44} fill="transparent" stroke="currentColor" strokeWidth={1}>
				<text x={275} y={108} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={500}>
					5-field report
				</text>
				<text x={275} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					who / where / what / why / evidence
				</text>
			</Node>
			<Arrow x1={350} y1={112} x2={390} y2={112} />
			<g>
				{[
					{ y: 18, label: "who", hint: "subject" },
					{ y: 58, label: "where", hint: "offset/symbol" },
					{ y: 98, label: "what", hint: "behavior" },
					{ y: 138, label: "why", hint: "trigger" },
					{ y: 178, label: "evidence", hint: "line/byte/ref" },
				].map((row) => (
					<g key={row.label}>
						<rect x={400} y={row.y} width={170} height={28} rx={6} ry={6} fill="var(--card)" stroke="var(--border)" strokeWidth={1} />
						<text x={414} y={row.y + 18} className="fill-foreground" fontSize={10} fontWeight={500}>
							{row.label}
						</text>
						<text x={566} y={row.y + 18} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
							{row.hint}
						</text>
					</g>
				))}
			</g>
			<Arrow x1={570} y1={112} x2={620} y2={112} />
			<Node x={630} y={90} width={80} height={44} fill="transparent" stroke="currentColor" strokeWidth={1}>
				<text x={670} y={108} textAnchor="middle" className="fill-foreground" fontSize={10}>
					→ rea plan
				</text>
				<text x={670} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					{`(${t("tab.diagram.nextStage")})`}
				</text>
			</Node>
		</svg>
	);
}

/** Stage 4 — Plan：8 步循环 */
function PlanEightSteps(): JSX.Element {
	const { t } = useTranslation();
	const steps: ReadonlyArray<{ key: string; label: string }> = [
		{ key: "1", label: t("tab.diagram.plan.step1") },
		{ key: "2", label: t("tab.diagram.plan.step2") },
		{ key: "3", label: t("tab.diagram.plan.step3") },
		{ key: "4", label: t("tab.diagram.plan.step4") },
		{ key: "5", label: t("tab.diagram.plan.step5") },
		{ key: "?", label: t("tab.diagram.plan.step6") },
		{ key: "✓", label: t("tab.diagram.plan.step7") },
		{ key: "↺", label: t("tab.diagram.plan.step8") },
	];
	return (
		<svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className="text-muted-foreground w-full" role="img" aria-label={t("tab.detail.plan.diagramAria")}>
			<ArrowDef />
			{steps.map((step, i) => {
				const cx = 40 + i * 82;
				const isQuestion = step.key === "?";
				const isLoop = step.key === "↺";
				const fill = isQuestion ? WARNING_FILL_10 : isLoop ? "var(--muted)" : PRIMARY_FILL_10;
				const stroke = isQuestion ? WARNING : isLoop ? "var(--muted-foreground)" : PRIMARY;
				return (
					<g key={step.key + i}>
						<circle cx={cx} cy={50} r={22} fill={fill} stroke={stroke} strokeWidth={1.4} />
						<text x={cx} y={55} textAnchor="middle" className="fill-foreground" fontSize={12} fontWeight={600}>
							{step.key}
						</text>
						<text x={cx} y={100} textAnchor="middle" className="fill-muted-foreground" fontSize={9.5}>
							{step.label}
						</text>
						{i < steps.length - 1 ? (
							<line
								x1={cx + 22}
								y1={50}
								x2={cx + 60}
								y2={50}
								stroke="currentColor"
								strokeWidth={1.2}
								markerEnd="url(#rea-arrow)"
							/>
						) : null}
					</g>
				);
			})}
			<path
				d={`M ${40 + 7 * 82} 80 Q ${40 + 7 * 82} 180 ${40} 180`}
				stroke="var(--muted-foreground)"
				strokeWidth={1.2}
				fill="none"
				strokeDasharray="4 3"
				markerEnd="url(#rea-arrow)"
			/>
			<text x={VIEW.width / 2} y={170} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
				{t("tab.diagram.plan.loopHint")}
			</text>
			<text x={VIEW.width / 2} y={195} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
				{`→ ${t("tab.diagram.plan.handoff")}`}
			</text>
		</svg>
	);
}

/** Stage 5 — Read：6 份 references 分流 */
function ReadReferencesRouting(): JSX.Element {
	const { t } = useTranslation();
	const refs = [
		{ name: "connection-and-recovery", hint: t("tab.diagram.read.ref1") },
		{ name: "native-and-artifacts", hint: t("tab.diagram.read.ref2") },
		{ name: "javascript-applications", hint: t("tab.diagram.read.ref3") },
		{ name: "android-applications", hint: t("tab.diagram.read.ref4") },
		{ name: "runtime-observation", hint: t("tab.diagram.read.ref5") },
		{ name: "evidence-workflows", hint: t("tab.diagram.read.ref6") },
	];
	return (
		<svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className="text-muted-foreground w-full" role="img" aria-label={t("tab.detail.read.diagramAria")}>
			<ArrowDef />
			<Node x={20} y={90} width={130} height={44} fill={PRIMARY_FILL_8} stroke={PRIMARY} strokeWidth={1.5}>
				<text x={85} y={108} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={500}>
					summary
				</text>
				<text x={85} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					who / where / what
				</text>
			</Node>
			<line x1={150} y1={112} x2={210} y2={112} stroke="currentColor" strokeWidth={1.2} markerEnd="url(#rea-arrow)" />
			<Node x={220} y={90} width={70} height={44} fill="transparent" stroke="currentColor" strokeWidth={1}>
				<text x={255} y={108} textAnchor="middle" className="fill-foreground" fontSize={10}>
					rea read
				</text>
				<text x={255} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					--ref
				</text>
			</Node>
			<g>
				{refs.map((r, i) => {
					const y = 20 + i * 32;
					return (
						<g key={r.name}>
							<rect x={310} y={y} width={210} height={26} rx={5} ry={5} fill="var(--card)" stroke="var(--border)" strokeWidth={1} />
							<text x={320} y={y + 17} className="fill-foreground" fontSize={9.5} fontWeight={500}>
								{r.name}.md
							</text>
							<text x={510} y={y + 17} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
								{r.hint}
							</text>
						</g>
					);
				})}
			</g>
			<text x={565} y={218} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
				{`→ ${t("tab.diagram.read.handoff")}`}
			</text>
		</svg>
	);
}

/** Stage 6 — Finish：5 步交付清单 */
function FinishChecklist(): JSX.Element {
	const { t } = useTranslation();
	const checks = [
		t("tab.diagram.finish.check1"),
		t("tab.diagram.finish.check2"),
		t("tab.diagram.finish.check3"),
		t("tab.diagram.finish.check4"),
		t("tab.diagram.finish.check5"),
	];
	return (
		<svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className="text-muted-foreground w-full" role="img" aria-label={t("tab.detail.finish.diagramAria")}>
			<ArrowDef />
			<g>
				{checks.map((c, i) => {
					const y = 24 + i * 36;
					return (
						<g key={i}>
							<rect x={20} y={y} width={16} height={16} rx={3} ry={3} fill={PRIMARY_FILL_12} stroke={PRIMARY} strokeWidth={1.2} />
							<path d={`M ${22} ${y + 8} L ${26} ${y + 12} L ${34} ${y + 4}`} stroke={PRIMARY} strokeWidth={1.5} fill="none" />
							<text x={48} y={y + 13} className="fill-foreground" fontSize={11}>
								{c}
							</text>
						</g>
					);
				})}
			</g>
			<line x1={420} y1={112} x2={470} y2={112} stroke="currentColor" strokeWidth={1.2} markerEnd="url(#rea-arrow)" />
			<Node x={480} y={90} width={130} height={44} fill={PRIMARY_FILL_12} stroke={PRIMARY} strokeWidth={1.5}>
				<text x={545} y={108} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={500}>
					rea finish
				</text>
				<text x={545} y={122} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
					--report / --handoff
				</text>
			</Node>
			<text x={VIEW.width / 2} y={210} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
				{t("tab.diagram.finish.handoff")}
			</text>
		</svg>
	);
}

export function ReaWorkflowStageDiagram({ kind }: DiagramProps): JSX.Element {
	switch (kind) {
		case "connect-decision-tree":
			return <ConnectDecisionTree />;
		case "route-fan-out":
			return <RouteFanOut />;
		case "summary-five-fields":
			return <SummaryFiveFields />;
		case "plan-eight-steps":
			return <PlanEightSteps />;
		case "read-references-routing":
			return <ReadReferencesRouting />;
		case "finish-checklist":
			return <FinishChecklist />;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}
