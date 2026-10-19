import { useTranslation } from "@astravia-org/plugin-sdk";

interface UrlEntryCardProps {
  url: string;
  probing: boolean;
  /** The service is not usable yet: keep the card visible but inert instead of hiding it. */
  disabled?: boolean;
  error: string | null;
  /** Optional remedy shown next to the error, e.g. opening the cookie field. */
  remedy?: { label: string; run(): void };
  onUrlChange(value: string): void;
  onAnalyze(): void;
  onPaste(): void;
}

export function UrlEntryCard({
  url,
  probing,
  disabled = false,
  error,
  remedy,
  onUrlChange,
  onAnalyze,
  onPaste,
}: UrlEntryCardProps) {
  const { t } = useTranslation();
  const canAnalyze = !disabled && url.trim().length > 0 && !probing;

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-xl border bg-card p-2 transition-colors ${
          error ? "border-destructive/60" : "border-border focus-within:border-primary/60"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <span className="icon-[solar--link-minimalistic-2-linear] ml-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={url}
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => onUrlChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canAnalyze) onAnalyze();
          }}
          placeholder={t("field.url.placeholder")}
          className="h-9 min-w-0 flex-1 bg-transparent pl-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={onPaste}
          disabled={disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="icon-[solar--clipboard-linear] size-3.5" aria-hidden="true" />
          {t("action.paste")}
        </button>
        <button
          type="button"
          disabled={!canAnalyze}
          onClick={onAnalyze}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {probing ? (
            <span className="icon-[solar--refresh-linear] size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <span className="icon-[solar--magnifer-linear] size-3.5" aria-hidden="true" />
          )}
          {probing ? t("action.analyzing") : t("action.analyze")}
        </button>
      </div>
      {error ? (
        <div className="mt-2 flex items-start gap-2 px-1">
          <p className="text-xs leading-relaxed text-destructive">{error}</p>
          {remedy ? (
            <button
              type="button"
              onClick={remedy.run}
              className="shrink-0 text-xs text-primary underline-offset-2 transition-opacity hover:opacity-80 hover:underline"
            >
              {remedy.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
