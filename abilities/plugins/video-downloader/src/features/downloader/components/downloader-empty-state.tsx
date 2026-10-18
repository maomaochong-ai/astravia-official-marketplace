import { useTranslation } from "@astravia-org/plugin-sdk";
import { FEATURED_SITES } from "../../../domain/site-catalog";

export function DownloaderEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <div className="grid size-11 place-items-center rounded-xl border border-border bg-card">
        <span className="icon-[solar--link-circle-linear] size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm text-foreground">{t("empty.title")}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{t("empty.hint")}</p>
      <div className="mt-4 flex max-w-md flex-wrap justify-center gap-1.5">
        {FEATURED_SITES.map((site) => (
          <span
            key={site}
            className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {site}
          </span>
        ))}
      </div>
    </div>
  );
}
