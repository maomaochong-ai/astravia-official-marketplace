/**
 * How the console talks about artifact types.
 *
 * Both the shelf and the spider web colour-code by kind, and Tailwind only ships
 * classes it can see literally in the source, so the map lives here instead of
 * being built from a string template at the call site.
 */

import type { ArtifactKind } from "../../domain/firecrawl/artifacts";

export const ARTIFACT_KIND_ORDER: readonly ArtifactKind[] = [
	"markdown",
	"links",
	"images",
	"video",
	"audio",
	// Legacy runs archived before the media split; no chip unless one restores.
	"media",
	"json",
	"document",
];

export const ARTIFACT_DOT: Record<ArtifactKind, string> = {
	markdown: "bg-emerald-500",
	links: "bg-sky-500",
	images: "bg-violet-500",
	video: "bg-rose-500",
	audio: "bg-amber-500",
	media: "bg-amber-500",
	json: "bg-indigo-500",
	document: "bg-slate-400",
};

export const ARTIFACT_LABEL_KEY: Record<ArtifactKind, string> = {
	markdown: "artifact.kind.markdown",
	links: "artifact.kind.links",
	images: "artifact.kind.images",
	video: "artifact.kind.video",
	audio: "artifact.kind.audio",
	media: "artifact.kind.media",
	json: "artifact.kind.json",
	document: "artifact.kind.document",
};

/** A stable-ish hue for the arrival packets, expressed as an SVG stroke colour. */
export const ARTIFACT_STROKE: Record<ArtifactKind, string> = {
	markdown: "#10b981",
	links: "#0ea5e9",
	images: "#8b5cf6",
	video: "#f43f5e",
	audio: "#f59e0b",
	media: "#f59e0b",
	json: "#6366f1",
	document: "#94a3b8",
};
