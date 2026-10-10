/**
 * 连接管理工作区视图 — 从宿主侧边栏打开的整页面板。
 *
 * 对齐设计稿 frames/connections.tsx：面板 = Sheet 头部（h-12 抬升底）+ 步骤条（h-11）
 * + 搜索行与 58px 连接行 + h-14 页脚。三步流程（连接列表 → 数据库类型 → 连接配置）
 * 由 ConnectionEditorFlow 提供，工作台内的模态弹窗复用同一流程，两边功能一致。
 *
 * 该视图挂在宿主侧边栏，运行在 WorkbenchProvider 之外，
 * 只能使用连接编辑 hook（自带存储读写），不能调用 useWorkbench。
 */

import { useEffect, useState, type JSX } from "react";
import { engineHealth } from "../../../shared/services/engine-client";
import { PLUGIN_VERSION } from "../../../domain/plugin-version";
import { ConnectionEditorFlow } from "./connection-editor-flow";

type EngineState = "checking" | "running" | "unavailable";

export function ConnectionManagerView(): JSX.Element {
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
			className="dbx-root flex h-full min-h-0 flex-col bg-surface text-surface-foreground"
		>
			{/* 工作台状态位：与设计稿顶栏的引擎指示同一语义 */}
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
				<span className="icon-[lucide--database] size-3.5 shrink-0 text-muted" />
				<span className="text-[14px] font-semibold tracking-tight whitespace-nowrap text-surface-foreground">
					数据库工作台
				</span>
				<span className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap">
					<span className={`size-1.5 shrink-0 rounded-full ${statusTone}`} />
					<span className="text-[12px] text-muted">{statusLabel}</span>
					<span className="font-mono text-[12px] tabular-nums text-faint">
						v{PLUGIN_VERSION}
						{engineVersion ? ` · ${engineVersion}` : ""}
					</span>
				</span>
			</div>

			<ConnectionEditorFlow />
		</div>
	);
}
