import type { ReactElement } from "react";
import type { WorkbenchBridge } from "../bridge";
import { useWorkbench } from "../hooks/use-workbench";
import { Sidebar } from "./shell/sidebar";
import { TopBar } from "./shell/top-bar";
import { ComparePage } from "./pages/compare";
import { DisasmPage } from "./pages/disasm";
import { DocsPage } from "./pages/docs";
import { EntropyPage } from "./pages/entropy";
import { FindingsPage } from "./pages/findings";
import { GuidePage } from "./pages/guide";
import { ManifestPage } from "./pages/manifest";
import { OverviewPage, type PageProps } from "./pages/overview";
import { ReportsPage } from "./pages/reports";
import { SamplesPage } from "./pages/samples";
import { SelfCheckPage } from "./pages/selfcheck";
import { SettingsPage } from "./pages/settings";
import { SignaturePage } from "./pages/signature";
import { StringsPage } from "./pages/strings";

const PAGES: Record<string, (props: PageProps) => ReactElement> = {
	overview: OverviewPage,
	guide: GuidePage,
	samples: SamplesPage,
	findings: FindingsPage,
	strings: StringsPage,
	disasm: DisasmPage,
	docs: DocsPage,
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
}

/** 插件面板的唯一装配点：顶栏 + 侧栏 + 当前页面。 */
export function WorkbenchScreen({ bridge, cwd }: WorkbenchScreenProps) {
	const model = useWorkbench(bridge, cwd);
	const Page = PAGES[model.page] ?? OverviewPage;
	const props: PageProps = { model };

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
			<div className="flex min-h-0 flex-1">
				<Sidebar page={model.page} onNavigate={model.go} />
				<main className="fb-scroll min-w-0 flex-1 overflow-y-auto">
					<Page {...props} />
				</main>
			</div>
		</div>
	);
}
