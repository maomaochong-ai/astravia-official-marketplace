import type { EditorSession } from "../hooks/use-photocraft-editor.ts";

/** The single 28 px line above the frame: state, binding, and the four actions. */
export function EditorStatusBar({ session }: { session: EditorSession }): React.ReactElement {
  const { strings, phase, backend, binding, candidate, savedAt, notice, isFullscreen } = session;
  const status = phase === "failed" ? strings.failed : phase === "ready" ? strings.ready : strings.preparing;
  const tone =
    phase === "failed" ? "text-red-400" : phase === "ready" ? "text-emerald-400" : "text-amber-300";
  const disabled = session.iframeSrc === null;

  return (
    <div className="flex h-7 shrink-0 items-center gap-2 border-b border-neutral-800 px-2 text-[11px] text-neutral-300">
      <span className={`truncate ${tone}`}>● {status}</span>
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
      {notice ? <span className="max-w-[40%] truncate text-neutral-400">{notice}</span> : null}
      <button
        type="button"
        disabled={disabled && !isFullscreen}
        onClick={() => session.toggleFullscreen()}
        className="rounded px-1.5 py-0.5 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
      >
        {isFullscreen ? strings.exitFullscreen : strings.fullscreen}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => session.reload()}
        className="rounded px-1.5 py-0.5 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
      >
        {strings.reload}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => session.openEntry("panel")}
        className="rounded px-1.5 py-0.5 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
      >
        {strings.builtinBrowser}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => session.openEntry("system")}
        className="rounded px-1.5 py-0.5 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
      >
        {strings.systemBrowser}
      </button>
    </div>
  );
}
