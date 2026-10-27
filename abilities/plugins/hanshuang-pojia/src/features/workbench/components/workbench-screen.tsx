import type { ReactElement } from "react";
import type { WorkbenchBridge } from "../bridge";
import { useWorkbench } from "../hooks/use-workbench";
import { getActivePrompt } from "../../../domain/prompt-library";
import { deriveLiveStatus } from "../live-status";
import { Sidebar } from "./shell/sidebar";
import { TopBar } from "./shell/top-bar";
import { InjectStatusBar } from "./shell/inject-status-bar";
import { ActivityPage } from "./pages/activity";
import { ComparePage } from "./pages/compare";
import { DisasmPage } from "./pages/disasm";
import { DocsPage } from "./pages/docs";
import { EntropyPage } from "./pages/entropy";
import { FindingsPage } from "./pages/findings";
import { GuidePage } from "./pages/guide";
import { ManifestPage } from "./pages/manifest";
import { OverviewPage, type PageProps } from "./pages/overview";
import { ReportsPage } from "./pages/reports";
import { CasesPage } from "./pages/cases";
import { SamplesPage } from "./pages/samples";
import { SelfCheckPage } from "./pages/selfcheck";
import { SettingsPage } from "./pages/settings";
import { SignaturePage } from "./pages/signature";
import { StringsPage } from "./pages/strings";
import { PromptsPage } from "./pages/prompts";
import { HandoffDialog } from "./workbench/handoff-dialog";

const PAGES: Record<string, (props: PageProps) => ReactElement> = {
	overview: OverviewPage,
	activity: ActivityPage,
	guide: GuidePage,
	samples: SamplesPage,
	findings: FindingsPage,
	strings: StringsPage,
	prompts: PromptsPage,
	disasm: DisasmPage,
	docs: DocsPage,
	cases: CasesPage,
	manifest: ManifestPage,
	entropy: EntropyPage,
	signature: SignaturePage,
	compare: ComparePage,
	selfcheck: SelfCheckPage,
	reports: ReportsPage,
	settings: SettingsPage,
};

export interface WorkbenchScreenProps {
	bridge: WorkbenchBridge;
	cwd: string | null;
	/** 宿主的 tab 激活态：不在前台就不订阅宿主事件（默认按前台处理，方便直接渲染）。 */
	active?: boolean;
}

/** 插件面板的唯一装配点：顶栏 + 侧栏 + 当前页面。 */
export function WorkbenchScreen({ bridge, cwd, active = true }: WorkbenchScreenProps) {
	const model = useWorkbench(bridge, cwd, { active });
	const Page = PAGES[model.page] ?? OverviewPage;
	const props: PageProps = { model };
	// 侧栏实时区的状态点全部由已有模型推导，不额外订阅宿主事件。
	const live = deriveLiveStatus({
		chat: model.chat.state,
		stream: { entries: model.stream.entries, active: model.stream.active },
		report: model.report,
		activePrompt: getActivePrompt(model.promptLibrary),
	});

	return (
		<div className="fb-root @container flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface text-text">
			<TopBar
				page={model.page}
				chat={model.chat.state}
				sending={model.chat.sending}
				canSend={model.cwd !== null}
				onSend={() => model.ask("continue")}
				lab={model.lab.state}
				onToggleLab={() => model.lab.set(!model.lab.state.enabled)}
			/>
			<InjectStatusBar lab={model.lab.state} library={model.promptLibrary} />
			<div className="flex min-h-0 flex-1">
				<Sidebar page={model.page} onNavigate={model.go} lab={model.lab.state} status={live} />
				<main className="fb-scroll min-w-0 flex-1 overflow-y-auto">
					<Page {...props} />
				</main>
			</div>
			<HandoffDialog
				open={model.handoff.open}
				target={model.handoff.target}
				busy={model.chat.sending}
				onClose={model.closeHandoff}
				onSend={model.sendHandoff}
			/>
		</div>
	);
}
