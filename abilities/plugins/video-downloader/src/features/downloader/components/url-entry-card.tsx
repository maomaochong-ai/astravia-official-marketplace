import { useTranslation } from "@astravia-org/plugin-sdk";

interface UrlEntryCardProps {
  url: string;
  probing: boolean;
  error: string | null;
  onUrlChange(value: string): void;
  onAnalyze(): void;
  onPaste(): void;
}

export function UrlEntryCard({ url, probing, error, onUrlChange, onAnalyze, onPaste }: UrlEntryCardProps) {
  const { t } = useTranslation();
  const canAnalyze = url.trim().length > 0 && !probing;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 rounded-xl border bg-card p-1.5 transition-colors ${
          error ? "border-destructive/60" : "border-border focus-within:border-primary/60"
        }`}
      >
        <span className="icon-[solar--link-minimalistic-2-linear] ml-1.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={url}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onUrlChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canAnalyze) onAnalyze();
          }}
          placeholder={t("field.url.placeholder")}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={onPaste}
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
      {error ? <p className="mt-2 px-1 text-xs leading-relaxed text-destructive">{error}</p> : null}
    </div>
  );
}
