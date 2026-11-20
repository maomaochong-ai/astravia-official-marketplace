import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { ReactElement } from "react";
import type { WorkbenchBridge } from "../bridge";
import { useWorkbench } from "../hooks/use-workbench";
import { getActivePrompt } from "../../../domain/prompt-library";
import { deriveLiveStatus } from "../live-status";
import { buildTimeline } from "../timeline";
import { SIDEBAR_MAX, SIDEBAR_MIN, SplitHandle, useSidebarWidth } from "../hooks/use-sidebar-width";
import { useSidebarCollapsed } from "../hooks/use-sidebar-collapsed";
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
import { InjectPage } from "./pages/inject";
import { HandoffDialog } from "./workbench/handoff-dialog";
import { SendPromptDialog } from "./workbench/send-prompt-dialog";

/**
 * 页面必须静态导入，不能用 React.lazy（ADR 0009 D2 已回滚，见 2.17.2）。
 *
 * 插件是 Module Federation 远程，expose 只有入口一个模块；entry 之外的 chunk 靠
 * Vite 的 dynamic import 加载，而 plugin-vite 没有配 modulePreload，分块 URL 会在
 * 宿主页面下解析 —— 结果是面板拉不到页面、点了「工作台」什么都不出现。
 * 要减启动体积就减数据（语料、索引），不切代码。
 */
type PageComponent = (props: PageProps) => ReactElement;

const PAGES: Record<string, PageComponent> = {
	overview: OverviewPage,
	activity: ActivityPage,
	guide: GuidePage,
	samples: SamplesPage,
	findings: FindingsPage,
	strings: StringsPage,
	prompts: PromptsPage,
	inject: InjectPage,
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
		latest: model.activity.entries[0],
	});

	// 会话信息链：事件流在组件外压成「一轮几次、各用多久、谁报错」，侧栏与活动页共用。
	const timeline = buildTimeline(model.stream.entries);

	// 侧栏宽度由用户拖出来（默认 240，范围 200–360），收起是另一件事。
	// 不按面板宽度自动收起：面板常驻 400–500px，自动收会把中文标签全藏起来，
	// 用户看到的是「侧栏被遮住、没有文字」。
	const [sidebarWidth, setSidebarWidth, resetSidebarWidth] = useSidebarWidth();
	const [collapsed, setCollapsed] = useSidebarCollapsed();
	const rail = collapsed;

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
				<Sidebar
					page={model.page}
					onNavigate={model.go}
					lab={model.lab.state}
					status={live}
					timeline={timeline}
					rail={rail}
					collapsed={collapsed}
					onToggle={() => setCollapsed(!collapsed)}
					width={sidebarWidth}
				/>
				{/* 面板里的分区由用户决定谁占多宽：收起时没有可拖的对象。 */}
				{rail ? null : (
					<SplitHandle
						side="left"
						value={sidebarWidth}
						min={SIDEBAR_MIN}
						max={SIDEBAR_MAX}
						onChange={setSidebarWidth}
						onReset={resetSidebarWidth}
						label={t("sidebar.resize")}
					/>
				)}
				<main className="fb-main fb-scroll">
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
