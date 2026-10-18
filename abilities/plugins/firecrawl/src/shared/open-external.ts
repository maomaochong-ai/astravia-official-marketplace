/**
 * Opens a URL in the OS browser.
 *
 * The plugin has no in-app browser anymore: the host exposes `ui.openExternal`,
 * which only accepts http(s) and needs `shell.openExternal`. Callers turn the
 * rejection into a toast, because a failed hand-off is otherwise invisible.
 */

import { getPluginContext } from "../runtime/plugin-context";

export async function openExternal(url: string): Promise<void> {
	if (!/^https?:\/\//i.test(url)) throw new Error("Only http and https URLs can be opened");
	await getPluginContext().ui.openExternal(url);
}
