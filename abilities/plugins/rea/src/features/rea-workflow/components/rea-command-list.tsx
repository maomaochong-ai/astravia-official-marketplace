/**
 * 可运行命令清单：每行一条真实 rea CLI 命令，点 ▶ 直接在该工作目录执行。
 *
 * 目标占位符未填写时按钮禁用（需要目标的命令），避免跑出 `analyze "" ` 这种空参数。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { formatCommandLine, type ReaCommandDefinition } from "../data/commands";

interface CommandListProps {
	readonly commands: readonly ReaCommandDefinition[];
	readonly target: string;
	readonly busy: boolean;
	readonly activeCommandId: string | null;
	readonly onRun: (command: ReaCommandDefinition) => void;
}

export function ReaCommandList({ commands, target, busy, activeCommandId, onRun }: CommandListProps): JSX.Element {
	const { t } = useTranslation();
	if (commands.length === 0) {
		return <p className="text-[11px] leading-relaxed text-muted-foreground">{t("tab.workbench.commandsEmpty")}</p>;
	}
	return (
		<ul className="flex flex-col gap-1">
			{commands.map((command) => {
				const blocked = command.needsTarget && target.trim().length === 0;
				const isActive = activeCommandId === command.id;
				return (
					<li key={command.id}>
						<div
							className={`flex items-start gap-2 rounded-[min(var(--radius-md),8px)] border px-2 py-1.5 ${
								isActive ? "border-primary/40 bg-primary/10" : "border-border bg-background/40"
							}`}
						>
							<button
								type="button"
								onClick={() => onRun(command)}
								disabled={busy || blocked}
								title={blocked ? t("tab.workbench.targetRequired") : t("tab.run.run")}
								aria-label={`${t("tab.run.run")}: ${formatCommandLine(command, target)}`}
								className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-[10px] text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground"
							>
								{busy && isActive ? (
									<span aria-hidden className="icon-[lucide--loader-circle] size-3 motion-safe:animate-spin" />
								) : (
									<span aria-hidden className="icon-[lucide--play] size-3" />
								)}
							</button>
							<div className="min-w-0 flex-1">
								<p className="truncate text-[11.5px] leading-tight text-foreground/90">{t(command.labelKey)}</p>
								<code className="mt-0.5 block truncate font-mono text-[10px] leading-tight text-muted-foreground">
									{formatCommandLine(command, target)}
								</code>
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
