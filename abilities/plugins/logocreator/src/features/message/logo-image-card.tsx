import { useState, type JSX } from "react";
import type { PluginCardProps, PluginImageRef } from "@astravia-org/plugin-sdk";
import { useActiveConversation, useTranslation } from "@astravia-org/plugin-sdk";
import { getPluginContext } from "../../plugin-context";
import { setPendingDesignId } from "../canvas/pending-design";
import { LOGO_TAB_ID } from "../../tab-ids";
import { BUTTON_SECONDARY, FOCUS_RING } from "../../shared/styles/tokens";
import { IconCanvas, IconCopy, IconEye, IconRename } from "../../shared/components/icons";

/**
 * The card that puts generated marks back into the conversation.
 *
 * Borrowed wholesale from the reference image plugin, because it solves the exact gap
 * this plugin had: the tool produced images, the panel had them, and the conversation
 * showed only a sentence. A card renderer is the host-sanctioned way to show the
 * result *where the user is looking* — and to hang the three actions that matter off
 * it (open in canvas, copy, reuse as an edit target).
 *
 * `pending` is true while the tool is in flight: the host synthesizes a descriptor
 * before the result lands, so the skeleton claims the space and the message does not
 * jump when the images arrive.
 */

export interface ImageCardPayload {
	/** Settled refs, in generation order. */
	images?: PluginImageRef[];
	/** Design ids in the same order, so "open in canvas" can reveal the right record. */
	designIds?: string[];
}

function Skeleton(): JSX.Element {
	const { t } = useTranslation();
	return (
		<div className="flex gap-2 py-1" aria-busy>
			{[0, 1, 2].map((index) => (
				<div
					key={index}
					className="relative aspect-square h-28 shrink-0 animate-pulse overflow-hidden rounded-xl border border-border/60 bg-muted"
					style={{ animationDelay: `${index * 120}ms` }}
				>
					{index === 0 ? (
						<span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
							{t("card.processing")}
						</span>
					) : null}
				</div>
			))}
		</div>
	);
}

export function LogoImageCard({ descriptor, pending }: PluginCardProps): JSX.Element | null {
	const { t } = useTranslation();
	const cwd = useActiveConversation().cwd;
	const payload = (descriptor.payload ?? {}) as ImageCardPayload;
	const [busy, setBusy] = useState<string | null>(null);

	if (pending) return <Skeleton />;

	const refs = payload.images ?? [];
	if (refs.length === 0) return null;

	const openInCanvas = (ref: PluginImageRef, index: number) => {
		const ctx = getPluginContext();
		const designId = payload.designIds?.[index];
		// Same hand-off the tool uses: leave the id for the panel, then bring it up.
		if (designId) setPendingDesignId(cwd ?? undefined, designId);
		try {
			const scope = cwd ?? undefined;
			ctx.ui.setActivityTabVisible(LOGO_TAB_ID, true, scope ? { cwd: scope } : undefined);
			ctx.ui.openActivityTab(LOGO_TAB_ID, scope ? { width: "max", cwd: scope } : { width: "max" });
		} catch {
			// Opening the tab is a convenience; the image is already stored.
		}
	};

	const copy = async (ref: PluginImageRef) => {
		// `ui.copyImage` feeds Electron's nativeImage, which only decodes PNG/JPEG: a
		// provider may return WebP, so re-encode through a canvas first.
		setBusy(ref.id);
		try {
			const blob = await fetch(ref.url).then((response) => response.blob());
			const bitmap = await createImageBitmap(blob);
			const canvas = document.createElement("canvas");
			canvas.width = bitmap.width;
			canvas.height = bitmap.height;
			canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
			bitmap.close();
			await getPluginContext().ui.copyImage(canvas.toDataURL("image/png"));
		} catch (error) {
			getPluginContext().ui.notify({ message: t("notify.copyFailed"), error });
		} finally {
			setBusy(null);
		}
	};

	const attachForEdit = (ref: PluginImageRef) => {
		// The attachment is what makes "make it warmer" land on *this* image instead of
		// a fresh logo: the instructions name the tool and the id.
		getPluginContext().ui.setPromptAttachment({
			id: ref.id,
			label: t("card.editTarget"),
			icon: "icon-[solar--gallery-linear]",
			instructions: [
				`The user attached generated image ${ref.id} from LogoCreator.`,
				`Call logocreator_image with referenceImageId="${ref.id}" and the requested change; do not start a new logo from scratch.`,
			],
		});
	};

	return (
		<div className="space-y-1.5 py-1">
			<div className="flex flex-wrap gap-2">
				{refs.map((ref, index) => (
					<figure key={ref.id} className="m-0 space-y-1">
						<button
							type="button"
							onClick={() => getPluginContext().ui.previewImage(ref, refs)}
							title={t("card.preview")}
							className={`${FOCUS_RING} block overflow-hidden rounded-xl border border-border/60`}
						>
							<img src={ref.url} alt={t("card.alt")} className="block h-28 w-auto object-cover" draggable={false} />
						</button>
						<figcaption className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => openInCanvas(ref, index)}
								title={t("card.openCanvas")}
								aria-label={t("card.openCanvas")}
								className={`${BUTTON_SECONDARY} ${FOCUS_RING} h-6 px-1.5 text-[10px]`}
							>
								<IconCanvas className="size-3" />
								{t("card.openCanvasShort")}
							</button>
							<button
								type="button"
								onClick={() => attachForEdit(ref)}
								title={t("card.editTarget")}
								aria-label={t("card.editTarget")}
								className={`${BUTTON_SECONDARY} ${FOCUS_RING} h-6 px-1.5 text-[10px]`}
							>
								<IconRename className="size-3" />
							</button>
							<button
								type="button"
								onClick={() => void copy(ref)}
								disabled={busy === ref.id}
								title={t("card.copy")}
								aria-label={t("card.copy")}
								className={`${BUTTON_SECONDARY} ${FOCUS_RING} h-6 px-1.5 text-[10px]`}
							>
								<IconCopy className="size-3" />
							</button>
							<button
								type="button"
								onClick={() => getPluginContext().ui.previewImage(ref, refs)}
								title={t("card.preview")}
								aria-label={t("card.preview")}
								className={`${BUTTON_SECONDARY} ${FOCUS_RING} h-6 px-1.5 text-[10px]`}
							>
								<IconEye className="size-3" />
							</button>
						</figcaption>
					</figure>
				))}
			</div>
			<p className="text-[10px] text-muted-foreground">{t("card.rasterNote")}</p>
		</div>
	);
}
