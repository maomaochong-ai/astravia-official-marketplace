import { useTranslation } from "@astravia-org/plugin-sdk";
import type { SiteCoverage } from "../../../domain/media-info";

/**
 * What the pinned engine can resolve, grouped by region and kind, plus the platforms it cannot —
 * with the reason. The list comes from the service, so it can never drift from the engine again.
 */
export function SiteCoveragePanel({
  coverage,
  onOpenCookie,
}: {
  coverage: SiteCoverage;
  onOpenCookie(): void;
}) {
  const { t } = useTranslation();

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-foreground">{t("sites.title")}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("sites.subtitle")}</p>
        </div>
        <button
          type="button"
          aria-label={t("action.fillCookie")}
          title={t("action.fillCookie")}
          onClick={onOpenCookie}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="icon-[solar--key-minimalistic-square-linear] size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="mt-3 space-y-2.5">
        {coverage.groups.map((group) => (
          <div key={group.key}>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t(`sites.group.${group.key}`)}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {group.sites.map((site) => (
                <span
                  key={site}
                  className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground"
                >
                  {site}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {coverage.unsupported.length > 0 ? (
        <div className="mt-3.5 border-t border-border pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("sites.unsupportedTitle")}
          </p>
          <ul className="mt-1.5 space-y-1">
            {coverage.unsupported.map((site) => (
              <li key={site.label} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="truncate text-muted-foreground">{site.label}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground/80">{t(`sites.reason.${site.reason}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <span className="icon-[solar--link-circle-linear] mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span>{t("sites.directHint")}</span>
      </p>
    </section>
  );
}
