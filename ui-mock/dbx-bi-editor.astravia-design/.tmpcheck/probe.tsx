// SSR probe: render every frame through react-dom/server.
// Catches import-time and render-time throws that the Vite/console route hides.
import { renderToString } from "react-dom/server";
import { createElement } from "react";

import Btn from "../components/Btn";
import Chip from "../components/Chip";
import { AreaChart, Sparkline, Bars, HBars, Donut, Funnel, Gauge } from "../components/Charts";

import Agent from "../frames/agent";
import AiNode from "../frames/ai-node";
import BackButton from "../frames/back-button";
import Bigscreen from "../frames/bigscreen";
import Dashboard from "../frames/dashboard";
import Data from "../frames/data";
import Editor from "../frames/editor";
import Menu from "../frames/menu";
import Nodes from "../frames/nodes";
import Run from "../frames/run";
import Share from "../frames/share";
import Workbench from "../frames/workbench";

const frames: [string, any][] = [
	["agent", Agent],
	["ai-node", AiNode],
	["back-button", BackButton],
	["bigscreen", Bigscreen],
	["dashboard", Dashboard],
	["data", Data],
	["editor", Editor],
	["menu", Menu],
	["nodes", Nodes],
	["run", Run],
	["share", Share],
	["workbench", Workbench],
];

let bad = 0;

function probe(label: string, el: any) {
	try {
		const html = renderToString(el);
		console.log(`PASS  ${label.padEnd(30)} ${html.length} bytes`);
	} catch (err) {
		bad++;
		console.log(`FAIL  ${label}`);
		console.log(`      ${(err as Error).message.split("\n").slice(0, 8).join("\n      ")}`);
	}
}

console.log("=== shared components ===");
probe("<Btn>", createElement(Btn, { children: "x" }));
probe("<Chip>", createElement(Chip, { children: "x" }));
probe("<AreaChart>", createElement(AreaChart, { values: [1, 2, 3] }));
probe("<Sparkline>", createElement(Sparkline, { values: [1, 2, 3] }));
probe("<Bars>", createElement(Bars, { values: [1, 2, 3] }));
probe("<HBars>", createElement(HBars, { rows: [{ label: "a", value: 1, text: "1" }] }));
probe("<Donut>", createElement(Donut, { segments: [{ value: 1, color: "red" }] }));
probe("<Funnel>", createElement(Funnel, { stages: [{ label: "a", value: 1, text: "1" }] }));
probe("<Gauge>", createElement(Gauge, { value: 1 }));

console.log("\n=== frames ===");
for (const [id, Comp] of frames) {
	if (typeof Comp !== "function") {
		console.log(`SKIP  ${id} (no default export)`);
		bad++;
		continue;
	}
	probe(`frames/${id}.tsx`, createElement(Comp));
}

console.log(`\nfailed: ${bad} / ${frames.length + 9}`);
process.exit(bad === 0 ? 0 : 1);
