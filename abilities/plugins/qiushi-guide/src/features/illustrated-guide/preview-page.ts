import previewPageHtml from "../../assets/preview-page.html?raw";

/**
 * The illustrated page itself — byte-for-byte the file the skill package ships at
 * `abilities/skills/qiushi-skill/assets/preview/index.html`.
 *
 * The copy is deliberate: the plugin has to render this page without knowing where
 * the skill was installed, on any platform, offline. `scripts/sync-preview-page.mjs`
 * refreshes it and the marketplace content test fails when the two drift apart.
 */
export const PREVIEW_PAGE_HTML: string = previewPageHtml;
