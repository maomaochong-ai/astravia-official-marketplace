/**
 * Strix's launch screen, reproduced for the activity tab.
 *
 * Shape and wording are upstream's (setup.go:setupBody): wordmark, tagline, the
 * composer with its model line inside the panel, the feedback log under it, and
 * the key hints closed by the version. What differs is who the model is: the chip
 * shows the host conversation's model. There is no model call in this plugin — the host
 * agent owns the loop and reaches us through the `strix_*` MCP tools.
 *
 * The panel is a terminal surface - black, monospace, green accents - rather than
 * a host-themed card. That is the point of this tab: it looks like `strix` opening
 * in a terminal, so the launch screen has to be the one upstream ships.
 */

import { useState } from "react";
import { useComposerHeight } from "../hooks/use-composer-height";
import { HackerRain } from "./hacker-rain";
import { manifestLabel } from "../../../domain/manifest-label";
import type { ModelChoice } from "../../../domain/model-label";
import type { BridgeTeam } from "../../../runtime-contract";
import type { LogLine } from "../hooks/use-strix-session";
import { StrixWordmark } from "./strix-wordmark";

export interface LaunchScreenProps {
	t: (key: string) => string;
	model?: ModelChoice;
	/** 宿主打开的工作目录名：它是事实，放在事实表里，而不是日志里的一行。 */
	workspace?: string;
	/**
	 * 本次团队（1.0.12）：安装之后用户看不到有谁，只能被告知。
	 * 四个 chip 让人在开始前就知道这次谁上场，hover 给出职责。
	 */
	team?: BridgeTeam | null;
	log: readonly LogLine[];
	/** Bridge boot state. A live line, not a log entry. */
	boot: { state: "connecting" | "ready" | "failed"; detail?: string };
	version: string;
	/** Why Enter cannot launch yet (no model, no Docker); empty when it can. */
	blocked?: string;
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
	onSubmit: (value: string) => void;
	/**
	 * 直接进工作台（1.0.13）：不发送消息，只是去看现场。
	 *
	 * 为什么需要它：首屏此前只有"发一句话"这一条路进工作台，于是"我想看看刚才那轮跑到哪了"
	 * 也必须先编一句话。团队会话尤其明显——那边没有胶囊开关，用户没有别的入口。
	 */
	onOpenWorkbench?: () => void;
	/**
 * 团队会话：面板在这条表面上只读。
	 *
	 * 宿主的 `sendPrompt` / `insertText` 在团队会话里都指向错的会话（`pluginSendMessageRef`
	 * 与 `inputValueAtom` 都不跟着团队切换），所以宁可把发送键换成一专说明，
	 * 也不发出去再说。
	 */
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

export function LaunchScreen({
	t,
	model,
	workspace,
	team,
	log,
	boot,
	version,
	blocked,
	environmentMode: environmentModeProp,
	environmentReady,
	docker,
	onPullImage,
	onEnvironmentMode,
	onInstallDocker,
	onRefreshEnvironment,
	onSubmit,
	onOpenWorkbench,
	readOnly,
	onQuit,
}: LaunchScreenProps): React.ReactElement {
	const [value, setValue] = useState("");
	// 环境选择只影响「下一次」sandbox 启动：已经在跑的扫描不中途换环境。
	const environmentMode = environmentModeProp ?? "host";
	// 三态：本机 / docker 缺失 / docker 就绪但镜像未拉 / 全就绪。
	const envState: "host" | "noDocker" | "noImage" | "ready" =
		environmentMode === "host"
			? "host"
			: environmentMode === "docker" && (docker ? !docker.ready : environmentReady === false)
				? "noDocker"
				: docker?.imagePresent === false
					? "noImage"
					: "ready";
	// 同一个高度状态，两个屏共用：启动页与扫描屏的输入框行为必须一致。
	const composer = useComposerHeight();

	const submit = (): void => {
		// 流式中发送是合法的：宿主会排队（sendPrompt → queued），不是错。
		// 真正不能发的只有空文本——发送键与 Enter 共用这一条。
		if (!value.trim()) return;
		onSubmit(value);
	};

	// 一行起步、最多六行：多行输入是例外，不是常态（1.0.7 收窄了初版的三行）。
	const rows = Math.min(6, Math.max(1, value.split("\n").length));

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

				{/* One panel holds the prompt and the model line, flush under it, the way
				    upstream's composer panel reads as a single unit. The handle on its top edge
				    is the same control as the scan screen's: drag up = taller. */}
				<div
					className="astra-strix-prompt"
					data-blocked={blocked ? "yes" : "no"}
					{...(composer.height ? { style: { "--sx-composer-h": `${composer.height}px` } as React.CSSProperties } : {})}
				>
					<div
						className="astra-strix-resize-handle"
						role="separator"
						aria-orientation="horizontal"
						aria-label={t("composer.resize")}
						tabIndex={0}
						{...composer.handleProps}
					/>
					<div className="astra-strix-prompt-row">
						<span className="astra-strix-prompt-caret" aria-hidden="true">
							&gt;
						</span>
						<label className="astra-strix-prompt-field">
							<textarea
								className="astra-strix-prompt-input"
								aria-label={t("launch.label")}
								placeholder={t("launch.placeholder")}
								rows={rows}
								autoFocus
								value={value}
								onChange={(event) => setValue(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
										event.preventDefault();
										submit();
									}
								}}
							/>
						</label>
					</div>
					{/* 框内底条：左边告诉你键位，右边是发送键。与文本分开一行，
					    即使输入多行长高，按钮也不会被挤到文字中间（用户指出的“输入框内部按钮重新布局”）。 */}
					<div className="astra-strix-composer-bar">
						<span className="astra-strix-dim">{t("launch.hint.send")}</span>
						{onOpenWorkbench ? (
							<button type="button" className="astra-strix-go" onClick={onOpenWorkbench}>
								{t("nav.workbench")}
							</button>
						) : null}
						{/* 团队会话：面板没有可写的落点，发送键直接换成一专说明，
						    而不是让用户按下去才发现。 */}
						{readOnly ? (
							<span className="astra-strix-amber astra-strix-readonly-note">{t("launch.teamReadOnly")}</span>
						) : (
							<button type="button" className="astra-strix-send" onClick={submit} disabled={!value.trim()}>
								{t("composer.send")}
							</button>
						)}
					</div>


				</div>

				{/* 输入框以下：两列 facts（标签列 + 值列）。所有行共用两个栅格列，
				    所以文字、下拉、按钮都落在同一条左边缘上——之前每行各自缩进，看起来参差。 */}
				<div className="astra-strix-rows">
					<div className="astra-strix-row" data-missing={model ? "no" : "yes"}>
						<span className="astra-strix-row-label">{t("scan.model")}</span>
						<span className="astra-strix-row-value">
							{model ? (
								<>
									<span className="astra-strix-meta-name">{model.name}</span>
									{/* provider 常常就是模型族名（deepseek-flash · deepseek-v4-flash）：
									    当它包含在名字里就不再写一遍——一行里两个相似串只是噪声。 */}
									{model.provider && !model.name.toLowerCase().includes(model.provider.toLowerCase()) ? (
										<span className="astra-strix-dim"> · {model.provider}</span>
									) : null}
									<span className="astra-strix-dim"> · {t("launch.modelScope")}</span>
								</>
							) : (
								<>
									<span>{t("launch.noModel")}</span>
									<span className="astra-strix-dim"> · {t("launch.noModelHint")}</span>
								</>
							)}
						</span>
					</div>

					{/* 工作目录：以前它是**日志里的一行**（“已挂载工作目录: xxx”），现在它是事实，
					    就放在事实表里；没有目录时这一行不画。 */}
					{workspace ? (
						<div className="astra-strix-row">
							<span className="astra-strix-row-label">{t("launch.folder")}</span>
							<span className="astra-strix-row-value astra-strix-dim">{workspace}</span>
						</div>
					) : null}

					{/* 执行环境：四态。
					    host        → 本机执行，无容器隔离
					    noDocker    → 让宿主安装 docker
					    noImage    → 让宿主拉取沙箱镜像
					    ready       → 只说已就绪 */}
					<div className="astra-strix-row" data-state={envState}>
						<span className="astra-strix-row-label">{t("env.choice")}</span>
						<span className="astra-strix-row-value">
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
								{/* 动作跟下拉在同一条 flex 行上（1.0.8）：另起一行就是“刷新环境”单独掉下去。 */}
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
						</span>
					</div>


					{/* 团队：名单来自 plugin.json，不是面板编的。队长高亮，其余按角色给字形。 */}
					{team && team.members.length ? (
						<div className="astra-strix-row">
							<span className="astra-strix-row-label">{t("panel.team")}</span>
							<span className="astra-strix-row-value astra-strix-team-chips">
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
						</div>
					) : null}

					{log.length ? (
						<div className="astra-strix-row">
							<span className="astra-strix-row-label" />
							<span className="astra-strix-row-value astra-strix-launch-log" role="status">
								{log.slice(-MAX_LOG_ROWS).map((line, index) => (
									<span key={`${index}-${line.text}`} className={line.tone ? `astra-strix-${line.tone}` : "astra-strix-dim"}>
										{line.text}
									</span>
								))}
							</span>
						</div>
					) : null}

				</div>

				{/* 底部小字：快捷键、版本、桥接状态。这些东西每帧都在，但不是每帧都要看，
				    所以从“一行一条”收成一条脚注——上面只留决策需要的东西（模型 / 环境）。 */}
				<div className="astra-strix-launch-foot">
					<span className="astra-strix-hints">
						<span className="astra-strix-hint">
							<span className="astra-strix-key">enter</span>
							<span className="astra-strix-dim">{t("launch.hint.enter")}</span>
						</span>
						<span className="astra-strix-hint">
							<span className="astra-strix-key">ctrl+c</span>
							<span className="astra-strix-dim">{t("launch.hint.quit")}</span>
						</span>
						{/* Shift+Enter 已经在输入框底条里说了一次，此处不重复（1.0.8）。 */}
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

				{blocked ? <p className="astra-strix-launch-blocked">{blocked}</p> : null}
			</div>
		</div>
	);
}

