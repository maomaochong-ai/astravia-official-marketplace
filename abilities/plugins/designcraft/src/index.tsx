import "./style.css";
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { definePlugin } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { APP } from "./app.config.ts";
import { ActTimeline } from "./features/agent/components/act-timeline.tsx";
import { connectConversation } from "./features/agent/conversation-bridge.ts";
import { registerCraftTools } from "./tools/index.ts";
import { CraftTab } from "./features/editor/components/craft-tab.tsx";
import { craftStateInstruction, readCraftState, setCraftEngaged } from "./features/editor/engagement.ts";

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
        return <CraftTab ctx={ctx} />;
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