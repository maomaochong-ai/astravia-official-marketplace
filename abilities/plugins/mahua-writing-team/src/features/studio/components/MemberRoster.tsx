import { useTranslation } from "@astravia-org/plugin-sdk";
import type { StudioMember } from "../../../studio-members.js";

interface MemberRosterProps {
	members: readonly StudioMember[];
	busy: boolean;
	/** 把这位叫上场：经对话桥发一条他的派活话术（ADR 0011 §2.2）。 */
	onInvite(member: StudioMember): void;
}

/**
 * 成员胶囊行，对齐宿主团队会话的 `TeamMemberRoster`：一人一枚、直接写名字、
 * 队长带角标、最右一格是「设置位」——宿主那格是团队设置，这里没有设置页（ADR-0105），
 * 于是交回给调用方放在右侧。
 *
 * 与宿主的一处刻意差异：点胶囊不是「打开该成员的会话」（SDK 不提供成员级会话绑定），
 * 而是把这位叫进当前会话。无障碍标签把这件事说清楚，免得被当成导航。
 *
 * 尺寸按设计稿的元信息层收：标签是 9px 等宽小字，胶囊高 24px、11px 正文，
 * 这样它与旁边的章号、字数处在同一层，不会把书页的标题层压过去。
 */
export function MemberRoster({ members, busy, onInvite }: MemberRosterProps) {
	const { t } = useTranslation();

	return (
		<div className="flex items-center gap-2">
			<span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
				{t("roster.label")}
			</span>
			<ul className="flex flex-wrap items-center gap-1.5">
				{members.map((member) => {
					const name = t(member.nameKey);
					return (
						<li key={member.agentId}>
							<button
								type="button"
								disabled={busy}
								title={t(member.dutyKey)}
								aria-label={t("roster.invite", { member: name })}
								onClick={() => onInvite(member)}
								className="flex h-6 items-center gap-1.5 rounded-full border border-border/60 bg-card px-2 text-[11px] text-foreground transition-colors hover:border-border hover:bg-muted/60 disabled:opacity-40"
							>
								<span
									aria-hidden="true"
									className={`size-1.5 rounded-full ${member.lead ? "bg-primary" : "bg-muted-foreground/50"}`}
								/>
								<span className={member.lead ? "font-semibold" : "font-normal"}>{name}</span>
								{member.lead ? (
									<span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/70">
										{t("roster.lead")}
									</span>
								) : null}
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
