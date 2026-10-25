/**
 * 工具就绪分节：这台机器为当前目标缺什么、哪些能一键装。
 *
 * 判断来自三处证据（doctor / 直接探测 / 本会话真实调用），面板不猜。
 * 「安装」只在确有一条非交互安装通道时出现；其余给的是可复制的命令，
 * 因为面板没有权限替你输入 sudo 密码或点同意框。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCommandRunResult, PluginCommandSpawnHandle } from "@astravia-org/plugin-sdk";
import type { TargetKind } from "../data/targets";
import type { DoctorCheck } from "../live/doctor-readiness";
import type { ReaLiveCall } from "../live/session-store";
import type { DoctorReport } from "../hooks/use-doctor-report";
import type { ReaProviderBridge } from "./rea-workflow-tab";
import { Panel, PanelHeader } from "../../../shared/components/panel";
import { ReaPage, ReaPageHeader } from "./rea-app-shell";
import { ReaToolReadiness } from "./rea-tool-readiness";
import { ReaDoctorChecks } from "./rea-doctor-checks";

interface ToolchainPageProps {
	readonly active: boolean;
	readonly target: TargetKind | null;
	readonly calls: readonly ReaLiveCall[];
	readonly running: readonly string[];
	readonly report: DoctorReport;
	readonly run: ReaProviderBridge["run"];
	readonly runCommand: ((file: string, args: readonly string[]) => Promise<PluginCommandRunResult>) | null;
	readonly spawnRea: ReaProviderBridge["spawn"];
	readonly spawnCommand: ((file: string, args: readonly string[]) => Promise<PluginCommandSpawnHandle>) | null;
	readonly cwd: string | null;
	readonly checks: readonly DoctorCheck[];
}

export function ToolchainPage({
	active,
	target,
	calls,
	running,
	report,
	run,
	runCommand,
	spawnRea,
	spawnCommand,
	cwd,
	checks,
}: ToolchainPageProps): JSX.Element {
	const { t } = useTranslation();

	return (
		<ReaPage active={active}>
			<ReaPageHeader title={t("ui.page.toolchain.title")} subtitle={t("ui.page.toolchain.subtitle")} />

			<Panel>
				<PanelHeader title={t("tab.tools.title")} hint={t("tab.tools.sourceHint")} />
				<div className="px-4 py-3">
					<ReaToolReadiness
						target={target}
						calls={calls}
						running={running}
						report={report}
						run={run}
						runCommand={runCommand}
						spawnRea={spawnRea}
						spawnCommand={spawnCommand}
						cwd={cwd}
					/>
				</div>
			</Panel>

			<ReaDoctorChecks
				checks={checks}
				status={report.status}
				message={report.message}
				lastRunAt={report.lastRunAt}
				onRecheck={report.recheck}
				rechecking={report.status === "checking"}
			/>
		</ReaPage>
	);
}
