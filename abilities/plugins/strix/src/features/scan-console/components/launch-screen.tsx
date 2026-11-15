/**
 * 首屏 = 配置页。
 *
 * 这里曾经是一个输入框（"描述要测什么" + 发送键）。它存在的问题不是样式，而是职责：
 * 面板发出去的话，效果与用户直接在宿主输入框回车完全相同——那 120 行的投递逻辑
 * （先发、失败建会话、再失败交给宿主输入框）只是把同一件事做了三遍。
 *
 * 现在这一屏回答的是另一个问题：**这台机器、这次会话、这套工具，准备到哪一步了。**
 *
 *   模型 / 目录 / 执行环境（四态 + 检测与安装） / 团队 / 工具面 / 技能库 / 连接 / 运行日志
 *
 * 末尾一个「进入工作台」，不发送任何东西。说话的地方是宿主对话，这里不代劳。
 */

import { HackerRain } from "./hacker-rain";
import { manifestLabel } from "../../../domain/manifest-label";
import type { ModelChoice } from "../../../domain/model-label";
import type { McpConnection } from "../../../domain/mcp-roster";
import type { BridgeCapabilities, BridgeScope, BridgeTeam } from "../../../runtime-contract";
import type { LogLine } from "../hooks/use-strix-session";
import { StrixWordmark } from "./strix-wordmark";

export interface LaunchScreenProps {
	t: (key: string, params?: Record<string, string | number>) => string;
	model?: ModelChoice;
	/** 宿主打开的工作目录名：它是事实，放在事实表里，而不是日志里的一行。 */
	workspace?: string;
	/** 本次团队：安装之后用户看不到有谁，只能被告知。四个 chip，hover 给出职责。 */
	team?: BridgeTeam | null;
	/** 配置页的能力面：工具面与技能库的数量与来源（服务读的本地事实）。 */
	capabilities?: BridgeCapabilities;
	/** 已声明的范围：开始前要能看清"这次允许碰什么"。 */
	scope?: BridgeScope;
	/** MCP 连接：工具面能不能用，取决于这些连接是否活着。 */
	mcp?: readonly McpConnection[];
	log: readonly LogLine[];
	/** Bridge boot state. A live line, not a log entry. */
	boot: { state: "connecting" | "ready" | "failed"; detail?: string };
	version: string;
	/** 面板选的执行环境。 */
	environmentMode?: "auto" | "host" | "docker";
	/** docker 是否就绪——决定「容器」选项能不能选、「安装」按钮要不要出来。 */
	environmentReady?: boolean;
	/** 环境检测结果：docker 可用性与镜像是否已在本地。 */
	docker?: { ready: boolean; detail?: string; imagePresent: boolean | null } | null;
	onPullImage?: () => Promise<void>;
	onEnvironmentMode?: (mode: "auto" | "host" | "docker") => void;
	onInstallDocker?: () => void;
	onRefreshEnvironment?: () => void;
	/**
	 * 进工作台：不发送、不建会话。
	 *
	 * 首屏唯一的前进动作。以前这里是"发送键"，它同时承担了"开始"和"说一句话"，
	 * 于是用户想看一眼现场也必须先编一句话。
	 */
	onOpenWorkbench?: () => void;
	onQuit: () => void;
}

const MAX_LOG_ROWS = 6;

/** 角色 → 字形（与工具行同一套语义：字形说明"这是干什么的"）。 */
const TEAM_GLYPH: Record<string, string> = {
	master: "◉",
	researcher: "◎",
	developer: "◈",
	auditor: "≡",
};

/** 一行事实：左标签 + 右值，所有行共用两个栅格列（左边缘必须是一条线）。 */
function Row({
	label,
	children,
	state,
}: {
	label: string;
	children: React.ReactNode;
	state?: string;
}): React.ReactElement {
	return (
		<div className="astra-strix-row" {...(state ? { "data-state": state } : {})}>
			<span className="astra-strix-row-label">{label}</span>
			<span className="astra-strix-row-value">{children}</span>
		</div>
	);
}

export function LaunchScreen({
	t,
	model,
	workspace,
	team,
	capabilities,
	scope,
	mcp,
	log,
	boot,
	version,
	environmentMode: environmentModeProp,
	environmentReady,
	docker,
	onPullImage,
	onEnvironmentMode,
	onInstallDocker,
	onRefreshEnvironment,
	onOpenWorkbench,
	onQuit,
}: LaunchScreenProps): React.ReactElement {
	// 环境选择只影响「下一次」sandbox 启动：已经在跑的扫描不中途换环境。
	const environmentMode = environmentModeProp ?? "host";
	// 四态：host / noDocker / noImage / ready。判断顺序就是用户要做的决定顺序。
	const envState =
		environmentMode === "host" || environmentMode === "auto"
			? "host"
			: environmentMode === "docker" && (docker ? !docker.ready : environmentReady === false)
				? "noDocker"
				: docker?.imagePresent === false
					? "noImage"
					: "ready";

	const declared = scope?.entries.length ?? 0;
	const connections = mcp ?? [];

	return (
		<div
			className="astra-strix-term astra-strix-phosphor astra-strix-launch-surface"
			onKeyDown={(event) => {
				if (event.key === "c" && (event.ctrlKey || event.metaKey)) {
					event.preventDefault();
					onQuit();
				}
			}}
		>
			<HackerRain density="splash" />
			<div className="astra-strix-launch">
				<div className="astra-strix-launch-head">
					<StrixWordmark />
					<p className="astra-strix-tagline">{t("launch.tagline")}</p>
				</div>

				{/* 一条说明替代了原来的输入框：话在哪里说，说清楚，且不假装自己也能收。 */}
				<p className="astra-strix-launch-note">{t("launch.speakInChat")}</p>

				{/* 事实表：所有行共用两个栅格列，所以文字、下拉、按钮都落在同一条左边缘上。 */}
				<div className="astra-strix-rows">
					<Row label={t("scan.model")}>
						{model ? (
							<>
								<span className="astra-strix-meta-name">{model.name}</span>
								{/* provider 常常就是模型族名：包含在名字里就不再写一遍。 */}
								{model.provider && !model.name.toLowerCase().includes(model.provider.toLowerCase()) ? (
									<span className="astra-strix-dim"> · {model.provider}</span>
								) : null}
								<span className="astra-strix-dim"> · {t("launch.modelScope")}</span>
							</>
						) : (
							<>
								<span className="astra-strix-amber">{t("launch.noModel")}</span>
								<span className="astra-strix-dim"> · {t("launch.noModelHint")}</span>
							</>
						)}
					</Row>

					{workspace ? (
						<Row label={t("launch.folder")}>
							<span className="astra-strix-dim">{workspace}</span>
						</Row>
					) : null}

					{/* 执行环境：四态。
					    host     → 本机执行，无容器隔离
					    noDocker → 让宿主安装 docker
					    noImage  → 让宿主拉取沙箱镜像
					    ready    → 只说已就绪 */}
					<Row label={t("env.choice")} state={envState}>
						<span className="astra-strix-env-line">
							<select
								className="astra-strix-env-select"
								value={environmentMode}
								onChange={(event) => onEnvironmentMode?.(event.target.value as "auto" | "host" | "docker")}
								aria-label={t("env.choice")}
							>
								<option value="host">{t("env.host")}</option>
								<option value="docker">{t("env.docker")}</option>
								<option value="auto">{t("env.auto")}</option>
							</select>
							<span className="astra-strix-env-status">
								{envState === "host" ? t("env.statusHost") : null}
								{envState === "noDocker" ? t("env.statusNoDocker") : null}
								{envState === "noImage" ? t("env.statusNoImage") : null}
								{envState === "ready" ? t("env.statusReady") : null}
							</span>
							<span className="astra-strix-env-actions">
								{envState === "noDocker" ? (
									<button type="button" className="astra-strix-env-action" onClick={() => onInstallDocker?.()}>
										{t("env.install")}
									</button>
								) : null}
								{envState === "noImage" && onPullImage ? (
									<button type="button" className="astra-strix-env-action" onClick={() => void onPullImage()}>
										{t("env.pull")}
									</button>
								) : null}
								<button type="button" className="astra-strix-env-action" onClick={() => onRefreshEnvironment?.()}>
									{t("env.refresh")}
								</button>
							</span>
						</span>
					</Row>

					{/* 工具面：随包 40 个。数字来自服务读的本地目录，不是写死的文案。 */}
					<Row label={t("launch.tools")}>
						<span>{t("launch.toolsCount", { count: capabilities?.tools ?? 0 })}</span>
						<span className="astra-strix-dim"> · {connections.length ? t("launch.toolsWired") : t("launch.toolsCold")}</span>
					</Row>

					{/* 技能库：随包副本，运行时不再扫上游。来源如实写出来。 */}
					<Row label={t("launch.skills")}>
						<span>
							{t("launch.skillsCount", {
								count: capabilities?.skills ?? 0,
								categories: capabilities?.skillCategories ?? 0,
							})}
						</span>
						<span className="astra-strix-dim">
							{" · "}
							{capabilities?.skillSource === "env" ? t("launch.skillsFromEnv") : t("launch.skillsBundled")}
						</span>
					</Row>

					{/* 连接：MCP 就绪情况。没有连接时如实说没有，不画一个空壳。 */}
					<Row label={t("launch.connections")}>
						{connections.length ? (
							<span className="astra-strix-conn-list">
								{connections.map((entry) => (
									<span key={entry.name} className="astra-strix-conn" data-dead={entry.dead ? "yes" : "no"}>
										<span aria-hidden="true" className={entry.dead ? "astra-strix-amber" : "astra-strix-green"}>
											●
										</span>
										<span title={entry.provider}>{entry.name}</span>
										<span className="astra-strix-dim">{entry.toolCount}</span>
									</span>
								))}
							</span>
						) : (
							<span className="astra-strix-dim">{t("launch.connectionsNone")}</span>
						)}
					</Row>

					{/* 范围：声明过的目标。没声明就说没声明——那是"开始前该确认的事"。 */}
					<Row label={t("targets.title")}>
						{declared ? (
							<span className="astra-strix-dim">
								{t("launch.scopeDeclared", { count: declared })} · {scope?.entries.slice(0, 3).map((entry) => entry.value).join(" · ")}
							</span>
						) : (
							<span className="astra-strix-dim">{t("launch.scopeUndeclared")}</span>
						)}
					</Row>

					{team && team.members.length ? (
						<Row label={t("panel.team")}>
							<span className="astra-strix-team-chips">
								{team.members.map((member) => (
									<span
										key={member.id}
										className="astra-strix-team-chip"
										data-lead={member.lead ? "yes" : "no"}
										title={manifestLabel(t, member.responsibility)}
									>
										<span className="astra-strix-team-chip-glyph" aria-hidden="true">
											{TEAM_GLYPH[member.role ?? ""] ?? "·"}
										</span>
										{manifestLabel(t, member.name)}
									</span>
								))}
							</span>
						</Row>
					) : null}

					{log.length ? (
						<Row label="">
							<span className="astra-strix-launch-log" role="status">
								{log.slice(-MAX_LOG_ROWS).map((line, index) => (
									<span key={`${index}-${line.text}`} className={line.tone ? `astra-strix-${line.tone}` : "astra-strix-dim"}>
										{line.text}
									</span>
								))}
							</span>
						</Row>
					) : null}
				</div>

				{/* 唯一的前进动作：进工作台看现场。不发送任何东西。 */}
				<div className="astra-strix-launch-foot">
					{onOpenWorkbench ? (
						<button type="button" className="astra-strix-go" onClick={onOpenWorkbench}>
							{t("nav.workbench")}
						</button>
					) : null}
					<span className="astra-strix-hints">
						<span className="astra-strix-hint">
							<span className="astra-strix-key">ctrl+c</span>
							<span className="astra-strix-dim">{t("launch.hint.quit")}</span>
						</span>
					</span>

					<span className="astra-strix-boot-line">
						{boot.state === "connecting" ? (
							<span className="astra-strix-boot" role="status">
								<span className="astra-strix-spinner" aria-hidden="true" />
								<span>{t("boot.connecting")}</span>
							</span>
						) : boot.state === "failed" ? (
							<span className="astra-strix-boot" data-state="failed" role="status">
								<span className="astra-strix-amber" aria-hidden="true">
									!
								</span>
								<span>{t("boot.failed")}</span>
								{boot.detail ? <span className="astra-strix-dim"> — {boot.detail}</span> : null}
							</span>
						) : (
							<span className="astra-strix-boot" data-state="ready" role="status">
								<span className="astra-strix-green" aria-hidden="true">
									●
								</span>
								<span>{t("boot.ready")}</span>
							</span>
						)}
						<span className="astra-strix-dim astra-strix-hints-version">v{version}</span>
					</span>
				</div>
			</div>
		</div>
	);
}
