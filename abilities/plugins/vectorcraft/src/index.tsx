import "./style.css";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import { Suspense, lazy } from "react";
import type { JSX } from "react";
import { APP } from "./app.config.ts";
import { ActTimeline } from "./features/agent/components/act-timeline.tsx";
import { connectConversation } from "./features/agent/conversation-bridge.ts";
import { registerCraftTools } from "./tools/index.ts";
import { craftStateInstruction, readCraftState, setCraftEngaged } from "./features/editor/engagement.ts";

/**
 * 编辑器整棵子树（hook + services + 47 KB 的 bridge 源码）只在真正打开 tab 时才需要。
 *
 * 宿主启动时会激活**全部已装插件**，而十五个 craft 插件共用同一份外壳：静态 import
 * 下来就是十五份 ~112 KB 的主 chunk 在主线程上一起解析与求值（其中 ~60% 是没人打开过
 * 的编辑器）。改成动态 import 后，激活只付入口 + 工具那一半；编辑器在第一次挂载时
 * 才下载并编译，而且仍然只下载**那一个**插件的。
 *
 * 加载失败时给一块可读的提示而不是抛给宿主：多了一次网络/协议边界，而 tab 里
 * 没有任何东西值得因此白屏（用户至少要知道“重开一次”）。
 */
const CraftTab = lazy(() =>
  import("./features/editor/components/craft-tab.tsx")
    .then((module) => ({ default: module.CraftTab }))
    .catch(() => ({ default: EditorUnavailable })),
);

function EditorUnavailable(): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-950 px-6 text-center text-xs text-neutral-400">
      {APP.name}
    </div>
  );
}

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
      // Not on the bar in a conversation where nobody has asked for this editor yet. A
      // tab that shows up in every conversation by default puts fifteen editors in the
      // strip, and each one that gets shown compiles a 13–32 MB wasm build. It stays in
      // the panel's own "+" list, `openActivityTab` attaches it when a tool needs it, and
      // once the user adds it the host records that per workspace — so it comes back in
      // the conversations that used it and nowhere else.
      initiallyVisible: false,
      // `warm`, not `pinned`: the host keeps the active tab plus a couple of recently
      // visited ones and drops the rest. Pinned meant every editor a user had ever opened
      // stayed in memory for the life of the window, still holding its wasm instance —
      // which is what made the fourth or fifth canvas fail to allocate one.
      retention: "warm",
      component: function CraftActivityTab(): JSX.Element {
        // 编辑器还没到：先铺一块与它同色的底，避免加载时闪过一帧白。
        return (
          <Suspense fallback={<div className="h-full w-full bg-neutral-950" />}>
            <CraftTab ctx={ctx} />
          </Suspense>
        );
      },
    });

    // The composer entry. Same shape as the whiteboard plugin's: a toggle inside the
    // input bar, off by default, reachable from the "/" panel and from the composer's
    // first button. Registering it is what gives a user a way *in* before any document
    // is open — without it the only thing they ever saw was a chip under the composer
    // that never went away, because it was driven by "this tab is selected" instead.
    //
    // The toggle is also what decides whether the editor's state rides along with the
    // next prompt (see engagement.ts); turning it off only drops that context, it does
    // not close the tab — the frame is holding work nobody asked to discard.
    //
    // `ui.slot.input-action` throws when the manifest did not ask for it, so a host
    // build without that permission gets no toggle instead of a failed activation.
    const action = ctx.permissions.has("ui.slot.input-action")
      ? ctx.ui.registerInputAction({
          id: `${APP.id}:editor`,
          label: APP.name,
          defaultActive: false,
          scope_use: ["conversation", "project"],
          onToggle: (active) => {
            setCraftEngaged(active);
            if (active) ctx.ui.openActivityTab(TAB_ID);
          },
          // Where the editor state reaches the model. Nothing is rendered at rest:
          // `decoratePrompt` only runs on a send, and only while the toggle is on.
          decoratePrompt: () => {
            const state = readCraftState();
            return state ? { instructions: [craftStateInstruction(APP.name, state)] } : {};
          },
        })
      : null;

    // Tools are what make the plugin usable from the conversation; they fail closed
    // too, and a host build without the two tool permissions registers nothing.
    const tools = registerCraftTools(ctx);

    // A batch is the one tool whose result is a list of things that happened, and the
    // host would print it as JSON. This renders the same result as a timeline in the
    // transcript — the label of each step, what it did, and how far the canvas moved.
    const timeline = ctx.ui.registerToolCallSlot({
      id: `${APP.id}:act-timeline`,
      toolName: `${APP.id}_act`,
      component: ActTimeline,
    });

    // The panel learns what the model is about to do (and where the project is)
    // before any tool result exists; see conversation-bridge.ts.
    const conversation = connectConversation(ctx);

    const activation: Activation = {
      owned: [...(action ? [action] : []), tab, ...tools, timeline, conversation],
      released: false,
    };
    return () => {
      // A reloaded or disabled plugin must not leave the toggle on for a tab that no
      // longer exists; the host keeps the active ids per session, so reset the state
      // the next activation reads.
      setCraftEngaged(false);
      release(activation);
    };
  },
  deactivate() {},
});