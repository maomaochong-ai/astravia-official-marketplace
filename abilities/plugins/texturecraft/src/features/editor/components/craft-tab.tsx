import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { APP } from "../../../app.config.ts";
import { useCraftEditor } from "../hooks/use-craft-editor.ts";
import { ActivityStrip } from "./activity-strip.tsx";
import { BootCover } from "./boot-cover.tsx";
import { FrameMenu } from "./frame-menu.tsx";
import { RegionMarquee } from "./region-marquee.tsx";

/**
 * The activity tab: upstream's own web build as an inline document in a frame, with
 * nothing above it and nothing resting on it.
 *
 * There used to be a 28-px row here — readiness, full screen, reload. It was the only
 * part of this plugin the upstream page never asked for, and it cost the canvas a
 * permanent strip of height. Then the three actions moved into a corner pill, which was
 * worse in a quieter way: at rest it sat at 45 % opacity in the top-right corner, which
 * is where upstream draws its own controls, so it hid them instead of the header.
 *
 * They are now on the canvas's own right-click. The page forwards the press
 * (`host-bridge.js`) because pointer events over an iframe never reach this document;
 * the menu opens where the pointer already is, so it costs no pixels and cannot collide
 * with the app's layout. Shift+right-click still goes to the app. `mod+shift+r` and
 * `mod+shift+f` still work for anyone who never right-clicks.
 *
 * The menu also offers what "hand it to the AI" was missing: a dragged area instead of
 * the whole page. The marquee is drawn here, above the frame, and the page crops it —
 * `craft:capture` already takes normalized coordinates, so no new capability was needed.
 * The canvas is one wasm surface, so an area is the smallest unit the shell can ask
 * for; there are no elements to click.
 *
 * ADR: docs/adr/<slug>/0001-the-tab-runs-upstreams-web-build.md
 * ADR: docs/adr/<slug>/craft-0018-the-header-became-a-corner.md
 * ADR: docs/adr/<slug>/craft-0021-the-canvas-is-clicked-not-covered.md
 */
export function CraftTab({ ctx }: { ctx: PluginContext }): JSX.Element {
	const session = useCraftEditor(ctx);
	const { strings, iframeDoc, iframeKey, frameRef, containerRef, overlay, phase, boot, notice, iconUrl } =
		session;
	// The Fullscreen API can be refused by the host frame. Then the shell itself
	// covers the viewport — same element, same menu, nothing lost on the way in.
	const shell = overlay
		? "fixed inset-0 z-[80] flex h-screen w-screen flex-col bg-neutral-950"
		: "flex h-full min-h-0 w-full flex-col bg-neutral-950";
	const busy = iframeDoc === null;

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

				{session.menu && !busy ? (
					<FrameMenu
						strings={strings}
						point={session.menu}
						onClose={session.closeMenu}
						onRegion={session.beginRegion}
						onPage={() => {
							session.closeMenu();
							void session.askAgent();
						}}
						onReload={() => {
							session.closeMenu();
							session.reload();
						}}
						onToggleFullscreen={() => {
							session.closeMenu();
							session.toggleFullscreen();
						}}
						fullscreen={session.isFullscreen}
						disabled={busy}
					/>
				) : null}

				{session.picking && !busy ? (
					<RegionMarquee
						strings={strings}
						onCancel={session.cancelRegion}
						onPicked={(rect) => void session.captureRegion(rect)}
					/>
				) : null}

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
