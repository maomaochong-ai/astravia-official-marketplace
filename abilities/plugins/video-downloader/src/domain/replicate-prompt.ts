import type { MediaFormat, MediaItem } from "./media-info";

export interface ReplicateInput {
  item: MediaItem;
  format: MediaFormat | null;
  /** Name of the adapter that produced the item, when the Engine was not the one that answered. */
  adapterName?: string;
}

/** Every line is a fact the resolve path already observed, so the agent does not re-resolve it. */
export interface ReplicateLabels {
  heading: string;
  site: string;
  title: string;
  uploader: string;
  page: string;
  quality: string;
  stream: string;
  path: string;
  engine: string;
  adapter: string;
  metadataOnly: string;
  mergeNote: string;
  ask: string;
}

export function buildReplicatePrompt(input: ReplicateInput, labels: ReplicateLabels): string {
  const { item, format, adapterName } = input;
  const lines = [
    labels.heading,
    "",
    `- ${labels.site}: ${item.site}`,
    `- ${labels.title}: ${item.title}`,
    `- ${labels.page}: ${item.sourceUrl}`,
  ];
  if (item.uploader) lines.push(`- ${labels.uploader}: ${item.uploader}`);
  if (format) {
    const merge = format.needsFfmpeg ? ` (${labels.mergeNote})` : "";
    lines.push(`- ${labels.quality}: ${format.quality} · ${format.ext}${merge}`);
    if (format.directUrl) lines.push(`- ${labels.stream}: ${format.directUrl}`);
  } else {
    lines.push(`- ${labels.metadataOnly}`);
  }
  const path =
    item.extractionPath === "adapter"
      ? `${labels.adapter}${adapterName ? ` (${adapterName})` : ""}`
      : labels.engine;
  lines.push(`- ${labels.path}: ${path}`, "", labels.ask);
  return lines.join("\n");
}
