import type { JSX } from "react";
import { useEffect, useState } from "react";
import { APP } from "../../../app.config.ts";
import type { BootState, EditorPhase } from "../hooks/use-craft-editor.ts";
import type { EditorStrings } from "../strings.ts";

/**
 * What the tab shows while the engine is not up yet.
 *
 * Upstream's page has a loading line of its own, and it is wrong for this host in two
 * ways: it is one grey sentence in the middle of a black frame, and at twenty seconds it
 * turns into "this is taking longer than usual" — which reads as a fault even when the
 * engine is compiling normally. A 13–32 MB wasm build takes that long on a cold start.
 *
 * So the frame is covered until it reports ready. The cover is the same in every craft
 * plugin (only the icon and the name come from `app.config.ts`), it says which phase the
 * boot is in, and it repeats upstream's own line underneath instead of hiding it: that
 * line is the only progress signal the app actually emits.
 *
 * The bar is not a byte counter — nothing in the page reports bytes. It moves with the
 * boot's real phases (read the package, start the engine, first frame) and then climbs
 * slowly, so the difference between "working" and "wedged" comes from the phase text and
 * the elapsed seconds, never from a bar that stalls at 90 %.
 */

interface BootCoverProps {
  phase: EditorPhase;
  boot: BootState;
  strings: EditorStrings;
  notice: string | null;
  /** Package-relative icon, or null before the package root is known. */
  iconUrl: string | null;
  onReload: () => void;
}

/** Upstream's own notice appears at 20 s; ours should be in place before that. */
const DWARF_SLOW_MS = 18000;
const TICK_MS = 400;

function ratioFor(phase: EditorPhase, hasDocument: boolean, elapsedMs: number): number {
  if (phase === "ready") return 1;
  if (!hasDocument) return 0.04 + Math.min(0.16, (elapsedMs / 1200) * 0.16);
  // Ready is reported after the first frame is drawn, so the climb stays below the cap
  // until that message arrives — no bar that reads 100 % over a still-black frame.
  return 0.2 + 0.72 * (1 - Math.exp(-elapsedMs / 16000));
}

export function BootCover({
  phase,
  boot,
  strings,
  notice,
  iconUrl,
  onReload,
}: BootCoverProps): JSX.Element {
  const finished = phase === "ready";
  const failed = phase === "failed";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (finished || failed) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [finished, failed]);

  // The icon is a package file like the site itself; a dev link or a stripped package
  // simply has none, and a broken image marker in the middle of the cover is worse than
  // the name alone.
  const [iconBroken, setIconBroken] = useState(false);
  useEffect(() => setIconBroken(false), [iconUrl]);

  const elapsedMs = Math.max(0, now - boot.startedAt);
  const seconds = Math.round(elapsedMs / 1000);
  const hasDocument = boot.hasDocument;
  const ratio = failed ? 1 : ratioFor(phase, hasDocument, elapsedMs);
  const slow = failed || boot.slow || elapsedMs > DWARF_SLOW_MS;

  const stage = failed
    ? strings.failed
    : !hasDocument
      ? strings.bootRead
      : boot.line
        ? strings.bootEngine
        : strings.bootDraw;

  if (finished) return <></>;

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-950 px-6 text-center"
      role="status"
      aria-live="polite"
    >
      {iconUrl && !iconBroken ? (
        <img
          src={iconUrl}
          alt=""
          onError={() => setIconBroken(true)}
          className="h-14 w-14 rounded-2xl object-contain opacity-90"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-lg font-semibold text-neutral-300">
          {APP.name.slice(0, 1)}
        </div>
      )}

      <div className="text-sm font-medium text-neutral-200">{APP.name}</div>

      <div className="h-[3px] w-56 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            failed ? "bg-rose-400/80" : "bg-sky-400/80"
          }`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <span className={failed ? "text-rose-300" : "text-neutral-300"}>{stage}</span>
        <span className="text-neutral-600">·</span>
        <span className="tabular-nums">{strings.bootSeconds.replace("{n}", String(seconds))}</span>
      </div>

      {/* Upstream's own line, verbatim: the only sign of life the page emits. */}
      {boot.line ? (
        <div className="max-w-md truncate text-[11px] text-neutral-500" title={boot.line}>
          {boot.line}
        </div>
      ) : null}

      {failed && notice ? (
        <div className="max-w-md text-[11px] leading-relaxed text-rose-300/90">{notice}</div>
      ) : null}

      {failed ? (
        <button
          type="button"
          onClick={onReload}
          className="mt-1 rounded-md border border-white/15 bg-white/5 px-3 py-1 text-xs text-neutral-200 hover:bg-white/10"
        >
          {strings.reload}
        </button>
      ) : null}

      {!failed && slow ? (
        <div className="max-w-sm text-[11px] leading-relaxed text-neutral-500">{strings.bootSlow}</div>
      ) : null}
    </div>
  );
}
