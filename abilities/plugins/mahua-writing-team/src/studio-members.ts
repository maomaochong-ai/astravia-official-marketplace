/**
 * 团队的四位成员（ADR 0011）。视图的成员胶囊、叫上场的话术、守卫测试都读这一份：
 * 顺序在此处定义一次，清单里的 `agent.agents` / `agent.teams[].members` 若与它不同序，
 * 守卫测试会红。
 */
export interface StudioMember {
	/** manifest `agent.agents[].id`。 */
	agentId: string;
	/** 名字的文案 key。 */
	nameKey: string;
	/** 团队里的职责，用作胶囊的副标题与无障碍标签。 */
	dutyKey: string;
	/** 把这位叫上场时发出去的那句话。 */
	inviteKey: string;
	/** 队长：宿主团队会话里带角标的那位，`members[0]`。 */
	lead: boolean;
}

export const STUDIO_MEMBERS: readonly StudioMember[] = [
	{
		agentId: "mahua-architect",
		nameKey: "agent.architect.name",
		dutyKey: "team.studio.architect",
		inviteKey: "invite.architect",
		lead: true,
	},
	{
		agentId: "mahua-writer",
		nameKey: "agent.writer.name",
		dutyKey: "team.studio.writer",
		inviteKey: "invite.writer",
		lead: false,
	},
	{
		agentId: "mahua-editor",
		nameKey: "agent.editor.name",
		dutyKey: "team.studio.editor",
		inviteKey: "invite.editor",
		lead: false,
	},
	{
		agentId: "mahua-arbiter",
		nameKey: "agent.arbiter.name",
		dutyKey: "team.studio.arbiter",
		inviteKey: "invite.arbiter",
		lead: false,
	},
];

/** 团队 id 同时也是新会话上下文区的激活条件。 */
export const STUDIO_TEAM_ID = "mahua-studio";
