import { definePlugin } from "@astravia-org/plugin-sdk";
import { createElement } from "react";
import {
  ABILITY_ID,
  ACTIVITY_TAB_ID,
  DETAIL_SLOT_ID,
  INPUT_ACTION_ID,
  WORKSPACE_VIEW_ID,
} from "./plugin-ids";
import { ensureServiceStarted } from "./runtime";
import type { ManagedPluginContext } from "./runtime-contract";
import { ServiceStatusSlot } from "./features/connection/components/service-status-slot";
import { DownloaderView } from "./features/downloader/components/downloader-view";
import "./style.css";

const ICON_CLASS = "icon-[solar--download-minimalistic-linear]";

export default definePlugin({
  async activate(ctx) {
    const context = ctx as ManagedPluginContext;
    const page = () => createElement(DownloaderView, { ctx: context });
    const panel = () => createElement(DownloaderView, { ctx: context, variant: "panel" });

    const detail = context.ui.registerAbilityDetailSlot({
      id: DETAIL_SLOT_ID,
      abilityId: ABILITY_ID,
      component: () => createElement(ServiceStatusSlot, { ctx: context }),
    });

    // Sidebar surface: the download queue as a standalone page.
    const view = context.ui.registerWorkspaceView({
      id: WORKSPACE_VIEW_ID,
      label: "%downloader.title%",
      description: "%downloader.subtitle%",
      icon: ICON_CLASS,
      component: page,
    });

    // Activity panel: the same queue next to the conversation, addable from the "+" picker.
    const tab = context.ui.registerActivityTab({
      id: ACTIVITY_TAB_ID,
      label: "%downloader.title%",
      icon: createElement("span", { className: ICON_CLASS, "aria-hidden": "true" }),
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
          icon: createElement("span", { className: ICON_CLASS, "aria-hidden": "true" }),
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

    // The host snapshots Agent MCP tools right after activation, so wait for the service
    // instead of returning early and racing that snapshot.
    try {
      await ensureServiceStarted(context);
    } catch (reason: unknown) {
      context.ui.notify({ message: context.i18n.t("error.serviceStart"), error: reason, variant: "error" });
    }

    return () => {
      action?.dispose();
      tab.dispose();
      view.dispose();
      detail.dispose();
    };
  },
});
