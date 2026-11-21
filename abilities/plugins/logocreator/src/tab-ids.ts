/**
 * Ids that cross the plugin/host boundary.
 *
 * The tab id is the one identifier a user can half-see (it keys the persisted tab
 * strip), so it says what the surface is: a canvas. Tool ids carry the ability name
 * because the model calls them by name.
 */

/** Activity-tab id: the logo canvas. */
export const LOGO_TAB_ID = "logocreator-canvas";

export const TOOL_DESIGN = "logocreator_design";
export const TOOL_BRAND_KIT = "logocreator_brand_kit";
export const TOOL_CATALOG = "logocreator_catalog";
export const TOOL_NOTES = "logocreator_notes";
export const TOOL_PLAN = "logocreator_plan";
