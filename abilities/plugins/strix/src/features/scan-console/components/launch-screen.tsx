/**
 * 首屏 = 配置页 + 说话的地方 + 免责声明。
 *
 * 这一屏回答三个问题，顺序就是用户问的顺序：
 *
 *   1. **怎么说**：对话框（`shared/components/panel-composer.tsx`）。占位符逐字敲出三个范例，
 *      文字交给宿主会话执行；
 *   2. **准备好没有**：模型 / 目录 / 执行环境 / 工具面 / 技能库 / 连接（含桥接状态）/ 目标 / 团队；
 *   3. **东西装在哪**：选了容器之后多一张「安装位置」表（默认收起）——宿主路径可点开，
 *      容器内路径只能复制一条 `docker exec` 命令（它不在宿主的文件系统里）。
 *
 * 底部是一段小字免责声明。这类工具会真的发起网络访问与命令执行，说清楚是产品责任。
 */

import { useState } from "react";
import { PanelComposer } from "../../../shared/components/panel-composer";
import { COMPOSER_HINTS } from "../../../shared/components/use-typewriter";
import { HackerBackdrop } from "./hacker-backdrop";
import { HackerRain } from "./hacker-rain";
import { InstallPathsPanel } from "./install-paths-panel";
import { manifestLabel } from "../../../domain/manifest-label";
import type { ModelChoice } from "../../../domain/model-label";
import type { McpConnection } from "../../../domain/mcp-roster";
import type { BridgeCapabilities, BridgeInstallPaths, BridgeScope, BridgeTeam } from "../../../runtime-contract";
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
	/** 「装在哪」：只在容器可用时由服务给出。 */
	installPaths?: BridgeInstallPaths;
	/** 打开一条宿主路径（在系统文件管理器里定位）；不可用时面板退回复制。 */
	onOpenPath?: (path: string) => void;
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
	/** 服务解析出来的这次真实落点（`/api/environment` 的 mode）；没探测过时为空。 */
	resolvedMode?: "host" | "docker";
	onPullImage?: () => Promise<void>;
	onEnvironmentMode?: (mode: "auto" | "host" | "docker") => void;
	onInstallDocker?: () => void;
	onRefreshEnvironment?: () => void;
	/** 进工作台：不发送、不建会话。 */
	onOpenWorkbench?: () => void;
	/** 把这一句交给宿主对话（宿主的会话、模型与权限执行它）。 */
	onSend?: (text: string) => void;
	/** 团队会话：面板没有正确的落点，输入框换成一句说明。 */
	readOnly?: boolean;
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

/**
 * 执行环境这一次会落在哪。
 *
 * 1.2.1 之前"自动"永远显示成"本机"：判据读的是 preference 字符串本身。
 * 现在先解析、后命名——`resolvedMode` 是服务算出来的真实落点，preference 只决定措辞。
 */
export type EnvironmentState = "host" | "autoDocker" | "autoNoImage" | "autoHost" | "noDocker" | "noImage" | "ready";

export function environmentState(input: {
	mode: "auto" | "host" | "docker";
	resolved?: "host" | "docker";
	docker?: { ready: boolean; imagePresent: boolean | null } | null;
}): EnvironmentState {
	const { mode, resolved, docker } = input;
	if (mode === "host") return "host";
	const daemon = docker?.ready ?? false;
	const image = docker?.imagePresent;

	if (mode === "auto") {
		if (!daemon) return "autoHost";
		// 服务说这次是容器，就按容器说；镜像缺失单独一档（要能点拉取）。
		if (resolved === "docker") return image === false ? "autoNoImage" : "autoDocker";
		return "autoHost";
	}

	// 显式 docker：三态与以前一致。
	if (!daemon) return "noDocker";
	if (image === false) return "noImage";
	return "ready";
}

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
	installPaths,
	onOpenPath,
	log,
	boot,
	version,
	environmentMode: environmentModeProp,
	environmentReady,
	docker,
	resolvedMode,
	onPullImage,
	onEnvironmentMode,
	onInstallDocker,
	onRefreshEnvironment,
	onOpenWorkbench,
	onSend,
	readOnly,
	onQuit,
}: LaunchScreenProps): React.ReactElement {
	// 草稿存在这一屏：离开首屏再回来时，没发出去的话还在（与宿主的草稿互不干扰）。
	const [draft, setDraft] = useState("");
	// 环境选择只影响「下一次」sandbox 启动：已经在跑的扫描不中途换环境。
	const environmentMode = environmentModeProp ?? "host";
	const envState = environmentState({
		mode: environmentMode,
		...(resolvedMode ? { resolved: resolvedMode } : {}),
		docker: docker ?? (environmentReady === false ? { ready: false, imagePresent: null } : null),
	});

	const declared = scope?.entries.length ?? 0;
	const connections = mcp ?? [];
	const dockerMode = resolvedMode === "docker" || environmentMode === "docker";

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
			{/* 底子：极光 + 网格 + 扫光。颜色取自 --sx-aurora-*，与绿字同族。 */}
			<HackerBackdrop density="splash" />
			<HackerRain density="splash" />
			<div className="astra-strix-launch">
				{/* 标题与副标题与对话框同轴居中：这一列的重心在上面。 */}
				<div className="astra-strix-launch-head">
					<StrixWordmark />
					<p className="astra-strix-tagline">{t("launch.tagline")}</p>
				</div>

				{onSend ? (
					<PanelComposer
						t={t}
						value={draft}
						onChange={setDraft}
						onSend={() => {
							if (!draft.trim()) return;
							onSend(draft);
							setDraft("");
						}}
						labelKey="launch.label"
						placeholderKey="launch.placeholder"
						hints={COMPOSER_HINTS.launch}
						{...(readOnly ? { readOnly } : {})}
						{...(onOpenWorkbench ? { onOpenWorkbench } : {})}
					/>
				) : null}

				{/* 事实表：所有行共用两个栅格列，所以文字、下拉、按钮都落在同一条左边缘上。 */}
				<div className="astra-strix-rows">
					<Row label={t("scan.model")}>
						{model ? (
							<>
								<span className="astra-strix-meta-name">{model.name}</span>
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

					{/* 执行环境：七态。自动必须说"这次会怎么做"，不能一律说本机（1.2.1 的谎）。
					    host        → 本机执行，无容器隔离
					    autoDocker  → 自动：会跑在容器里
					    autoNoImage → 自动：镜像还没拉（可点拉取）
					    autoHost    → 自动：没有容器，跑在本机
					    noDocker    → 让宿主安装 docker
					    noImage     → 让宿主拉取沙箱镜像
					    ready       → 只说已就绪 */}
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
							<span className="astra-strix-env-status" data-state={envState}>
								{envState === "host" ? t("env.statusHost") : null}
								{envState === "autoDocker" ? t("env.statusAutoDocker") : null}
								{envState === "autoNoImage" ? t("env.statusAutoNoImage") : null}
								{envState === "autoHost" ? t("env.statusAutoHost") : null}
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
								{envState === "noImage" || envState === "autoNoImage" ? (
									onPullImage ? (
										<button type="button" className="astra-strix-env-action" onClick={() => void onPullImage()}>
											{t("env.pull")}
										</button>
									) : null
								) : null}
								<button type="button" className="astra-strix-env-action" onClick={() => onRefreshEnvironment?.()}>
									{t("env.refresh")}
								</button>
							</span>
						</span>
					</Row>

					{/* 装在哪：容器可用时才出现。默认收起，点开是一张两列对齐的表。 */}
					{dockerMode && installPaths ? (
						<InstallPathsPanel t={t} paths={installPaths} {...(onOpenPath ? { onOpen: onOpenPath } : {})} />
					) : null}

					{/* 工具面：随包 40 个。数字来自服务读的本地目录，不是写死的文案。 */}
					<Row label={t("launch.tools")}>
						<span>{t("launch.toolsCount", { count: capabilities?.tools ?? 0 })}</span>
						<span className="astra-strix-dim"> · {connections.length ? t("launch.toolsWired") : t("launch.toolsCold")}</span>
					</Row>

					{/* 技能库那一行已移除：它只显示 0 篇 · 0 类，对用户没有信息量（1.5.0）。
					    真实数量由 `strix_list_skills` 工具回答，面板不再占一行。 */}

					{/* 连接：MCP 就绪情况 + 桥接状态。桥接状态原先独占首屏最底下一整行，
					    信息只有"就绪"两个字；它属于这一组事实。 */}
					<Row label={t("launch.connections")}>
						<span className="astra-strix-conn-lines">
							<span className="astra-strix-conn-list">
								{connections.length ? (
									connections.map((entry) => (
										<span key={entry.name} className="astra-strix-conn" data-dead={entry.dead ? "yes" : "no"}>
											<span aria-hidden="true" className={entry.dead ? "astra-strix-amber" : "astra-strix-green"}>
												●
											</span>
											<span title={entry.provider}>{entry.name}</span>
											<span className="astra-strix-dim">{entry.toolCount}</span>
										</span>
									))
								) : (
									<span className="astra-strix-dim">{t("launch.connectionsNone")}</span>
								)}
							</span>
							<span className="astra-strix-bridge-line" data-state={boot.state} role="status">
								{boot.state === "connecting" ? (
									<>
										<span className="astra-strix-spinner" aria-hidden="true" />
										<span className="astra-strix-dim">{t("boot.connecting")}</span>
									</>
								) : boot.state === "failed" ? (
									<>
										<span className="astra-strix-amber" aria-hidden="true">
											!
										</span>
										<span className="astra-strix-amber">{t("boot.failed")}</span>
										{boot.detail ? <span className="astra-strix-dim"> — {boot.detail}</span> : null}
									</>
								) : (
									<>
										<span className="astra-strix-green" aria-hidden="true">
											●
										</span>
										<span className="astra-strix-dim">{t("boot.ready")}</span>
									</>
								)}
								<span className="astra-strix-dim"> · v{version}</span>
							</span>
						</span>
					</Row>

					{/* 范围：声明过的目标。没声明就说没声明——那是"开始前该确认的事"。 */}
					<Row label={t("targets.title")}>
						{declared ? (
							<span className="astra-strix-dim">
								{t("launch.scopeDeclared", { count: declared })} ·{" "}
								{scope?.entries
									.slice(0, 3)
									.map((entry) => entry.value)
									.join(" · ")}
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

				{/* 免责声明：小字、上边框、可读但不抢视线。工具会真的发起网络访问与命令执行，
				    这一段是产品责任，不是免责套路。
				    用项目符号而不是一段长文：长句会被跳读，条目会被看完。 */}
				<footer className="astra-strix-disclaimer" aria-label={t("legal.title")}>
					<p className="astra-strix-disclaimer-title">{t("legal.title")}</p>
					<ul className="astra-strix-disclaimer-list">
						{[1, 2, 3, 4, 5, 6]
							.map((index) => t(`legal.point${index}`))
							// 空串才丢：缺翻译时让 key 显形（与面板其他位置一致），而不是静默少一条。
							.filter((line) => Boolean(line))
							.map((line, index) => (
								<li key={index}>{line}</li>
							))}
					</ul>
					<p className="astra-strix-disclaimer-dim">{t("legal.scope")}</p>
				</footer>
			</div>
		</div>
	);
}
