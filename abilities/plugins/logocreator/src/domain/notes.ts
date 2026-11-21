import type { PluginStorageApi } from "@astravia-org/plugin-sdk";

/**
 * Canvas notes — the "this is wrong, change it" channel.
 *
 * A note is anchored to the design it was written on and to a point on the canvas
 * (0–1 in both axes, so it survives any preview size). It carries no styling and no
 * instruction format the model has to parse: the text *is* the instruction, and the
 * prompt builder is the only thing that turns it into a turn.
 *
 * Storage lives beside the designs (`notes.json`), for the same reason: the record
 * is tiny and reconstructing it is free.
 */

export const NOTES_PATH = "notes.json";
export const NOTES_SCHEMA = 1;
export const MAX_NOTE_LENGTH = 600;
export const NOTES_LIMIT = 200;

export type NoteStatus = "pending" | "resolved";

export interface CanvasNote {
	id: string;
	/** Design the note is about; a note without one is about the current form. */
	designId: string | null;
	text: string;
	/** Fractional anchor on the canvas preview: 0–1, top-left origin. */
	x: number;
	y: number;
	createdAt: number;
	status: NoteStatus;
	/** Set when a run consumed it, so the same note is not applied twice. */
	resolvedAt?: number;
}

interface NotesFile {
	schemaVersion: number;
	items: CanvasNote[];
}

export function newNoteId(): string {
	return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function clamp01(value: unknown): number {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0.5;
	return Math.min(0.98, Math.max(0.02, n));
}

export function coerceNote(raw: unknown): CanvasNote | null {
	if (!raw || typeof raw !== "object") return null;
	const value = raw as Partial<CanvasNote>;
	if (typeof value.id !== "string" || !value.id) return null;
	if (typeof value.text !== "string" || !value.text.trim()) return null;
	const createdAt = Number(value.createdAt);
	return {
		id: value.id,
		designId: typeof value.designId === "string" && value.designId ? value.designId : null,
		text: value.text.trim().slice(0, MAX_NOTE_LENGTH),
		x: clamp01(value.x),
		y: clamp01(value.y),
		createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
		status: value.status === "resolved" ? "resolved" : "pending",
		...(value.status === "resolved" ? { resolvedAt: Number(value.resolvedAt) || Date.now() } : {}),
	};
}

export class NoteStore {
	private items: CanvasNote[] = [];
	private loaded = false;
	private hydrating: Promise<void> | null = null;
	private listeners = new Set<() => void>();

	constructor(private readonly storage: PluginStorageApi) {}

	async hydrate(): Promise<CanvasNote[]> {
		if (this.loaded) return this.items;
		this.hydrating ??= this.read();
		await this.hydrating;
		return this.items;
	}

	/**
	 * Same rule as the design history: `persist()` rewrites the whole file, so a
	 * write before the read would replace every note the user already wrote.
	 */
	private async ready(): Promise<void> {
		if (!this.loaded) await this.hydrate();
	}

	private async read(): Promise<void> {
		try {
			const raw = await this.storage.readFile(NOTES_PATH, "utf8");
			if (raw) {
				const parsed = JSON.parse(raw) as NotesFile;
				this.items = Array.isArray(parsed.items)
					? parsed.items.map(coerceNote).filter((note): note is CanvasNote => note !== null)
					: [];
			}
		} catch {
			this.items = [];
		}
		this.items.sort((a, b) => b.createdAt - a.createdAt);
		this.loaded = true;
		this.emit();
	}

	list(): CanvasNote[] {
		return this.items;
	}

	pending(designId?: string | null): CanvasNote[] {
		return this.items.filter(
			(note) => note.status === "pending" && (designId === undefined || note.designId === designId),
		);
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	async add(draft: { designId: string | null; text: string; x: number; y: number }): Promise<CanvasNote> {
		await this.ready();
		const note = coerceNote({
			id: newNoteId(),
			designId: draft.designId,
			text: draft.text,
			x: draft.x,
			y: draft.y,
			createdAt: Date.now(),
			status: "pending",
		});
		if (!note) throw new Error("A note needs text");
		this.items = [note, ...this.items].slice(0, NOTES_LIMIT);
		await this.persist();
		return note;
	}

	async resolve(ids: readonly string[]): Promise<number> {
		await this.ready();
		const wanted = new Set(ids);
		let resolved = 0;
		this.items = this.items.map((note) => {
			if (!wanted.has(note.id) || note.status === "resolved") return note;
			resolved += 1;
			return { ...note, status: "resolved", resolvedAt: Date.now() } as CanvasNote;
		});
		if (resolved > 0) await this.persist();
		return resolved;
	}

	async remove(id: string): Promise<void> {
		await this.ready();
		this.items = this.items.filter((note) => note.id !== id);
		await this.persist();
	}

	async clear(designId?: string | null): Promise<void> {
		await this.ready();
		this.items = designId === undefined ? [] : this.items.filter((note) => note.designId !== designId);
		await this.persist();
	}

	private async persist(): Promise<void> {
		const file: NotesFile = { schemaVersion: NOTES_SCHEMA, items: this.items };
		await this.storage.writeFile(NOTES_PATH, JSON.stringify(file, null, 2), "utf8");
		this.emit();
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
}

/**
 * The turn a batch of notes becomes.
 *
 * Deliberately explicit about *not* re-rolling the design: the agent is asked to
 * translate each note into a field change on the spec, because a new seed throws
 * away the composition the user already accepted (the same rule the skill states).
 */
export function notesPrompt(notes: readonly CanvasNote[], brandName: string): string {
	const lines = notes.map((note, index) => `${index + 1}. ${note.text}`).join("\n");
	return [
		`Apply these canvas notes to the "${brandName || "current"}" logo:`,
		lines,
		"Change only the fields a note names (name, tagline, type, style, detail, colour, surface, monochrome, intent, seed) and re-render with logocreator_design.",
		"Keep the seed unless a note is about the mark's shape; do not re-roll the whole design.",
	].join("\n\n");
}
