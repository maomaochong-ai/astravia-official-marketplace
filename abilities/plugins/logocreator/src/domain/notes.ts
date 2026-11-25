import type { PluginStorageApi } from "@astravia-org/plugin-sdk";
import { describePart, type LogoPart } from "./note-parts";
import { mergeLists, toPersistedList, type PersistedList } from "./persist-merge";

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

/**
 * Who a note is about.
 *
 * - `design`: this design only (the comment on the mark you are looking at).
 * - `global`: the brand as a whole — palette, tone, "always keep 24 px legible".
 *
 * The reference design plugin draws the same line between element/frame anchors and
 * free canvas notes; both kinds are needed, and mixing them silently is what makes a
 * note list feel unreliable.
 */
export type NoteScope = "design" | "global";

export interface CanvasNote {
	id: string;
	/** Design the note is about; null means "the form currently open". */
	designId: string | null;
	/**
	 * 备注属于哪个工作区。
	 *
	 * 品牌级备注（`designId === null`）故意跨项目共享：一套品牌规则所有稿适用；
	 * 但挂在具体某一稿上的备注不该跑到另一个项目里。旧记录没有这个字段，按共享处理。
	 */
	cwd?: string | null;
	scope: NoteScope;
	/** Which structural part the pin landed on; null for a global note. */
	part: LogoPart | null;
	text: string;
	/** Fractional anchor on the canvas preview: 0–1, top-left origin. */
	x: number;
	y: number;
	createdAt: number;
	status: NoteStatus;
	/** Set when a run consumed it, so the same note is not applied twice. */
	resolvedAt?: number;
	/**
	 * When this note was handed to the conversation. Distinct from `resolvedAt`: a
	 * dispatch says "the agent has been told", a resolve says "the agent changed it".
	 * Auto-dispatch keys off this so a note is never sent twice and a note added
	 * mid-run is never forgotten.
	 */
	dispatchedAt?: number;
}

type NotesFile = PersistedList<CanvasNote>;

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
		cwd: typeof value.cwd === "string" && value.cwd ? value.cwd : null,
		designId: typeof value.designId === "string" && value.designId ? value.designId : null,
		scope: value.scope === "global" ? "global" : "design",
		part: (value.part as LogoPart | undefined) ?? null,
		text: value.text.trim().slice(0, MAX_NOTE_LENGTH),
		x: clamp01(value.x),
		y: clamp01(value.y),
		createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
		status: value.status === "resolved" ? "resolved" : "pending",
		...(value.status === "resolved" ? { resolvedAt: Number(value.resolvedAt) || Date.now() } : {}),
		...(Number.isFinite(Number(value.dispatchedAt)) && Number(value.dispatchedAt) > 0
			? { dispatchedAt: Number(value.dispatchedAt) }
			: {}),
	};
}

export class NoteStore {
	private items: CanvasNote[] = [];
	/** Deleted ids, merged into the file so no writer can revive them. */
	private tombstones = new Set<string>();
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
				this.tombstones = new Set(Array.isArray(parsed.deleted) ? parsed.deleted : []);
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

	/** Pending and not yet handed over — the set auto-dispatch works from. */
	undispatched(designId?: string | null): CanvasNote[] {
		return this.pending(designId).filter((note) => note.dispatchedAt === undefined);
	}

	/**
	 * Record the hand-off. Called *before* the send resolves: a failed send then leaves
	 * the note pending-but-dispatched, and the user's manual button can still re-send.
	 */
	async markDispatched(ids: readonly string[]): Promise<void> {
		await this.ready();
		const wanted = new Set(ids);
		const now = Date.now();
		let changed = 0;
		this.items = this.items.map((note) => {
			if (!wanted.has(note.id) || note.dispatchedAt !== undefined) return note;
			changed += 1;
			return { ...note, dispatchedAt: now } as CanvasNote;
		});
		if (changed > 0) await this.persist();
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

	async add(draft: {
		designId: string | null;
		text: string;
		x: number;
		y: number;
		scope?: NoteScope;
		part?: LogoPart | null;
		cwd?: string | null;
	}): Promise<CanvasNote> {
		await this.ready();
		const note = coerceNote({
			id: newNoteId(),
			cwd: draft.scope === "global" ? null : (draft.cwd ?? null),
			designId: draft.scope === "global" ? null : draft.designId,
			scope: draft.scope === "global" ? "global" : "design",
			part: draft.scope === "global" ? null : (draft.part ?? null),
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
		this.tombstones.add(id);
		await this.persist();
	}

	async clear(designId?: string | null): Promise<void> {
		await this.ready();
		const doomed =
			designId === undefined
				? this.items
				: this.items.filter((note) => note.designId === designId && note.scope === "design");
		for (const note of doomed) this.tombstones.add(note.id);
		this.items = this.items.filter((note) => !doomed.includes(note));
		await this.persist();
	}

	/** Same read-merge-write rule as the design history: a delete must stick. */
	private async persist(): Promise<void> {
		let stored: NotesFile = { schemaVersion: NOTES_SCHEMA, items: [] };
		try {
			const raw = await this.storage.readFile(NOTES_PATH, "utf8");
			if (raw) {
				const parsed = JSON.parse(raw) as NotesFile;
				stored = {
					schemaVersion: NOTES_SCHEMA,
					items: Array.isArray(parsed.items)
						? parsed.items.map(coerceNote).filter((note): note is CanvasNote => note !== null)
						: [],
					deleted: Array.isArray(parsed.deleted) ? parsed.deleted : [],
				};
			}
		} catch {
			// A corrupt file must not block a delete; the write below replaces it.
		}

		const merged = mergeLists({
			file: stored,
			mine: this.items,
			myTombstones: [...this.tombstones],
			idOf: (note) => note.id,
			rankOf: (note) => note.createdAt,
		});
		merged.items = merged.items.slice(0, NOTES_LIMIT);
		this.items = merged.items;
		this.tombstones = new Set(merged.tombstones);

		await this.storage.writeFile(NOTES_PATH, JSON.stringify(toPersistedList(merged), null, 2), "utf8");
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
	const lines = notes
		.map((note, index) => {
			const where = note.scope === "global" ? "whole brand" : describePart(note.part);
			return `${index + 1}. [${where}] ${note.text}`;
		})
		.join("\n");
	return [
		`Apply these canvas notes to the "${brandName || "current"}" logo:`,
		lines,
		"Change only the fields a note names (name, tagline, type, style, detail, colour, surface, monochrome, intent, seed) and re-render with logocreator_design.",
		"Keep the seed unless a note is about the mark's shape; do not re-roll the whole design.",
		"A note marked \"whole brand\" is a standing rule: apply it to this design and state it back, so later designs can follow it.",
	].join("\n\n");
}
