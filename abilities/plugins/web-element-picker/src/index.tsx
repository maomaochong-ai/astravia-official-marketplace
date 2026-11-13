import { definePlugin } from "@astravia-org/plugin-sdk";
import { WebElementPickerPanel } from "./WebElementPickerPanel";
import { pickerBrandIcon } from "./brand-icon";
import { pushPickerIntent, setRuntime } from "./runtime-contract";
import "./style.css";

/**
 * Web Element Picker.
 *
 * 图标：三处表面（tab 菜单 / 行内条目 / 胶囊）共用同一枚彩色品牌图标，
 * 由 `pickerBrandIcon()` 显式构造后传入。不再依赖「省略 icon 就继承」：
 * 继承链上的 `ctx.plugin.iconUrl` 缺失时，三处会各自退化成主题默认单色图标。
 * 此前两处内联的是 `stroke="currentColor"` 白色 SVG，在浅色胶囊上等于看不见。
 *
 * 注意：MF 插件共享依赖异步填充，模块顶层不能求值 JSX；去掉内联图标后这个约束
 * 也随之消失（没有 JSX 需要惰性构造）。
 */
export default definePlugin({
	activate(ctx) {
		setRuntime(ctx);
		const brandIcon = pickerBrandIcon(ctx.plugin.iconUrl);
		ctx.ui.registerActivityTab({
			id: "web-element-picker",
			label: "%tab.label%",
			icon: brandIcon,
			component: WebElementPickerPanel,
			scope_use: ["conversation", "project", "cli"],
			initiallyVisible: true,
		});
		ctx.ui.registerInputAction({
			id: "element-picker",
			label: "%action.elementPicker.label%",
			icon: brandIcon,
			scope_use: ["conversation", "project", "cli"],
			onToggle: (active) => {
				if (active) {
					pushPickerIntent("start-select");
					ctx.ui.setActivityTabVisible("web-element-picker", true);
					ctx.ui.openActivityTab("web-element-picker", { width: "max" });
				} else {
					pushPickerIntent("stop-select");
				}
			},
			decoratePrompt: () => ({
				instructions: [
					"The user is working with the Web Element Picker. Element context selected on a web page may have been sent to this conversation; use it to make the requested code changes.",
				],
			}),
		});
	},
});
