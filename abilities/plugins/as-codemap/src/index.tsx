/**
 * as-codemap：代码图谱插件——右侧面板可视化 + agent 查询工具。
 *
 * 设计取舍（诚实声明，方案 §侦察结论）：
 * - AS 无现成符号图底座可对接，本插件自建零依赖词法提取层
 *   （parser/symbol-graph.ts）——不引入 web-tree-sitter（分发体积与
 *   wasm 资源成本高），精度对拓扑导航足够，重构级分析请用 IDE；
 * - workspace-view 插槽（跨项目，与 kanban 同款）展示 Code Map；图谱数据按
 *   workspace root 分片存 storage；
 * - activity-tab 插槽「代码审查」：复用图谱 + 模拟 review 数据，
 *   复刻 GitHub PR Review 视觉（三栏 + diff 行内高亮 + 严重度配色）；
 * - agent 工具 code_graph_query：模型查符号/引用不必再 grep 遍历。
 */
import { definePlugin } from "@astravia-org/plugin-sdk";
import "./style.css";
import { CodeMapPanel } from "./panel/CodeMapPanel";
import { ReviewTab } from "./panel/ReviewTab";
import { registerCodeMapBuildTool } from "./store/codemap-build-tool";
import { CodeMapStore } from "./store/codemap-store";
import { registerCodeMapTool } from "./store/codemap-tool";

let store: CodeMapStore | null = null;

export default definePlugin({
	activate(ctx) {
		store?.dispose();
		store = new CodeMapStore(ctx);

		const activeStore = store;
		if (!activeStore) throw new Error("CodeMapStore 未初始化");

		registerCodeMapTool(ctx, activeStore);
		registerCodeMapBuildTool(ctx, activeStore);

		ctx.ui.registerWorkspaceView({
			id: "as-codemap.map",
			label: ctx.i18n.t("view.map"),
			icon: "icon-[mdi--graph-outline]",
			component: () => <CodeMapPanel store={activeStore} />,
		});

		ctx.ui.registerActivityTab({
			id: "as-codemap.review",
			order: 35,
			label: ctx.i18n.t("view.review"),
			icon: <span className="icon-[mdi--shield-check-outline] h-4 w-4" />,
			component: () => <ReviewTab store={activeStore} />,
		});
	},
	deactivate() {
		store?.dispose();
		store = null;
	},
});
