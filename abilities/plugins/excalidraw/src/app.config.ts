/**
 * The only app-specific source file in this plugin.
 *
 * The tab is a frame around upstream's own web build; `site` names the package
 * directory the build recipe fills (`web/`). Nothing else under `src/` knows what
 * Excalidraw is beyond the fields below.
 */
export const APP = {
  id: "excalidraw",
  name: "Excalidraw",
  tabId: "excalidraw",
  tabLabel: "Excalidraw",
  tabOrder: 24,
  /** Package directory holding the static site the build recipe produces. */
  site: "web",
  /**
   * Excalidraw resolves its language through `i18next-browser-languagedetector`,
   * whose first lookup source is `?lng=` on the URL; the shell writes the host
   * language there and also rewrites `navigator.language`, the next source in
   * that chain. No preference in storage is involved, so none is seeded.
   */
  upstream: "https://github.com/excalidraw/excalidraw",
} as const;
