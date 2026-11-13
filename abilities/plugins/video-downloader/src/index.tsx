import { definePlugin } from "@astravia-org/plugin-sdk";
import { createElement } from "react";
import { ABILITY_ID, ACTIVITY_TAB_ID, DETAIL_SLOT_ID, INPUT_ACTION_ID } from "./plugin-ids";
import { ensureServiceStarted } from "./runtime";
import type { ManagedPluginContext } from "./runtime-contract";
import { ServiceStatusSlot } from "./features/connection/components/service-status-slot";
import { DownloaderView } from "./features/downloader/components/downloader-view";
import { registerVideoResolveTool } from "./agent/video-resolve-tool";
import "./style.css";

// 不再需要单色图标常量：活动标签与输入动作都继承 plugin.json#icon 的全彩 SVG，
// 传 iconify 类只会把品牌图标盖掉（宿主只在你没给 icon 时才回落）。

export default definePlugin({
  async activate(ctx) {
    const context = ctx as ManagedPluginContext;
    const panel = () => createElement(DownloaderView, { ctx: context });

    const detail = context.ui.registerAbilityDetailSlot({
      id: DETAIL_SLOT_ID,
      abilityId: ABILITY_ID,
      component: () => createElement(ServiceStatusSlot, { ctx: context }),
    });

		// 侧边栏页面已彻底移除：队列只在活动标签里出现，一个入口一个形态。
		// 标签与输入动作都不传 `icon`，让宿主继承 plugin.json#icon（现在已是全彩 SVG）。

    // Activity panel: the same queue next to the conversation, addable from the "+" picker.
    const tab = context.ui.registerActivityTab({
      id: ACTIVITY_TAB_ID,
      label: "%downloader.title%",
      // Inherit `plugin.json#icon` like the input action above: the tab picker wants the
      // coloured brand mark, and an explicit lucide glyph replaced it with a mono default.
      component: panel,
      scope_use: ["conversation", "project"],
      // On the tab bar from the start, so the panel is discoverable without setup.
      initiallyVisible: true,
      retention: "warm",
    });

    // Composer chip: one click opens the panel for the current conversation.
    // registerInputAction throws when the permission is missing, so it is guarded separately.
    const action = context.permissions.has("ui.slot.input-action")
      ? context.ui.registerInputAction({
          id: INPUT_ACTION_ID,
          label: "%action.download%",
          // No explicit icon: the host inherits `plugin.json#icon` (the coloured brand
          // mark). A lucide glyph here overrode it, so the row entry and its capsule
          // showed a mono default instead of the official icon.
          scope_use: ["conversation", "project"],
          onToggle(active) {
            if (active) {
              context.ui.setActivityTabVisible(ACTIVITY_TAB_ID, true);
              context.ui.openActivityTab(ACTIVITY_TAB_ID);
            } else {
              context.ui.setActivityTabVisible(ACTIVITY_TAB_ID, false);
            }
          },
        })
      : null;

    // Reverse direction: the agent resolves a link (and can queue it) without the panel driving.
    const resolveTool = registerVideoResolveTool(context);

    // The host snapshots Agent MCP tools right after activation, so wait for the service
    // instead of returning early and racing that snapshot.
    try {
      await ensureServiceStarted(context);
    } catch (reason: unknown) {
      context.ui.notify({ message: context.i18n.t("error.serviceStart"), error: reason, variant: "error" });
    }

    return () => {
      action?.dispose();
      resolveTool?.dispose();
      tab.dispose();
      detail.dispose();
    };
  },
});
