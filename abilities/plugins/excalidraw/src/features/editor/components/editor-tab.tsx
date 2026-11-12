import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { APP } from "../../../app.config.ts";
import { useEditorSession } from "../hooks/use-editor-session.ts";
import { EditorStatusBar } from "./editor-status-bar.tsx";

/**
 * The activity tab: upstream's own web build as an inline document in a frame, one
 * status line above it, no second editor and no second theme.
 *
 */
export function EditorTab({ ctx }: { ctx: PluginContext }): JSX.Element {
  const session = useEditorSession(ctx);
  const { strings, iframeDoc, iframeKey, frameRef, containerRef, overlay, iconUrl } = session;
  // The Fullscreen API can be refused by the host frame. Then the shell itself
  // covers the viewport — same element, same exit button, no lost status bar.
  const shell = overlay
    ? "fixed inset-0 z-[80] flex h-screen w-screen flex-col bg-neutral-950"
    : "flex h-full min-h-0 w-full flex-col bg-neutral-950";

  return (
    <div ref={containerRef} className={shell}>
      <div className="relative min-h-0 flex-1">
        {/* The bar floats over the app instead of pushing it down; it is only there
            while the pointer is at the top edge or while it has something to say. */}
        <EditorStatusBar session={session} />
        {iframeDoc ? (
          <iframe
            key={iframeKey}
            ref={frameRef}
            srcDoc={iframeDoc}
            title={`${strings.tab} — ${APP.name}`}
            className="h-full w-full border-0 bg-neutral-900"
            sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-forms allow-modals"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        ) : (
          // One second of black before an app appears reads as a hang. The mark is
          // the package's own icon, so the waiting frame and the tab agree.
          <div className="flex h-full flex-col items-center justify-center gap-3 text-xs text-neutral-500">
            {iconUrl ? (
              <img src={iconUrl} alt="" aria-hidden="true" className="h-12 w-12 rounded-xl object-contain opacity-90" />
            ) : null}
            <span>{strings.preparing}</span>
          </div>
        )}
      </div>
    </div>
  );
}
