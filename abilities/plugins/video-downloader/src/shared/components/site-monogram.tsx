import { siteMonogram } from "../../domain/site-catalog";

interface SiteMonogramProps {
  site: string;
  url: string;
  size?: "sm" | "md";
}

/**
 * Neutral tile carrying the site's initial. Brand marks are deliberately absent: the panel
 * must follow the host theme, and third-party colours would fight it.
 */
export function SiteMonogram({ site, url, size = "md" }: SiteMonogramProps) {
  const box = size === "sm" ? "size-8 text-[11px]" : "size-10 text-xs";
  return (
    <div
      className={`${box} grid shrink-0 place-items-center rounded-lg border border-border bg-muted font-medium text-muted-foreground`}
      aria-hidden="true"
    >
      {siteMonogram(site, url)}
    </div>
  );
}
