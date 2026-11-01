import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";

import type { MediaFormat, MediaItem } from "../../../domain/media-info";
import { buildReplicatePrompt, type ReplicateLabels } from "../../../domain/replicate-prompt";
import type { ManagedPluginContext } from "../../../runtime-contract";

export interface ReplicateController {
  available: boolean;
  sending: boolean;
  send(item: MediaItem, format: MediaFormat | null, adapterName?: string): Promise<void>;
}

/**
 * Hands the resolved result to the host conversation. A conversation that is mid-turn queues the
 * prompt instead of dropping it, and with no active session at all the text lands in the composer
 * so the user keeps the choice of sending it.
 */
export function useReplicate(ctx: ManagedPluginContext): ReplicateController {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const available = ctx.permissions.has("agent.session.write");

  async function send(item: MediaItem, format: MediaFormat | null, adapterName?: string): Promise<void> {
    if (!available || sending) return;
    const labels: ReplicateLabels = {
      heading: t("chat.replicate.heading"),
      site: t("chat.replicate.site"),
      title: t("chat.replicate.title"),
      uploader: t("chat.replicate.uploader"),
      page: t("chat.replicate.page"),
      quality: t("chat.replicate.quality"),
      stream: t("chat.replicate.stream"),
      path: t("chat.replicate.path"),
      engine: t("chat.replicate.engine"),
      adapter: t("chat.replicate.adapter"),
      metadataOnly: t("chat.replicate.metadataOnly"),
      mergeNote: t("chat.replicate.mergeNote"),
      ask: t("chat.replicate.ask"),
    };
    const text = buildReplicatePrompt({ item, format, adapterName }, labels);
    setSending(true);
    try {
      await ctx.conversation.sendPrompt(text);
      ctx.ui.notify({ message: t("chat.replicate.sent"), variant: "info" });
    } catch {
      // No active conversation: keep the prompt in the composer rather than losing it.
      ctx.conversation.insertText(text);
      ctx.ui.notify({ message: t("chat.replicate.inserted"), variant: "info" });
    } finally {
      setSending(false);
    }
  }

  return { available, sending, send };
}
