import { useTranslation } from "@astravia-org/plugin-sdk";
import type { WorkbenchModel } from "../../hooks/use-workbench";
import type { ActivityEntry } from "../../state";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";

export interface ActivityPageProps {
	model: WorkbenchModel;
}

function timeLabel(at: string): string {
	const date = new Date(at);
	if (Number.isNaN(date.getTime())) return at;
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** 每种结果一个图标 + 配色；未知种类回落到 info。 */
function iconFor(kind: ActivityEntry["kind"]): { icon: string; tone: string } {
	switch (kind) {
		case "report":
			return { icon: "nav-reports", tone: "text-purple" };
		case "strings":
			return { icon: "nav-strings", tone: "text-text-3" };
		case "symbols":
			return { icon: "layout", tone: "text-text-3" };
		case "disasm":
			return { icon: "nav-disasm", tone: "text-blue" };
		case "decompile":
			return { icon: "code", tone: "text-blue" };
		case "diff":
			return { icon: "nav-compare", tone: "text-amber" };
		case "signature":
			return { icon: "nav-signature", tone: "text-green" };
		case "checklist":
			return { icon: "clipboard", tone: "text-purple" };
		case "probe":
			return { icon: "chip", tone: "text-text-3" };
		case "docs":
			return { icon: "nav-docs", tone: "text-text-3" };
		case "hook":
			return { icon: "sparkle", tone: "text-amber" };
		case "protocol":
			return { icon: "message", tone: "text-blue" };
		// case "other":
		default:
			return { icon: "info", tone: "text-text-4" };
	}
}

/** 载荷预览：挑出能一眼看懂的部分，完整内容留给对话里的 markdown。 */
function preview(entry: ActivityEntry): string {
	if (!entry.payload) return "";
	const top = Object.entries(entry.payload).slice(0, 6);
	return top.map(([key, value]) => `${key}: ${formatValue(value)}`).join(" · ");
}

function formatValue(value: unknown): string {
	if (typeof value === "string") return value.length > 40 ? `${value.slice(0, 39)}…` : value;
	if (typeof value === "number") return String(value);
	if (typeof value === "boolean") return value ? "yes" : "no";
	if (Array.isArray(value)) return `${value.length} items`;
	if (value && typeof value === "object") return "…";
	return String(value ?? "");
}

/**
 * 活动页：对话里 Agent 跑过的每个工具结果都出现在这里，按时间倒序。
 *
 * 这是「宿主在对话里产生、面板同步显示」的落点——strings / disasm / diff / checklist 等
 * 几十个工具的结果，在聊天流里只是滚动文字，在面板则是可回放、可扫读的轨迹。
 */
export function ActivityPage({ model }: ActivityPageProps) {
	const { t } = useTranslation();
	const entries = model.activity.entries;

	return (
		<>
			<PageHeader
				title={t("page.activity.title")}
				description={t("page.activity.lead")}
				actions={
					entries.length > 0 ? (
						<button
							type="button"
							onClick={model.activity.clear}
							className="flex items-center gap-1 rounded px-2 py-1 text-[10.5px] text-text-3 hover:bg-surface-hover hover:text-text"
						>
							<Icon name="close" className="size-3" />
							{t("page.activity.clear")}
						</button>
					) : null
				}
			/>
			<div className="space-y-3 p-4">
				{entries.length === 0 ? (
					<Card title={t("page.activity.empty.title")} bodyClassName="p-3.5">
						<ol className="space-y-2">
							{(t("page.activity.empty.steps").split("\n") as string[]).map((step, index) => (
								<li key={index} className="flex items-start gap-2.5">
									<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-4 font-mono text-[10px] text-text-2">
										{index + 1}
									</span>
									<div className="min-w-0 text-[10.5px] leading-relaxed text-text-4">{step}</div>
								</li>
							))}
						</ol>
					</Card>
				) : (
					<Card bodyClassName="divide-y divide-line-subtle">
						{entries.map(entry => {
							const meta = iconFor(entry.kind);
							return (
								<div key={entry.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
									<span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-3 ${meta.tone}`}>
										<Icon name={meta.icon} className="size-3.5" />
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex items-baseline gap-2">
											<span className="font-mono text-[11px] font-medium text-text">{entry.toolId}</span>
											<span className="shrink-0 text-[9.5px] uppercase tracking-wide text-text-4">{timeLabel(entry.at)}</span>
											{entry.kind !== "other" ? (
												<span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text-3">{entry.kind}</span>
											) : null}
										</div>
										<div className="mt-0.5 text-[11px] leading-snug text-text-2">{entry.summary}</div>
										{entry.target ? <div className="mt-0.5 truncate font-mono text-[10px] text-text-4">{entry.target}</div> : null}
										{entry.payload ? <div className="mt-0.5 truncate text-[10px] text-text-4">{preview(entry)}</div> : null}
									</div>
								</div>
							);
						})}
					</Card>
				)}
			</div>
		</>
	);
}