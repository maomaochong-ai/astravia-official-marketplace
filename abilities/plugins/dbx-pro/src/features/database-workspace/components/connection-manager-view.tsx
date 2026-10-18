/**
 * 连接管理工作区视图 — 从宿主侧边栏打开的整页面板。
 *
 * 首屏只有一层标题：工作台级 eyebrow + 标题 + 引擎状态由 ConnectionEditorFlow 的整页头部渲染，
 * 这里只管主题外壳与引擎探测，不再自己画一条「数据库工作台」标题栏（否则会出现两行相同图标）。
 *
 * 该视图挂在宿主侧边栏，运行在 WorkbenchProvider 之外，
 * 只能使用连接编辑 hook（自带存储读写），不能调用 useWorkbench。
 */

import { useEffect, useState, type JSX } from "react";
import { useDetectedTheme } from "../../../shared/hooks/use-detected-theme";
import { engineHealth } from "../../../shared/services/engine-client";
import { ConnectionEditorFlow } from "./connection-editor-flow";

type EngineState = "checking" | "running" | "unavailable";

export function ConnectionManagerView(): JSX.Element {
	const theme = useDetectedTheme();
	const [engineState, setEngineState] = useState<EngineState>("checking");
	const [engineVersion, setEngineVersion] = useState<string | null>(null);

	// 引擎健康状态实时探测，不硬编码「运行中」。
	useEffect(() => {
		let alive = true;
		setEngineState("checking");
		engineHealth()
			.then((health) => {
				if (!alive) return;
				setEngineState("running");
				setEngineVersion(health.version || null);
			})
			.catch(() => {
				if (alive) setEngineState("unavailable");
			});
		return () => {
			alive = false;
		};
	}, []);

	const statusLabel =
		engineState === "running" ? "引擎已连接" : engineState === "checking" ? "正在检测引擎" : "引擎不可用";
	const statusTone =
		engineState === "running" ? "bg-success" : engineState === "checking" ? "bg-warning" : "bg-danger";

	return (
		<div
			data-astravia-plugin-root="dbx-pro"
			data-dbx-theme={theme}
			className="dbx-root flex h-full min-h-0 flex-col bg-surface text-surface-foreground"
		>
			<ConnectionEditorFlow
				engine={{ label: statusLabel, version: engineVersion, tone: statusTone }}
			/>
		</div>
	);
}
