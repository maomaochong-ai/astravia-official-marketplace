import "./style.css";
import { definePlugin } from "@astravia-org/plugin-sdk";
import type { Disposable } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { CanvasController } from "./runtime";
import { VIEW_ID } from "./runtime-contract";
import { CanvasView } from "./features/canvas-workspace/components/canvas-view";

/**
 * 一次激活独占的资源。宿主升级插件时会先激活新版本、再拆旧版本，两段生命周期
 * 因此交叠（ADR-0014）：句柄若放在模块作用域，旧激活的 cleanup 会释放掉新激活
 * 刚注册的视图，侧栏入口就此消失，直到重启 App 或重载插件。
 */
interface Activation {
  controller: CanvasController;
  view: Disposable;
  timer: ReturnType<typeof setTimeout>;
  released: boolean;
}

let current: Activation | null = null;

/** 幂等释放：cleanup 可能被宿主调用两次，宿主视图的 dispose 不耐受重复释放。 */
function release(activation: Activation): void {
  if (activation.released) return;
  activation.released = true;
  clearTimeout(activation.timer);
  activation.view.dispose();
  void activation.controller.dispose();
  if (current === activation) current = null;
}

export default definePlugin({
  activate(ctx) {
    // 先撤上一份：同一 id 的视图短暂并存会让侧栏出现两个同名入口。
    if (current) release(current);

    const controller = new CanvasController(ctx);
    // 模型桥的执行侧必须早于视图存在：用户只要装了插件并启动过服务，画布的请求
    // 就该有人接。它自己会一直重试，shim 没起也不算错。
    controller.startBridge();

    const view = ctx.ui.registerWorkspaceView({
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

    // 整套资源建好后才入册：中途抛错不会留下半份注册。
    const activation: Activation = { controller, view, timer, released: false };
    current = activation;

    return () => release(activation);
  },
  deactivate() {},
});
