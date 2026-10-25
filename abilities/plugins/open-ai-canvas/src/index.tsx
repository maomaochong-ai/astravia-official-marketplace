import "./style.css";
import { definePlugin } from "@astravia-org/plugin-sdk";
import type { Disposable } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { CanvasController } from "./runtime";
import { VIEW_ID } from "./runtime-contract";
import { CanvasView } from "./features/canvas-workspace/components/canvas-view";

let activeController: CanvasController | null = null;
let activeView: Disposable | null = null;

export default definePlugin({
  activate(ctx) {
    // 重复激活时先撤掉上一个实例：视图注册不释放会叠出同名入口，
    // 每个入口都持有自己的 controller，宿主一有状态事件就整套重渲染。
    activeView?.dispose();
    activeView = null;
    void activeController?.dispose();
    activeController = null;

    const controller = new CanvasController(ctx);
    activeController = controller;
    // 模型桥的执行侧必须早于视图存在：用户只要装了插件并启动过服务，画布的请求
    // 就该有人接。它自己会一直重试，shim 没起也不算错。
    controller.startBridge();

    activeView = ctx.ui.registerWorkspaceView({
      id: VIEW_ID,
      label: "Open AI Canvas",
      icon: "icon-[solar--palette-2-linear]",
      description: "Open-source AI canvas integrated into Astravia",
      badge: { kind: "beta" },
      component: function CanvasWorkspaceView(): JSX.Element {
        return <CanvasView controller={controller} />;
      },
    });

    // 放到下一个宏任务：激活本身处在一轮渲染里，同步触发的状态广播会让宿主
    // 在同一轮里再次进入渲染（React #185 的直接来源）。
    const timer = setTimeout(() => {
      void controller.ensureLoaded();
    }, 0);

    return () => {
      clearTimeout(timer);
      activeView?.dispose();
      activeView = null;
      void controller.dispose();
      if (activeController === controller) activeController = null;
    };
  },
  deactivate() {},
});
