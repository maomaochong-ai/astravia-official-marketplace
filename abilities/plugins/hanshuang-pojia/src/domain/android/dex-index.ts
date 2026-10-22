import { u32 } from "../bytes";
import { readDexString, readUleb128 } from "./dex";

/**
 * A class/method index over one DEX file. Fully static: it reads the id tables
 * and each class_data block, never executes anything. This is the part of an
 * "smali search" that matters for triage — finding the class or method that
 * names a gate, a licence check or an endpoint — without materialising smali.
 */

export interface DexMethodEntry {
	name: string;
	params: string;
	returns: string;
	access: number | null;
}

export interface DexClassEntry {
	name: string;
	superName: string | null;
	access: number;
	methods: DexMethodEntry[];
}

export interface DexIndex {
	classes: DexClassEntry[];
	methodCount: number;
	stringCount: number;
	classCount: number;
	comments: string[];
}

export type DexSearchKind = "class" | "method" | "string" | "any";

export interface DexSearchHit {
	kind: "class" | "method" | "string";
	value: string;
	owner: string | null;
}

const PRIMITIVES: Record<string, string> = {
	V: "void",
	Z: "boolean",
	B: "byte",
	S: "short",
	C: "char",
	I: "int",
	J: "long",
	F: "float",
	D: "double",
};

export function describeDescriptor(descriptor: string): string {
	if (descriptor === "") return "?";
	const arrayDepth = descriptor.lastIndexOf("[") + 1;
	const base = descriptor.slice(arrayDepth);
	const suffix = "[]".repeat(arrayDepth);
	if (base.length === 1 && PRIMITIVES[base]) return `${PRIMITIVES[base]}${suffix}`;
	if (base.startsWith("L") && base.endsWith(";")) return `${base.slice(1, -1).replace(/\//g, ".")}${suffix}`;
	return `${descriptor}${suffix}`;
}

interface Tables {
	bytes: Uint8Array;
	stringOffsets: number;
	stringCount: number;
	typeOffsets: number;
	typeCount: number;
	protoOffsets: number;
	protoCount: number;
	methodOffsets: number;
	methodCount: number;
	classOffsets: number;
	classCount: number;
	strings: Map<number, string>;
}

function readTables(bytes: Uint8Array): Tables {
	return {
		bytes,
		stringCount: u32(bytes, 56),
		stringOffsets: u32(bytes, 60),
		typeCount: u32(bytes, 64),
		typeOffsets: u32(bytes, 68),
		protoCount: u32(bytes, 72),
		protoOffsets: u32(bytes, 76),
		methodCount: u32(bytes, 88),
		methodOffsets: u32(bytes, 92),
		classCount: u32(bytes, 96),
		classOffsets: u32(bytes, 100),
		strings: new Map(),
	};
}

function stringAt(tables: Tables, index: number): string {
	const cached = tables.strings.get(index);
	if (cached !== undefined) return cached;
	if (index < 0 || index >= tables.stringCount) return "";
	const offset = u32(tables.bytes, tables.stringOffsets + index * 4);
	const value = readDexString(tables.bytes, offset);
	tables.strings.set(index, value);
	return value;
}

function descriptorAt(tables: Tables, typeIndex: number): string {
	if (typeIndex < 0 || typeIndex >= tables.typeCount) return "";
	const descriptorIndex = u32(tables.bytes, tables.typeOffsets + typeIndex * 4);
	return stringAt(tables, descriptorIndex);
}

function protoAt(tables: Tables, protoIndex: number): { params: string; returns: string } {
	if (protoIndex < 0 || protoIndex >= tables.protoCount) return { params: "", returns: "?" };
	const base = tables.protoOffsets + protoIndex * 12;
	const returnType = u32(tables.bytes, base + 4);
	const parametersOffset = u32(tables.bytes, base + 8);
	const params: string[] = [];
	if (parametersOffset !== 0) {
		const count = u32(tables.bytes, parametersOffset);
		for (let index = 0; index < Math.min(count, 64); index += 1) {
			const typeIndex = u32(tables.bytes, parametersOffset + 4 + index * 2);
			params.push(describeDescriptor(descriptorAt(tables, typeIndex)));
		}
	}
	return { params: params.join(", "), returns: describeDescriptor(descriptorAt(tables, returnType)) };
}

function className(tables: Tables, typeIndex: number): string {
	return describeDescriptor(descriptorAt(tables, typeIndex));
}

function readClassMethods(tables: Tables, classDataOffset: number, limit: number): DexMethodEntry[] {
	const methods: DexMethodEntry[] = [];
	const bytes = tables.bytes;
	let cursor = classDataOffset;
	const sizes: number[] = [];
	for (let index = 0; index < 4; index += 1) {
		const read = readUleb128(bytes, cursor);
		sizes.push(read.value);
		cursor = read.next;
	}
	const [staticFields, instanceFields, directMethods, virtualMethods] = sizes as [number, number, number, number];

	for (let index = 0; index < Math.min(staticFields + instanceFields, 100000); index += 1) {
		cursor = readUleb128(bytes, cursor).next;
		cursor = readUleb128(bytes, cursor).next;
	}

	const total = Math.min(directMethods + virtualMethods, 100000);
	let methodIndex = 0;
	for (let index = 0; index < total; index += 1) {
		const delta = readUleb128(bytes, cursor);
		cursor = delta.next;
		methodIndex += delta.value;
		const access = readUleb128(bytes, cursor);
		cursor = access.next;
		cursor = readUleb128(bytes, cursor).next;
		if (methods.length >= limit) break;
		if (methodIndex >= tables.methodCount) break;
		const base = tables.methodOffsets + methodIndex * 8;
		const protoIndex = (u32(bytes, base) >>> 16) & 0xffff;
		const nameIndex = u32(bytes, base + 4);
		const proto = protoAt(tables, protoIndex);
		methods.push({ name: stringAt(tables, nameIndex), params: proto.params, returns: proto.returns, access: access.value });
	}
	return methods;
}

export function indexDex(
	bytes: Uint8Array,
	options: { maxClasses?: number; maxMethodsPerClass?: number; maxStrings?: number } = {},
): DexIndex {
	const maxClasses = Math.max(1, options.maxClasses ?? 2000);
	const maxMethodsPerClass = Math.max(1, options.maxMethodsPerClass ?? 400);
	const maxStrings = Math.max(1, options.maxStrings ?? 20000);
	const tables = readTables(bytes);
	const comments: string[] = [];
	const classes: DexClassEntry[] = [];

	const classCount = Math.min(tables.classCount, maxClasses);
	for (let index = 0; index < classCount; index += 1) {
		const base = tables.classOffsets + index * 32;
		const typeIndex = u32(bytes, base);
		const access = u32(bytes, base + 4);
		const superIndex = u32(bytes, base + 8);
		const classDataOffset = u32(bytes, base + 24);
		const name = className(tables, typeIndex);
		let methods: DexMethodEntry[] = [];
		if (classDataOffset !== 0) {
			try {
				methods = readClassMethods(tables, classDataOffset, maxMethodsPerClass);
			} catch {
				comments.push(`class_data of ${name} is out of bounds; method bodies were skipped`);
			}
		}
		classes.push({
			name,
			superName: superIndex === 0xffffffff ? null : className(tables, superIndex),
			access,
			methods,
		});
	}
	if (tables.classCount > classCount) comments.push(`only the first ${classCount} of ${tables.classCount} classes were indexed`);

	const stringCount = Math.min(tables.stringCount, maxStrings);
	if (tables.stringCount > stringCount) comments.push(`only the first ${stringCount} of ${tables.stringCount} strings were indexed`);

	return {
		classes,
		methodCount: tables.methodCount,
		stringCount: tables.stringCount,
		classCount: tables.classCount,
		comments,
	};
}

/** Every string in the pool, capped — the raw material for keyword hunting. */
export function dexStrings(bytes: Uint8Array, limit = 20000): string[] {
	const tables = readTables(bytes);
	const out: string[] = [];
	for (let index = 0; index < Math.min(tables.stringCount, limit); index += 1) {
		const value = stringAt(tables, index);
		if (value !== "") out.push(value);
	}
	return out;
}

export function describeEntry(entry: DexMethodEntry): string {
	return `${entry.returns} ${entry.name}(${entry.params})`;
}

export function searchDex(
	index: DexIndex,
	strings: readonly string[],
	query: string,
	kind: DexSearchKind,
	limit: number,
): { hits: DexSearchHit[]; truncated: boolean } {
	const needle = query.trim().toLowerCase();
	if (needle === "") return { hits: [], truncated: false };
	const hits: DexSearchHit[] = [];
	const seen = new Set<string>();
	const add = (hit: DexSearchHit): boolean => {
		const key = `${hit.kind}:${hit.owner ?? ""}:${hit.value}`;
		if (seen.has(key)) return true;
		seen.add(key);
		if (hits.length >= limit) return false;
		hits.push(hit);
		return true;
	};

	let truncated = false;
	const wantClass = kind === "class" || kind === "any";
	const wantMethod = kind === "method" || kind === "any";
	const wantString = kind === "string" || kind === "any";

	for (const entry of index.classes) {
		if (wantClass && entry.name.toLowerCase().includes(needle)) {
			if (!add({ kind: "class", value: entry.name, owner: entry.superName })) {
				truncated = true;
				return { hits, truncated };
			}
		}
		if (!wantMethod) continue;
		for (const method of entry.methods) {
			const text = describeEntry(method);
			if (!text.toLowerCase().includes(needle)) continue;
			if (!add({ kind: "method", value: text, owner: entry.name })) {
				truncated = true;
				return { hits, truncated };
			}
		}
	}

	if (wantString) {
		for (const value of strings) {
			if (!value.toLowerCase().includes(needle)) continue;
			if (!add({ kind: "string", value, owner: null })) {
				truncated = true;
				break;
			}
		}
	}

	return { hits, truncated };
}
