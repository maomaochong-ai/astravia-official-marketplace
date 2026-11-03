import "./style.css";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { APP } from "./app.config.ts";
import { registerCraftTools } from "./features/agent/craft-tools.ts";
import { warmHub } from "./runtime.ts";
import { CraftTab } from "./features/editor/components/craft-tab.tsx";

export const TAB_ID = APP.tabId;

/**
 * One activation owns the tab and tool registrations. The host activates the new
 * version before releasing the old one, so a module-scope handle would let the old
 * cleanup dispose the registrations the new activation just made.
 */
interface Activation {
  owned: Disposable[];
  released: boolean;
}

let current: Activation | null = null;

function release(activation: Activation): void {
  if (activation.released) return;
  activation.released = true;
  for (const disposable of activation.owned) disposable.dispose();
  if (current === activation) current = null;
}

export default definePlugin({
  activate(ctx: PluginContext) {
    if (current) release(current);

    const tab = ctx.ui.registerActivityTab({
      id: TAB_ID,
      label: APP.tabLabel,
      order: APP.tabOrder,
      // fail-closed in the host: an empty or missing list hides the tab everywhere.
      scope_use: ["conversation", "project"],
      retention: "pinned",
      component: function CraftActivityTab(): JSX.Element {
        return <CraftTab ctx={ctx} />;
      },
    });

    // Tools are what make the plugin usable from the conversation; they fail closed
    // too, and a host build without the two tool permissions registers nothing.
    const tools = registerCraftTools(ctx);

    // An already-installed hub may start now, so opening the tab later skips the
    // cold spawn. Fire-and-forget: activation never waits on a preview.
    void warmHub(ctx);

    const activation: Activation = { owned: [tab, ...tools], released: false };
    current = activation;
    return () => release(activation);
  },
  deactivate() {},
});
