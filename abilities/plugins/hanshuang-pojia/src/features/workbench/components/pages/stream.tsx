import { useTranslation } from "@astravia-org/plugin-sdk";
import type { WorkbenchModel } from "../../hooks/use-workbench";
import type { TaskStreamEntry } from "../../state";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";

export interface TaskStreamPageProps {
	model: WorkbenchModel;
}

function timeLabel(at: string): string {
	const date = new Date(at);
	if (Number.isNaN(date.getTime())) return at;
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function phaseClass(entry: TaskStreamEntry): { icon: string; tone: string; pulse: boolean } {
	switch (entry.phase) {
		case "tool-start":
		case "turn-start":
			return { icon: "play", tone: "text-amber", pulse: true };
		case "tool-end":
			return entry.isError ? { icon: "error", tone: "text-red", pulse: false } : { icon: "check", tone: "text-green", pulse: false };
		case "turn-end":
			return { icon: "check", tone: "text-green", pulse: false };
		case "conversation":
			return entry.streaming ? { icon: "radio", tone: "text-blue", pulse: true } : { icon: "radio", tone: "text-text-3", pulse: false };
	}
}

function toolOf(entry: TaskStreamEntry): string {
	return entry.toolName ?? (entry.phase === "conversation" ? "conversation" : "turn");
}

/**
 * 任务实时流：宿主方向会传来「正在发生什么」的轻量生命周期——会话连上、turn 开始结束、
 * 每个插件工具调用开始 / 结束（含失败）。比 activity 更“当下”：那是跑完留在面板的结果，
 * 这是面板上实时刷新的心跳。
 */
export function TaskStreamPage({ model }: TaskStreamPageProps) {
	const { t } = useTranslation();
	const { entries, active, clear } = model.stream;

	return (
		<>
			<PageHeader
				title={t("page.stream.title")}
				description={t("page.stream.lead")}
				actions={
					entries.length > 0 ? (
						<button
							type="button"
							onClick={clear}
							className="flex items-center gap-1 rounded px-2 py-1 text-[10.5px] text-text-3 hover:bg-surface-hover hover:text-text"
						>
							<Icon name="close" className="size-3" />
							{t("page.stream.clear")}
						</button>
					) : null
				}
			/>
			<div className="space-y-3 p-4">
				{entries.length === 0 ? (
					<Card title={t("page.stream.empty.title")} bodyClassName="p-3.5">
						<ol className="space-y-2">
							{(t("page.stream.empty.steps").split("\n") as string[]).map((step, index) => (
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
					<div className="space-y-3">
						{active ? (
							<div className="flex items-center gap-2 px-1 text-[10.5px] text-amber">
								<span className="size-2 shrink-0 animate-pulse rounded-full bg-amber" />
								{t("page.stream.active")}
							</div>
						) : null}
						<Card bodyClassName="divide-y divide-line-subtle">
							{entries.map(entry => {
								const meta = phaseClass(entry);
								return (
									<div key={entry.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
										<span className={`relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-3 ${meta.tone}`}>
											<Icon name={meta.icon} className="size-3.5" />
											{meta.pulse ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber" /> : null}
										</span>
										<div className="min-w-0 flex-1">
											<div className="flex items-baseline gap-2">
												<span className="min-w-0 truncate font-mono text-[11px] font-medium text-text">{toolOf(entry)}</span>
												<span className="shrink-0 text-[9.5px] uppercase tracking-wide text-text-4">{timeLabel(entry.at)}</span>
												<span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text-3">{entry.phase}</span>
											</div>
											<div className="mt-0.5 text-[11px] leading-snug text-text-2">{entry.summary}</div>
											{entry.sessionId ? <div className="mt-0.5 truncate font-mono text-[10px] text-text-4">{entry.sessionId}</div> : null}
										</div>
									</div>
								);
							})}
						</Card>
					</div>
				)}
			</div>
		</>
	);
}