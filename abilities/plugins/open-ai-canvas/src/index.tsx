import "./style.css";
import { definePlugin } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { CanvasController } from "./runtime";
import { VIEW_ID } from "./runtime-contract";
import { CanvasView } from "./features/canvas-workspace/components/canvas-view";

let activeController: CanvasController | null = null;

export default definePlugin({
  activate(ctx) {
    void activeController?.dispose();
    const controller = new CanvasController(ctx);
    activeController = controller;

    ctx.ui.registerWorkspaceView({
      id: VIEW_ID,
      label: "Open AI Canvas",
      icon: "icon-[solar--palette-2-linear]",
      description: "Open-source AI canvas integrated into Astravia",
      badge: { kind: "beta" },
      component: function CanvasWorkspaceView(): JSX.Element {
        return <CanvasView controller={controller} />;
      },
    });

    void controller.ensureLoaded();

    return () => {
      void controller.dispose();
      if (activeController === controller) activeController = null;
    };
  },
  deactivate() {},
});
