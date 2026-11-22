import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { WorkbenchBridge } from "../bridge";
import { useWorkbench } from "../hooks/use-workbench";
import { PageBoundary } from "./shell/page-boundary";
import { getActivePrompt } from "../../../domain/prompt-library";
import { SHIPPED_PRECEDENTS } from "../../../domain/case/precedents";
import { deriveLiveStatus } from "../live-status";
import { SIDEBAR_MAX, SIDEBAR_MIN, SplitHandle, useSidebarWidth } from "../hooks/use-sidebar-width";
import { useSidebarCollapsed } from "../hooks/use-sidebar-collapsed";
import { Sidebar } from "./shell/sidebar";
import { TopBar } from "./shell/top-bar";
import { InjectStatusBar } from "./shell/inject-status-bar";
import { ActivityPage } from "./pages/activity";
import { ComparePage } from "./pages/compare";
import { DisasmPage } from "./pages/disasm";
import { KnowledgePage } from "./pages/knowledge";
import { FindingsPage } from "./pages/findings";
import { GuidePage } from "./pages/guide";
import { OverviewPage, type PageProps } from "./pages/overview";
import { ReportsPage } from "./pages/reports";

import { SamplesPage } from "./pages/samples";
import { SelfCheckPage } from "./pages/selfcheck";
import { SettingsPage } from "./pages/settings";
import { StringsPage } from "./pages/strings";
import { PromptsPage } from "./pages/prompts";
import { InjectPage } from "./pages/inject";
import { HandoffDialog } from "./workbench/handoff-dialog";
import { SendPromptDialog } from "./workbench/send-prompt-dialog";
import { StaticPage } from "./pages/static";
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
	knowledge: KnowledgePage,
	static: StaticPage,
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
	// 派生数据按输入身份缓存：
	// 面板每次状态变化（页面切换、筛选、拖宽）都会重渲染这层，而实测 buildTimeline 每次 0.08ms、
	// deriveLiveStatus 要分配 5 个行对象。量不大，但它们是「外壳」的输入 —— 不缓存就等于
	// 每帧把侧栏的 props 换成新对象，React.memo 一点用没有。
	const live = useMemo(
		() =>
			deriveLiveStatus({
				chat: model.chat.state,
				stream: { entries: model.stream.entries, active: model.stream.active },
				report: model.report,
				activePrompt: getActivePrompt(model.promptLibrary),
				latest: model.activity.entries[0],
			}),
		[model.chat.state, model.stream.entries, model.stream.active, model.report, model.promptLibrary, model.activity.entries],
	);

	// 会话信息链：在 model 里压过一次（一轮几次、各用多久、谁报错），三处共用同一个对象。
	const timeline = model.timeline;

	// 侧栏徽标：新鲜对象会让 Sidebar 的 memo 失效。
	const counts = useMemo(
		() => ({
			knowledge: model.docs.totals.documents + model.cases.cases.length + SHIPPED_PRECEDENTS.length,
			prompts: model.promptLibrary.items.length,
		}),
		[model.docs.totals.documents, model.cases.cases.length, model.promptLibrary.items.length],
	);

	// 侧栏宽度由用户拖出来（默认 240，范围 200–360），收起是另一件事。
	// 不按面板宽度自动收起：面板常驻 400–500px，自动收会把中文标签全藏起来，
	// 用户看到的是「侧栏被遮住、没有文字」。
	const [sidebarWidth, setSidebarWidth, resetSidebarWidth] = useSidebarWidth();
	const [collapsed, setCollapsed] = useSidebarCollapsed();
	const rail = collapsed;

	// 发送前确认：先算出「不编辑时会发什么」，再让用户在对话框里改。
	const [pending, setPending] = useState<string | null>(null);
	const { t } = useTranslation();

	// data-panel-root：浮层钳位用 —— 右键菜单要在面板内收边，不能拿 viewport 当边界。
	return (
		<div data-panel-root className="fb-root @container flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface text-text">
			<TopBar
				page={model.page}
				chat={model.chat.state}
				sending={model.chat.sending}
				canSend={model.cwd !== null}
				onSend={() => setPending(model.previewPrompt("continue"))}
			/>
			<InjectStatusBar library={model.promptLibrary} />
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
					// 徽标回答「这里有多少东西可读」：知识库与案例库是主入口，没有数字时看不出空不空。
					// 文档与案例同属一页：徽标给的是这两个来源的总量。
					counts={counts}
				/>
				{/* 面板里的分区由用户决定谁占多宽：收起时没有可拖的对象。 */}
				{rail ? null : (
					<SplitHandle
						// 侧栏在把手左侧：往右拖变宽。
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
					{/*
					 * 页面级边界，而不是只有顶层一个：某一页抛错时，侧栏/顶栏仍然可用，
					 * 而且能把「哪一页」报出来。只有一个顶层边界时，任何一页抛错都是整块
					 * 「面板渲染失败」，用户既回不去也没法告诉我们发生在哪。
					 * key 跟页面 id 绑定：切页会重建边界，一次错误不会把所有页都锁死。
					 */}
					<PageBoundary key={model.page} page={model.page}>
						<Page {...props} />
					</PageBoundary>
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