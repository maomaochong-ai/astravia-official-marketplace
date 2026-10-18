import { definePlugin } from "@astravia-org/plugin-sdk";
import { createElement } from "react";
import { ABILITY_ID, DETAIL_SLOT_ID, WORKSPACE_VIEW_ID } from "./plugin-ids";
import { ensureServiceStarted } from "./runtime";
import type { ManagedPluginContext } from "./runtime-contract";
import { ServiceStatusSlot } from "./features/connection/components/service-status-slot";
import { DownloaderView } from "./features/downloader/components/downloader-view";
import "./style.css";

export default definePlugin({
  async activate(ctx) {
    const context = ctx as ManagedPluginContext;

    const detail = context.ui.registerAbilityDetailSlot({
      id: DETAIL_SLOT_ID,
      abilityId: ABILITY_ID,
      component: () => createElement(ServiceStatusSlot, { ctx: context }),
    });

    const view = context.ui.registerWorkspaceView({
      id: WORKSPACE_VIEW_ID,
      label: "%downloader.title%",
      description: "%downloader.subtitle%",
      icon: "icon-[solar--download-minimalistic-linear]",
      component: () => createElement(DownloaderView, { ctx: context }),
    });

    // The host snapshots Agent MCP tools right after activation, so wait for the service
    // instead of returning early and racing that snapshot.
    try {
      await ensureServiceStarted(context);
    } catch (reason: unknown) {
      context.ui.notify({ message: context.i18n.t("error.serviceStart"), error: reason, variant: "error" });
    }

    return () => {
      view.dispose();
      detail.dispose();
    };
  },
});
