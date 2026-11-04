import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { APP } from "../../../app.config.ts";
import { useEditorSession } from "../hooks/use-editor-session.ts";
import { EditorStatusBar } from "./editor-status-bar.tsx";

/**
 * The activity tab: upstream's own web build as an inline document in a frame, one
 * status line above it, no second editor and no second theme.
 *
 * ADR: docs/adr/excalidraw/0001-the-tab-runs-upstreams-web-build.md
 */
export function EditorTab({ ctx }: { ctx: PluginContext }): JSX.Element {
  const session = useEditorSession(ctx);
  const { strings, iframeDoc, iframeKey, frameRef, containerRef, overlay } = session;
  // The Fullscreen API can be refused by the host frame. Then the shell itself
  // covers the viewport — same element, same exit button, no lost status bar.
  const shell = overlay
    ? "fixed inset-0 z-[80] flex h-screen w-screen flex-col bg-neutral-950"
    : "flex h-full min-h-0 w-full flex-col bg-neutral-950";

  return (
    <div ref={containerRef} className={shell}>
      <EditorStatusBar session={session} />

      <div className="relative min-h-0 flex-1">
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
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            {strings.preparing}
          </div>
        )}
      </div>
    </div>
  );
}
