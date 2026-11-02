import "./style.css";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { PhotocraftTab } from "./features/editor/components/photocraft-tab.tsx";

export const TAB_ID = "photocraft";

/**
 * One activation owns the tab registration. The host activates the new version
 * before releasing the old one, so a module-scope handle would let the old
 * cleanup dispose the registration the new activation just made.
 */
interface Activation {
  tab: Disposable;
  released: boolean;
}

let current: Activation | null = null;

function release(activation: Activation): void {
  if (activation.released) return;
  activation.released = true;
  activation.tab.dispose();
  if (current === activation) current = null;
}

export default definePlugin({
  activate(ctx: PluginContext) {
    if (current) release(current);

    const tab = ctx.ui.registerActivityTab({
      id: TAB_ID,
      label: "Photocraft",
      order: 16,
      // fail-closed in the host: an empty or missing list hides the tab everywhere.
      scope_use: ["conversation", "project"],
      retention: "pinned",
      component: function PhotocraftActivityTab(): JSX.Element {
        return <PhotocraftTab ctx={ctx} />;
      },
    });

    const activation: Activation = { tab, released: false };
    current = activation;
    return () => release(activation);
  },
  deactivate() {},
});
