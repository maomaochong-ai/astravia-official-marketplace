import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ReactElement } from "react";
import { PREVIEW_PAGE_HTML } from "../preview-page";

/**
 * Full-page surface for the illustrated introduction.
 *
 * The page is rendered into a sandboxed iframe rather than injected into the host
 * document: it carries its own <style> block, and its selectors (`body`, `:root`)
 * would otherwise repaint the whole Astravia window. `allow-scripts` without
 * `allow-same-origin` gives it a unique origin, so its reveal animation runs while
 * the page cannot read host state, touch storage, or navigate the app.
 */
export function GuideView(): ReactElement {
	const { t } = useTranslation();

	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			<header className="shrink-0 border-b border-border/60 px-4 py-3">
				<h1 className="text-sm font-semibold text-foreground">{t("guide.view.title")}</h1>
				<p className="mt-1 text-xs text-muted-foreground">{t("guide.view.subtitle")}</p>
			</header>
			<iframe
				className="min-h-0 w-full flex-1 border-0 bg-white"
				sandbox="allow-scripts"
				srcDoc={PREVIEW_PAGE_HTML}
				title={t("guide.frame.title")}
			/>
		</div>
	);
}
