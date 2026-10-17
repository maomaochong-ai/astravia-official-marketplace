import { useCallback, useSyncExternalStore } from "react";
import { getPluginContext, hasPluginContext } from "../../../runtime/plugin-context";

function subscribeLocale(listener: () => void): () => void {
	if (!hasPluginContext()) return () => {};
	const subscription = getPluginContext().i18n.onChange(listener);
	return () => subscription.dispose();
}

function readLocale(): string {
	return hasPluginContext() ? getPluginContext().i18n.locale : "en";
}

/**
 * Translator bound to the plugin's locale catalogs. Missing keys render as the
 * key itself so a gap is visible rather than silently blank.
 */
export function useTranslate(): (key: string, params?: Record<string, string | number>) => string {
	const locale = useSyncExternalStore(subscribeLocale, readLocale, () => "en");
	return useCallback(
		(key: string, params?: Record<string, string | number>) => {
			if (!hasPluginContext()) return key;
			void locale;
			return getPluginContext().i18n.t(key, params);
		},
		[locale],
	);
}
