import { useTranslation } from "@astravia-org/plugin-sdk";
import { lazy, Suspense, useState } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { WorkbenchBridge } from "../bridge";
import { useWorkbench } from "../hooks/use-workbench";
import { getActivePrompt } from "../../../domain/prompt-library";
import { deriveLiveStatus } from "../live-status";
import { Sidebar } from "./shell/sidebar";
import { TopBar } from "./shell/top-bar";
import { InjectStatusBar } from "./shell/inject-status-bar";
import { OverviewPage, type PageProps } from "./pages/overview";
import { HandoffDialog } from "./workbench/handoff-dialog";
import { SendPromptDialog } from "./workbench/send-prompt-dialog";
// 页面按需加载：入口分块只留 shell 与首屏，其余 16 页第一次导航时才拉。
// overview 仍静态：它是默认页，且测试与首屏都直接断言它同步可见。
const ActivityPage = lazy(() => import("./pages/activity").then(module => ({ default: module.ActivityPage })));
const ComparePage = lazy(() => import("./pages/compare").then(module => ({ default: module.ComparePage })));
const DisasmPage = lazy(() => import("./pages/disasm").then(module => ({ default: module.DisasmPage })));
const DocsPage = lazy(() => import("./pages/docs").then(module => ({ default: module.DocsPage })));
const EntropyPage = lazy(() => import("./pages/entropy").then(module => ({ default: module.EntropyPage })));
const FindingsPage = lazy(() => import("./pages/findings").then(module => ({ default: module.FindingsPage })));
const GuidePage = lazy(() => import("./pages/guide").then(module => ({ default: module.GuidePage })));
const ManifestPage = lazy(() => import("./pages/manifest").then(module => ({ default: module.ManifestPage })));
const ReportsPage = lazy(() => import("./pages/reports").then(module => ({ default: module.ReportsPage })));
const CasesPage = lazy(() => import("./pages/cases").then(module => ({ default: module.CasesPage })));
const SamplesPage = lazy(() => import("./pages/samples").then(module => ({ default: module.SamplesPage })));
const SelfCheckPage = lazy(() => import("./pages/selfcheck").then(module => ({ default: module.SelfCheckPage })));
const SettingsPage = lazy(() => import("./pages/settings").then(module => ({ default: module.SettingsPage })));
const SignaturePage = lazy(() => import("./pages/signature").then(module => ({ default: module.SignaturePage })));
const StringsPage = lazy(() => import("./pages/strings").then(module => ({ default: module.StringsPage })));
const PromptsPage = lazy(() => import("./pages/prompts").then(module => ({ default: module.PromptsPage })));

type PageComponent = ComponentType<PageProps> | LazyExoticComponent<ComponentType<PageProps>>;

const PAGES: Record<string, PageComponent> = {
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

	// 发送前确认：先算出「不编辑时会发什么」，再让用户在对话框里改。
	const [pending, setPending] = useState<string | null>(null);
	const { t } = useTranslation();

	return (
		<div className="fb-root @container flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface text-text">
			<TopBar
				page={model.page}
				chat={model.chat.state}
				sending={model.chat.sending}
				canSend={model.cwd !== null}
				onSend={() => setPending(model.previewPrompt("continue"))}
				lab={model.lab.state}
				onToggleLab={() => model.lab.set(!model.lab.state.enabled)}
			/>
			<InjectStatusBar lab={model.lab.state} library={model.promptLibrary} />
			<div className="flex min-h-0 flex-1">
				<Sidebar page={model.page} onNavigate={model.go} lab={model.lab.state} status={live} />
				<main className="fb-page-fill fb-scroll flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
					<Suspense fallback={<p className="text-[11.5px] text-text-4">{t("panel.rail.loading")}</p>}>
						<Page {...props} />
					</Suspense>
				</main>
			</div>
			<HandoffDialog
				open={model.handoff.open}
				target={model.handoff.target}
				busy={model.chat.sending}
				onClose={model.closeHandoff}
				onSend={model.sendHandoff}
			/>
			{/* 发送前编辑：初值与不编辑时完全一致（同一个 buildPrompt）。 */}
			<SendPromptDialog
				open={pending !== null}
				initial={pending ?? ""}
				label={t("chat.preview.label.continue")}
				onClose={() => setPending(null)}
				onSend={text => model.askText(text)}
				onSaveDraft={text => model.recordDraft(text, ["draft"])}
			/>
		</div>
	);
}
