import type { PluginToolCallSlotProps } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";

/**
 * What a batch did, drawn where the tool call is.
 *
 * The host renders a plugin tool's result as its raw text, which for a batch is a
 * forty-line JSON document about coordinates. This slot replaces that rendering for
 * `*_act` only: one row per step with the label the agent wrote, the outcome, and the
 * measured colour change at the end. The JSON is still what the model reads — this is
 * the reader's copy of it.
 *
 * A slot **replaces** the default rendering, so it must never be the reason a result
 * disappears: pending, empty, malformed and error cases all fall back to the raw text.
 */
interface ActStepView {
  index?: number;
  op?: string;
  label?: string;
  ok?: boolean;
  error?: string;
}

interface ActView {
  ok?: boolean;
  steps?: ActStepView[];
  elapsedMs?: number | null;
  change?: { distance?: number; meanBefore?: string; meanAfter?: string } | null;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The tool result, or `null` when this is not the JSON a batch returns. */
function parse(result: string | undefined): ActView | null {
  if (!result) return null;
  try {
    const value: unknown = JSON.parse(result);
    if (!isRecord(value)) return null;
    const steps = Array.isArray(value.steps) ? value.steps : [];
    return {
      ok: value.ok === true,
      error: typeof value.error === "string" ? value.error : undefined,
      elapsedMs: typeof value.elapsedMs === "number" ? value.elapsedMs : null,
      change: isRecord(value.change) ? (value.change as ActView["change"]) : null,
      steps: steps.filter(isRecord).map((step) => ({
        index: typeof step.index === "number" ? step.index : undefined,
        op: typeof step.op === "string" ? step.op : undefined,
        label: typeof step.label === "string" ? step.label : undefined,
        ok: step.ok === true,
        error: typeof step.error === "string" ? step.error : undefined,
      })),
    };
  } catch {
    return null;
  }
}

const ROW = "flex items-baseline gap-1.5 leading-5";

export function ActTimeline({ toolCall }: PluginToolCallSlotProps): JSX.Element {
  const view = parse(toolCall.result);
  const raw = <pre className="whitespace-pre-wrap break-words text-xs opacity-70">{toolCall.result ?? ""}</pre>;

  if (!view) {
    // Pending, cancelled, or a shape this component does not know: say nothing clever.
    return raw;
  }

  if (!view.steps?.length) {
    return view.error ? (
      <p className="text-xs text-rose-500">{view.error}</p>
    ) : (
      raw
    );
  }

  const done = view.steps.filter((step) => step.ok).length;
  const distance = view.change?.distance;

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <div className={ROW}>
        <span className={view.ok ? "text-emerald-500" : "text-rose-500"}>{view.ok ? "✓" : "✗"}</span>
        <span className="font-medium">
          {done}/{view.steps.length}
        </span>
        {typeof distance === "number" ? (
          <span className="opacity-60">
            · canvas changed {distance <= 1 ? `${Math.round(distance * 100)}%` : `${Math.round(distance)}`}
          </span>
        ) : null}
        {typeof view.elapsedMs === "number" ? <span className="opacity-40">· {Math.round(view.elapsedMs / 100) / 10}s</span> : null}
      </div>

      {view.steps.map((step) => (
        <div key={`${step.index ?? 0}-${step.op ?? ""}`} className={ROW}>
          <span className={`w-3 shrink-0 ${step.ok ? "text-emerald-500" : "text-rose-500"}`}>
            {step.ok ? "✓" : "✗"}
          </span>
          <span className="min-w-0 break-words">
            {step.label || step.op || "step"}
            {step.error ? <span className="opacity-60"> — {step.error}</span> : null}
          </span>
        </div>
      ))}

      {view.error ? <p className="text-rose-500">{view.error}</p> : null}
    </div>
  );
}
