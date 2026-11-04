import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import type { RecentFile } from "../hooks/use-craft-editor.ts";

/**
 * The tab's own Recent list.
 *
 * Every craft app has a Recent page in its File screen, and on the web it cannot
 * work: the list stores absolute paths and re-reads them with the native filesystem,
 * which the browser build answers with "files are opened through the browser on the
 * web". The paths that *do* exist here are the workspace ones the host handed over,
 * so this menu keeps those and re-opens them through `ctx.fs` instead.
 *
 * ADR: docs/adr/<slug>/craft-0014-recent-files-are-the-hosts-not-the-apps.md
 */
interface RecentFilesMenuProps {
  entries: RecentFile[];
  label: string;
  empty: string;
  hint: string;
  disabled: boolean;
  onPick: (entry: RecentFile) => void;
}

function when(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function RecentFilesMenu({
  entries,
  label,
  empty,
  hint,
  disabled,
  onPick,
}: RecentFilesMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent): void => {
      if (!shellRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={shellRef} className="relative">
      <button
        type="button"
        title={hint}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex h-5 items-center gap-1 rounded px-1.5 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3.5"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 4v4l2.5 1.6" />
          <path d="M1.9 8a6.1 6.1 0 1 0 1.9-4.4" />
          <path d="M1.5 2.5v3.2h3.2" />
        </svg>
        <span className="tabular-nums">{entries.length}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-6 z-30 w-72 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900/95 py-1 shadow-xl shadow-black/40 backdrop-blur"
        >
          <div className="px-2.5 pb-1 pt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
            {label}
          </div>
          {entries.length === 0 ? (
            <div className="px-2.5 py-2 text-[11px] text-neutral-500">{empty}</div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onPick(entry);
                }}
                className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left hover:bg-neutral-800"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] text-neutral-200">{entry.name}</span>
                  <span className="block truncate text-[10px] text-neutral-500" title={entry.path}>
                    {entry.path}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-neutral-600">{when(entry.at)}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
