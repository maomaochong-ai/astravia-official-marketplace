import { useTranslation } from "@astravia-org/plugin-sdk";
import { formatBytes } from "../../../domain/format-bytes";
import type { MediaItem } from "../../../domain/media-info";
import { siteLabel } from "../../../domain/site-catalog";
import { SiteMonogram } from "../../../shared/components/site-monogram";

interface MediaPreviewCardProps {
  items: MediaItem[];
  activeIndex: number;
  selectedFormatId: string | null;
  ffmpegAvailable: boolean;
  starting: boolean;
  onSelectItem(index: number): void;
  onSelectFormat(formatId: string): void;
  onStart(): void;
}

export function MediaPreviewCard({
  items,
  activeIndex,
  selectedFormatId,
  ffmpegAvailable,
  starting,
  onSelectItem,
  onSelectFormat,
  onStart,
}: MediaPreviewCardProps) {
  const { t } = useTranslation();
  const item = items[activeIndex];
  if (!item) return null;
  const selected = item.formats.find((format) => format.id === selectedFormatId) ?? null;
  const blocked = selected?.needsFfmpeg === true && !ffmpegAvailable;

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <SiteMonogram site={item.site} url={item.sourceUrl} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{item.title}</h3>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {siteLabel(item.site, item.sourceUrl, t("site.unknown"))} · {t(`kind.${item.kind}`)} ·{" "}
            {t("preview.formatCount", { count: item.formats.length })}
          </p>
        </div>
        {items.length > 1 ? (
          <select
            value={activeIndex}
            onChange={(event) => onSelectItem(Number(event.target.value))}
            className="h-7 rounded-md border border-border bg-background px-1.5 text-[11px] text-muted-foreground outline-none"
          >
            {items.map((candidate, index) => (
              <option key={candidate.id} value={index}>
                {index + 1} / {items.length} · {candidate.title.slice(0, 28)}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {item.formats.map((format) => {
          const active = format.id === selectedFormatId;
          const unavailable = format.needsFfmpeg && !ffmpegAvailable;
          return (
            <button
              key={format.id}
              type="button"
              onClick={() => onSelectFormat(format.id)}
              aria-pressed={active}
              className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                active
                  ? "border-primary/70 bg-primary/10"
                  : "border-border hover:border-muted-foreground/40 hover:bg-accent"
              } ${unavailable ? "opacity-60" : ""}`}
            >
              <span className={`block text-xs font-medium ${active ? "text-primary" : "text-foreground"}`}>
                {format.quality}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                {format.ext}
                {format.sizeBytes > 0 ? ` · ${formatBytes(format.sizeBytes)}` : ""}
                {format.needsFfmpeg ? " · ffmpeg" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <p className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
          {blocked
            ? t("preview.ffmpegMissing")
            : selected?.needsFfmpeg
              ? t("preview.ffmpegNote")
              : selected
                ? t("preview.singlePart")
                : ""}
        </p>
        <button
          type="button"
          disabled={!selected || blocked || starting}
          onClick={onStart}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <span
            className={`${starting ? "icon-[solar--refresh-linear] animate-spin" : "icon-[solar--download-minimalistic-linear]"} size-3.5`}
            aria-hidden="true"
          />
          {starting ? t("action.starting") : t("action.download")}
        </button>
      </div>
    </section>
  );
}
