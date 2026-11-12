/**
 * Assessment notes: what a pentester keeps beside the terminal.
 *
 * Upstream has the same five calls (`strix/tools/notes`), keyed by a 6-character id
 * so the model can refer to one in a later turn. Storage is the plugin's data
 * directory, one JSON file per assessment session, so notes survive a restart and do
 * not travel inside the shipped archive.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveDataDir, sessionKey } from "./paths";

export interface Note {
	id: string;
	title: string;
	content: string;
	category: string;
	created_at: string;
	updated_at: string;
}

/** Upstream's ids are short and human-typeable; `note_id` shows up in the model's prose. */
function shortId(): string {
	return randomUUID().replace(/-/g, "").slice(0, 6);
}
/** A note without its body, plus the one line the list shows. */
export interface NoteSummary extends Omit<Note, "content"> {
	preview: string;
}

export class NoteStore {
	constructor(private readonly dir: string = resolveDataDir()) {}

	private file(sessionId: string): string {
		return join(this.dir, "notes", `${sessionKey(sessionId)}.json`);
	}

	private async read(sessionId: string): Promise<Note[]> {
		try {
			const parsed: unknown = JSON.parse(await readFile(this.file(sessionId), "utf8"));
			return Array.isArray(parsed) ? (parsed as Note[]) : [];
		} catch {
			return [];
		}
	}

	private async write(sessionId: string, notes: Note[]): Promise<void> {
		await mkdir(join(this.dir, "notes"), { recursive: true });
		await writeFile(this.file(sessionId), `${JSON.stringify(notes, null, 2)}\n`, "utf8");
	}

	async create(sessionId: string, params: Record<string, unknown>): Promise<{ note: Note }> {
		const title = String(params.title ?? "").trim();
		const content = String(params.content ?? "");
		if (!title) throw new Error("title is required");
		if (!content.trim()) throw new Error("content is required");
		const now = new Date().toISOString();
		const note: Note = {
			id: shortId(),
			title,
			content,
			category: String(params.category ?? "").trim(),
			created_at: now,
			updated_at: now,
		};
		const notes = await this.read(sessionId);
		notes.unshift(note);
		await this.write(sessionId, notes);
		return { note };
	}

	async list(
		sessionId: string,
		params: Record<string, unknown> = {},
	): Promise<{ count: number; notes: NoteSummary[] }> {
		const category = String(params.category ?? "").trim();
		const notes = (await this.read(sessionId)).filter((note) => (category ? note.category === category : true));
		return {
			count: notes.length,
			notes: notes.map(({ content, ...rest }) => ({ ...rest, preview: content.replace(/\s+/g, " ").slice(0, 120) })),
		};
	}

	async get(sessionId: string, params: Record<string, unknown>): Promise<{ note: Note }> {
		const id = String(params.id ?? "").trim();
		const note = (await this.read(sessionId)).find((item) => item.id === id);
		if (!note) throw new Error(`no note with id ${id}`);
		return { note };
	}

	async update(sessionId: string, params: Record<string, unknown>): Promise<{ note: Note }> {
		const id = String(params.id ?? "").trim();
		const notes = await this.read(sessionId);
		const index = notes.findIndex((item) => item.id === id);
		if (index < 0) throw new Error(`no note with id ${id}`);
		const current = notes[index]!;
		const next: Note = {
			...current,
			...(typeof params.title === "string" ? { title: params.title } : {}),
			...(typeof params.content === "string" ? { content: params.content } : {}),
			updated_at: new Date().toISOString(),
		};
		notes[index] = next;
		await this.write(sessionId, notes);
		return { note: next };
	}

	async delete(sessionId: string, params: Record<string, unknown>): Promise<{ deleted: string }> {
		const id = String(params.id ?? "").trim();
		const notes = await this.read(sessionId);
		const remaining = notes.filter((item) => item.id !== id);
		if (remaining.length === notes.length) throw new Error(`no note with id ${id}`);
		await this.write(sessionId, remaining);
		return { deleted: id };
	}
}
