import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { APP } from "../../../app.config.ts";
import { useCraftEditor } from "../hooks/use-craft-editor.ts";
import { ActivityStrip } from "./activity-strip.tsx";
import { BootCover } from "./boot-cover.tsx";
import { EditorDock } from "./editor-dock.tsx";

/**
 * The activity tab: upstream's own web build as an inline document in a frame, with
 * nothing above it.
 *
 * There used to be a 28-px row here — readiness, full screen, reload. It was the only
 * part of this plugin the upstream page never asked for, and it cost the canvas a
 * permanent strip of height. The two actions moved into a corner overlay
 * (`editor-dock.tsx`, plus ⇧⌘R / ⇧⌘F); the readiness glyph retired because the boot
 * cover already says what is happening and the canvas says when it is over. What the
 * row also carried — the document name and the last notice — now reaches the user two
 * ways that cost no height: a prompt-attachment chip in the input bar, and the activity
 * strip in the bottom-left corner of the frame.
 *
 * ADR: docs/adr/<slug>/0001-the-tab-runs-upstreams-web-build.md
 * ADR: docs/adr/<slug>/craft-0018-the-header-became-a-corner.md
 */
export function CraftTab({ ctx }: { ctx: PluginContext }): JSX.Element {
	const session = useCraftEditor(ctx);
	const { strings, iframeDoc, iframeKey, frameRef, containerRef, overlay, phase, boot, notice, iconUrl } =
		session;
	// The Fullscreen API can be refused by the host frame. Then the shell itself
	// covers the viewport — same element, same dock, nothing lost on the way in.
	const shell = overlay
		? "fixed inset-0 z-[80] flex h-screen w-screen flex-col bg-neutral-950"
		: "flex h-full min-h-0 w-full flex-col bg-neutral-950";

	return (
		<div ref={containerRef} className={shell}>
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

				<EditorDock
					strings={strings}
					disabled={iframeDoc === null}
					isFullscreen={session.isFullscreen}
					onReload={session.reload}
					onToggleFullscreen={session.toggleFullscreen}
					onAskAgent={session.askAgent}
				/>

				<ActivityStrip
					strings={strings}
					progress={session.progress}
					notes={session.notes}
					intent={session.intent}
				/>

				{/* Covers the frame until the engine reports its first frame: upstream's own
				    loading line is one grey sentence on black, and its twenty-second "taking
				    longer than usual" notice reads as a fault. Same cover in all fifteen. */}
				<BootCover
					phase={phase}
					boot={boot}
					awake={session.awake}
					strings={strings}
					notice={notice}
					iconUrl={iconUrl}
					onReload={session.reload}
				/>
			</div>
		</div>
	);
}
