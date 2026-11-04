import type { EditorSession } from "../hooks/use-craft-editor.ts";
import { RecentFilesMenu } from "./recent-files-menu.tsx";

/**
 * The single 28 px line above the frame. Three controls, icons only, each with the
 * platform tooltip (`title`) and an accessible name: readiness, full screen,
 * reload. There is no "open in a browser" control any more — the tab *is* the
 * editor, and a second window could not share the workspace binding.
 *
 * ADR: docs/adr/<slug>/craft-0010-icons-only-and-a-fullscreen-that-returns.md
 */
export function EditorStatusBar({ session }: { session: EditorSession }): React.ReactElement {
  const { strings, phase, backend, binding, candidate, savedAt, notice, isFullscreen, progress, recent } =
    session;
  const status = phase === "failed" ? strings.failed : phase === "ready" ? strings.ready : strings.preparing;
  const tone =
    phase === "failed" ? "text-red-400" : phase === "ready" ? "text-emerald-400" : "text-amber-300";
  const dot = phase === "failed" ? "bg-red-400" : phase === "ready" ? "bg-emerald-400" : "bg-amber-300";
  const disabled = session.iframeDoc === null;

  return (
    <div className="flex h-7 shrink-0 items-center gap-2 border-b border-neutral-800 px-2 text-[11px] text-neutral-300">
      <span
        className="flex items-center gap-1.5"
        title={status}
        aria-label={status}
        role="status"
      >
        <span className={`inline-block size-1.5 rounded-full ${dot}`} />
        <span className={`truncate ${tone}`}>{status}</span>
      </span>
      {backend ? <span className="rounded bg-neutral-800 px-1 text-neutral-300">{backend}</span> : null}
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

      <RecentFilesMenu
        entries={recent}
        label={strings.recent}
        empty={strings.recentEmpty}
        hint={strings.recentHint}
        disabled={disabled}
        onPick={session.openRecent}
      />

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
  );
}
