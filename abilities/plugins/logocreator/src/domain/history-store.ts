import type { PluginStorageApi } from "@astravia-org/plugin-sdk";
import { normalizeSpec, type LogoSpec } from "./spec";

/**
 * Design history.
 *
 * A record stores the *spec*, not the picture: the local engine is reproducible,
 * so a design costs a few hundred bytes and can be re-exported at any size later.
 * AI results are the exception — they cannot be re-derived, so their PNG lives in
 * host blob storage and the record keeps only the blob id.
 */

export const HISTORY_PATH = "designs.json";
export const HISTORY_SCHEMA = 1;
export const HISTORY_LIMIT = 240;

export type EngineKind = "local" | "ai";

export interface DesignRecord {
	id: string;
	spec: LogoSpec;
	engine: EngineKind;
	/** Motif name used by the engine, or the model id for an AI run. */
	subject: string;
	createdAt: number;
	favorite: boolean;
	/** User-set label; falls back to the brand name. */
	name?: string;
	/** Only for AI records: the image blob holding the PNG. */
	blobId?: string;
}

interface HistoryFile {
	schemaVersion: number;
	items: DesignRecord[];
}

export interface DesignDraft {
	id: string;
	spec: LogoSpec;
	engine: EngineKind;
	subject: string;
	name?: string;
	blobId?: string;
}

export function newDesignId(): string {
	const random = Math.random().toString(36).slice(2, 8);
	return `d${Date.now().toString(36)}${random}`;
}

function coerceRecord(raw: unknown): DesignRecord | null {
	if (!raw || typeof raw !== "object") return null;
	const value = raw as Partial<DesignRecord>;
	if (typeof value.id !== "string" || !value.id) return null;
	const createdAt = Number(value.createdAt);
	return {
		id: value.id,
		spec: normalizeSpec(value.spec),
		engine: value.engine === "ai" ? "ai" : "local",
		subject: typeof value.subject === "string" ? value.subject : "unknown",
		createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
		favorite: value.favorite === true,
		name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : undefined,
		blobId: typeof value.blobId === "string" && value.blobId ? value.blobId : undefined,
	};
}

export function displayLabel(record: DesignRecord): string {
	return record.name || record.spec.brandName || "Untitled";
}

/**
 * In-memory list with write-through to host storage.
 *
 * The store is deliberately dumb about React: components subscribe and re-read.
 * Keeping persistence out of the hook is what makes "add → reload → still there"
 * testable without a DOM.
 */
export class HistoryStore {
	private items: DesignRecord[] = [];
	private loaded = false;
	private listeners = new Set<() => void>();

	constructor(private readonly storage: PluginStorageApi) {}

	async hydrate(): Promise<DesignRecord[]> {
		if (this.loaded) return this.items;
		try {
			const raw = await this.storage.readFile(HISTORY_PATH, "utf8");
			if (raw) {
				const parsed = JSON.parse(raw) as HistoryFile;
				this.items = Array.isArray(parsed.items)
					? parsed.items.map(coerceRecord).filter((r): r is DesignRecord => r !== null)
					: [];
			}
		} catch {
			// A corrupt or unreadable file must not look like "no designs ever":
			// keep the in-memory list and let the next write replace the file.
			this.items = [];
		}
		this.items.sort((a, b) => b.createdAt - a.createdAt);
		this.loaded = true;
		this.emit();
		return this.items;
	}

	list(): DesignRecord[] {
		return this.items;
	}

	get(id: string): DesignRecord | undefined {
		return this.items.find((item) => item.id === id);
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	async add(draft: DesignDraft): Promise<DesignRecord> {
		const record: DesignRecord = {
			id: draft.id,
			spec: normalizeSpec(draft.spec),
			engine: draft.engine,
			subject: draft.subject,
			createdAt: Date.now(),
			favorite: false,
			name: draft.name,
			blobId: draft.blobId,
		};
		this.items = [record, ...this.items].slice(0, HISTORY_LIMIT);
		await this.persist();
		return record;
	}

	async update(id: string, patch: Partial<Pick<DesignRecord, "favorite" | "name" | "spec">>): Promise<void> {
		this.items = this.items.map((item) =>
			item.id === id
				? {
						...item,
						...patch,
						spec: patch.spec ? normalizeSpec(patch.spec) : item.spec,
						name: patch.name !== undefined ? (patch.name.trim() || undefined) : item.name,
					}
				: item,
		);
		await this.persist();
	}

	async remove(id: string): Promise<void> {
		const gone = this.items.find((item) => item.id === id);
		this.items = this.items.filter((item) => item.id !== id);
		await this.persist();
		if (gone?.blobId) {
			// Best effort: an orphaned blob is a wasted kilobyte, not a broken design.
			await this.storage.deleteBlob(gone.blobId).catch(() => undefined);
		}
	}

	async clear(): Promise<void> {
		const blobs = this.items.map((item) => item.blobId).filter((id): id is string => Boolean(id));
		this.items = [];
		await this.persist();
		await Promise.all(blobs.map((id) => this.storage.deleteBlob(id).catch(() => undefined)));
	}

	private async persist(): Promise<void> {
		const file: HistoryFile = { schemaVersion: HISTORY_SCHEMA, items: this.items };
		try {
			await this.storage.writeFile(HISTORY_PATH, JSON.stringify(file, null, 2), "utf8");
		} catch (error) {
			throw new Error(`Could not save the design history: ${error instanceof Error ? error.message : String(error)}`);
		}
		this.emit();
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
}
