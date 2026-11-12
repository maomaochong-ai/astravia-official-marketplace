import type { JSX } from "react";
import { useState } from "react";
import type { EditorSession } from "../hooks/use-editor-session.ts";

/**
 * The 28 px line that used to sit above the frame, now a strip that appears when the
 * pointer reaches the top edge and leaves again when it goes.
 *
 * It never carried the editor — it carried readiness, the file name and three buttons
 * — but it occupied a band of the panel for the whole session, and the app inside the
 * frame has a toolbar of its own at that same edge. Two bars, one of them permanent,
 * is a strip of canvas the user never gets back. So the same information is now
 * *transient*: an invisible 10 px hover zone stays at the top, the bar slides out of
 * it, and it is also shown unprompted whenever there is something to say (a failure,
 * a notice, a batch running) — silence is the default, not a hidden fault.
 *
 * The three controls are unchanged: language is a word, full screen and reload are
 * icons with an accessible name and a platform tooltip. No "open in a browser".
 *
 */
export function EditorStatusBar({ session }: { session: EditorSession }): JSX.Element {
  const { strings, phase, binding, candidate, savedAt, notice, isFullscreen, progress, uiLang } = session;
  const [hovered, setHovered] = useState(false);
  const status = phase === "failed" ? strings.failed : phase === "ready" ? strings.ready : strings.preparing;
  const tone =
    phase === "failed" ? "text-red-400" : phase === "ready" ? "text-emerald-400" : "text-amber-300";
  const dot = phase === "failed" ? "bg-red-400" : phase === "ready" ? "bg-emerald-400" : "bg-amber-300";
  const disabled = session.iframeDoc === null;
  // Something to say is a reason to be on screen without being asked.
  const announced = phase !== "ready" || !!notice || !!progress;
  const shown = hovered || announced;

  return (
    <div
      className="absolute inset-x-0 top-0 z-20"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Always present, never visible: the hover target has to exist before the bar
          does, or there is nothing to move the pointer onto. */}
      <div aria-hidden="true" className="h-2.5 w-full" />
      {shown ? (
        <div className="flex h-7 shrink-0 items-center gap-2 border-b border-neutral-800 bg-neutral-950/95 px-2 text-[11px] text-neutral-300 backdrop-blur-sm">
          <span
            className="flex items-center gap-1.5"
            title={status}
            aria-label={status}
            role="status"
          >
            <span className={`inline-block size-1.5 rounded-full ${dot}`} />
            <span className={`truncate ${tone}`}>{status}</span>
          </span>
          <span className="h-3 w-px bg-neutral-700" />
          <span className="truncate">
            {binding
              ? binding.name
              : candidate
                ? `${strings.open}: ${candidate.name}`
                : strings.noFile}
          </span>
          {savedAt ? <span className="text-neutral-500">{new Date(savedAt).toLocaleTimeString()}</span> : null}
          <span className="flex-1" />
          {progress ? (
            <span className="max-w-[38%] truncate text-amber-300/90" role="status">
              {strings.acting} {progress}
            </span>
          ) : notice ? (
            <span className="max-w-[40%] truncate text-neutral-400">{notice}</span>
          ) : null}

          {/* A word, not a glyph: "中文" and "EN" are what a reader recognises. */}
          <button
            type="button"
            title={strings.language}
            aria-label={strings.language}
            disabled={disabled}
            onClick={() => session.toggleLanguage()}
            className="flex h-5 items-center rounded px-1 text-[11px] text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
            data-lang={uiLang}
          >
            {strings.language}
          </button>

          <button
            type="button"
            title={isFullscreen ? strings.exitFullscreen : strings.fullscreen}
            aria-label={isFullscreen ? strings.exitFullscreen : strings.fullscreen}
            disabled={disabled && !isFullscreen}
            onClick={() => session.toggleFullscreen()}
            className="flex size-5 items-center justify-center rounded text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
          >
            {isFullscreen ? (
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2v3a1 1 0 0 1-1 1H2" />
                <path d="M10 2v3a1 1 0 0 0 1 1h3" />
                <path d="M6 14v-3a1 1 0 0 0-1-1H2" />
                <path d="M10 14v-3a1 1 0 0 1 1-1h3" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2h5v5" />
                <path d="M14 2 9.5 6.5" />
                <path d="M7 14H2V9" />
                <path d="M2 14l4.5-4.5" />
              </svg>
            )}
          </button>

          <button
            type="button"
            title={strings.reload}
            aria-label={strings.reload}
            disabled={disabled}
            onClick={() => session.reload()}
            className="flex size-5 items-center justify-center rounded text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.2" />
              <path d="M13.5 2.5V6H10" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
