/**
 * link-tone.ts — 「连线/插槽该用什么颜色」的唯一推导（纯函数，无 React、无副作用）。
 *
 * 为什么单独成模块：插槽色与连线色必须同源。图表类节点的输出插槽走画布调色板的系列色
 * （`--color-series-1`，见 shared/components/charts.tsx 的颜色策略），连线若继续取节点模板色
 * （TONE.chart 绿色），同一个图表节点就会出现「蓝插槽 + 绿连线」。连线取色有 5 处
 * （插槽落下、画布点按落下、松手补线、AddNodeMenu 补线、待定虚线），另有输出插槽与卡片强调色 2 处，
 * 各写一份必然再次漂移，所以全部走这里。
 *
 * 返回值可能是 CSS 变量，调用方必须通过 style={{ stroke }} / style={{ fill }} 下传：
 * SVG presentation attribute 不接受 var()（见 charts.tsx 顶部说明）。
 */

import { SERIES } from "../../shared/components/charts";
import { TONE } from "../components/node-card";

/** 图表类节点的 kind 约定：NODE_TEMPLATES 里所有图表节点都以 `chart-` 开头。 */
export function isChartKind(kind: string | undefined): boolean {
	return typeof kind === "string" && kind.startsWith("chart-");
}

/**
 * 连线（与输出插槽）颜色。
 *
 * - 图表类节点：固定取调色板系列色 1，忽略节点模板色 —— 插槽、连线、卡片强调色三者一致；
 * - 其它节点：沿用节点自身的数据类型色（`source-*` 数据集蓝 / `screen-*` 图表绿 / 其余结果橙）。
 *
 * @param tone 节点自身/模板的 tone；缺失时回落 TONE.chart（保持改动前的默认值）
 * @param isChart 是否图表类节点，见 isChartKind
 */
export function wireTone(tone: string | undefined, isChart: boolean): string {
	return isChart ? SERIES[0] : tone ?? TONE.chart;
}
