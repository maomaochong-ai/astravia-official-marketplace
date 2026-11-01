import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";

/**
 * Plain `textarea` on purpose: an Adapter is a small JSON file, and a rich editor would be a
 * second dependency to keep alive for no gain in correctness.
 */
export function AdapterEditor({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit(text: string): Promise<boolean>;
  onCancel(): void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function save(): Promise<void> {
    setBusy(true);
    const accepted = await onSubmit(text);
    setBusy(false);
    if (accepted) onCancel();
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-3">
      <label className="text-[11px] font-medium text-muted-foreground" htmlFor="adapter-source">
        {t("adapter.source")}
      </label>
      <textarea
        id="adapter-source"
        value={text}
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
        className="mt-2 h-64 w-full resize-y rounded-lg border border-border bg-background p-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:border-primary"
      />
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-7 items-center rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {t("action.cancel")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[11px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("action.saveAdapter")}
        </button>
      </div>
    </div>
  );
}
