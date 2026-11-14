/**
 * Strix's launch screen, reproduced for the activity tab.
 *
 * Shape and wording are upstream's (setup.go:setupBody): wordmark, tagline, the
 * composer with its model line inside the panel, the feedback log under it, and
 * the key hints closed by the version. What differs is who the model is: the chip
 * shows the host's model, because the loop runs on `ctx.ai`.
 *
 * The panel is a terminal surface - black, monospace, green accents - rather than
 * a host-themed card. That is the point of this tab: it looks like `strix` opening
 * in a terminal, so the launch screen has to be the one upstream ships.
 */

import { useState } from "react";
import { useComposerHeight } from "../hooks/use-composer-height";
import { HackerRain } from "./hacker-rain";
import type { ModelChoice } from "../../../domain/model-label";
import type { LogLine } from "../hooks/use-strix-session";
import { StrixWordmark } from "./strix-wordmark";

export interface LaunchScreenProps {
	t: (key: string) => string;
	model?: ModelChoice;
	log: readonly LogLine[];
	/** Bridge boot state. A live line, not a log entry (ADR strix-0004). */
	boot: { state: "connecting" | "ready" | "failed"; detail?: string };
	version: string;
	/** Why Enter cannot launch yet (no model, no Docker); empty when it can. */
	blocked?: string;
	/** 面板选的执行环境（ADR 0013）。 */
	environmentMode?: "auto" | "host" | "docker";
	/** docker 是否就绪——决定「容器」选项能不能选、「安装」按钮要不要出来。 */
	environmentReady?: boolean;
	/** 环境检测结果：docker 可用性与镜像是否已在本地（ADR 0013）。 */
	docker?: { ready: boolean; detail?: string; imagePresent: boolean | null } | null;
	onPullImage?: () => Promise<void>;
	onEnvironmentMode?: (mode: "auto" | "host" | "docker") => void;
	onInstallDocker?: () => void;
	onRefreshEnvironment?: () => void;
	busy: boolean;
	onSubmit: (value: string) => void;
	onQuit: () => void;
}

const MAX_LOG_ROWS = 6;

export function LaunchScreen({
	t,
	model,
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
	busy,
	onSubmit,
	onQuit,
}: LaunchScreenProps): React.ReactElement {
	const [value, setValue] = useState("");
	// 环境选择只影响「下一次」sandbox 启动（ADR 0013）：已经在跑的扫描不中途换环境。
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
		if (busy) return;
		onSubmit(value);
	};

	// Upstream opens at three rows and grows to eight before the composer scrolls.
	const rows = Math.min(8, Math.max(3, value.split("\n").length));

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
					<label className="astra-strix-prompt-row">
						<span className="astra-strix-prompt-caret" aria-hidden="true">
							&gt;
						</span>
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

				{/* 模型行：只此一处。有模型说清名字与归属，没有则警告（Enter 会变成无操作）。 */}
				<p className="astra-strix-meta" data-missing={model ? "no" : "yes"}>
					{model ? (
						<>
							<span className="astra-strix-meta-dot" aria-hidden="true">
								●
							</span>
							<span className="astra-strix-meta-label">{t("scan.model")}</span>
							<span className="astra-strix-meta-name">{model.name}</span>
							{model.provider ? <span className="astra-strix-dim"> · {model.provider}</span> : null}
							<span className="astra-strix-dim"> · {t("launch.modelScope")}</span>
						</>
					) : (
						<>
							<span aria-hidden="true">○</span> {t("launch.noModel")}
							<span className="astra-strix-dim"> · {t("launch.noModelHint")}</span>
						</>
					)}
				</p>

				{log.length ? (
					<div className="astra-strix-launch-log" role="status">
						{log.slice(-MAX_LOG_ROWS).map((line, index) => (
							<p key={`${index}-${line.text}`} className={line.tone ? `astra-strix-${line.tone}` : "astra-strix-dim"}>
								{line.text}
							</p>
						))}
					</div>
				) : null}

				{/* 执行环境（ADR 0013）：三态检测。
				    host       → 不检测 docker，直接说"本机执行，无容器隔离"
				    docker 缺失 → 把安装命令交给宿主执行（这是"具备性"问题）
				    镜像缺失    → 提示并给一个「拉取镜像」按钮（这是"就绪性"问题）
				    全部就绪    → 说清"已就绪"与镜像状态，不再给多余按钮 */}
				<div className="astra-strix-env" data-state={envState}>
					<span className="astra-strix-env-label">{t("env.choice")}</span>
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
					<span className="astra-strix-env-status">
						{envState === "host" ? t("env.statusHost") : null}
						{envState === "noDocker" ? t("env.statusNoDocker") : null}
						{envState === "noImage" ? t("env.statusNoImage") : null}
						{envState === "ready" ? t("env.statusReady") : null}
					</span>
				</div>
				<div className="astra-strix-hints">
					<span className="astra-strix-hints-left">
						<span className="astra-strix-hint">
							<span className="astra-strix-key">enter</span>
							<span className="astra-strix-dim">{t("launch.hint.enter")}</span>
						</span>
						<span className="astra-strix-hints-gap" />
						<span className="astra-strix-hint">
							<span className="astra-strix-key">ctrl+c</span>
							<span className="astra-strix-dim">{t("launch.hint.quit")}</span>
						</span>
					</span>
					<span className="astra-strix-dim">v{version}</span>
				</div>

				{boot.state === "connecting" ? (
					<p className="astra-strix-boot" role="status">
						<span className="astra-strix-spinner" aria-hidden="true" />
						<span>{t("boot.connecting")}</span>
					</p>
				) : boot.state === "failed" ? (
					<p className="astra-strix-boot" data-state="failed" role="status">
						<span className="astra-strix-amber" aria-hidden="true">!</span>
						<span>{t("boot.failed")}</span>
						{boot.detail ? <span className="astra-strix-dim"> — {boot.detail}</span> : null}
					</p>
				) : (
					<p className="astra-strix-boot" data-state="ready" role="status">
						<span className="astra-strix-green" aria-hidden="true">●</span>
						<span>{t("boot.ready")}</span>
					</p>
				)}

				{blocked ? <p className="astra-strix-launch-blocked">{blocked}</p> : null}
			</div>
		</div>
	);
}

