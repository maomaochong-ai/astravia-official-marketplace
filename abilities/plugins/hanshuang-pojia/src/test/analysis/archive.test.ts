import { describe, expect, it } from "vitest";
import { parseDex } from "../../domain/android/dex";
import { buildManifestFacts } from "../../domain/android/manifest-model";
import { parseAxml } from "../../domain/archive/axml";
import { readSignatureFacts, summarizeArchive } from "../../domain/archive/archive-facts";
import { findZipEntry, readZipEntry, readZipIndex } from "../../domain/archive/zip";
import { buildApk, buildAxml, buildDex, buildZip, deflateRaw, utf8 } from "../fixtures";

describe("zip", () => {
	it("indexes stored entries with their sizes", () => {
		const archive = buildZip([
			{ name: "a.txt", data: utf8("alpha") },
			{ name: "dir/b.bin", data: new Uint8Array([0, 1, 2]) },
		]);
		const index = readZipIndex(archive);
		expect(index.entries.map(entry => entry.name)).toEqual(["a.txt", "dir/b.bin"]);
		expect(index.entries[0]?.uncompressedSize).toBe(5);
		expect(index.centralDirectoryOffset).toBeGreaterThan(0);
		expect(index.zip64).toBe(false);
	});

	it("returns stored payload bytes unchanged", async () => {
		const payload = new TextEncoder().encode("manifest-payload");
		const archive = buildZip([{ name: "AndroidManifest.xml", data: payload }]);
		const index = readZipIndex(archive);
		const entry = findZipEntry(index, "AndroidManifest.xml");
		expect(entry).toBeDefined();
		expect(Array.from(await readZipEntry(archive, entry!))).toEqual(Array.from(payload));
	});

	it("inflates deflated entries", async () => {
		const payload = new TextEncoder().encode("deflate me ".repeat(40));
		const compressed = await deflateRaw(payload);
		const archive = buildZip([{ name: "classes.dex", data: compressed, method: 8, uncompressedSize: payload.byteLength }]);
		const index = readZipIndex(archive);
		expect(index.entries[0]?.method).toBe(8);
		expect(index.entries[0]?.uncompressedSize).toBe(payload.byteLength);
		const restored = await readZipEntry(archive, index.entries[0]!);
		expect(new TextDecoder().decode(restored)).toBe("deflate me ".repeat(40));
	});

	it("reports unsafe and embedded executables through archive facts", () => {
		const archive = buildZip([
			{ name: "../escape.txt", data: utf8("x") },
			{ name: "lib/arm64-v8a/libcrypto.so", data: new Uint8Array(8) },
			{ name: "assets/payload.dex", data: new Uint8Array(8) },
		]);
		const facts = summarizeArchive(readZipIndex(archive));
		expect(facts.unsafePaths).toEqual(["../escape.txt"]);
		expect(facts.abis).toEqual(["arm64-v8a"]);
		expect(facts.embeddedExecutables).toContain("assets/payload.dex");
	});
});

describe("axml", () => {
	it("reads the manifest root and attributes", () => {
		const document = parseAxml(
			buildAxml({
				name: "manifest",
				attrs: [
					{ name: "package", value: "com.example.demo" },
					{ name: "versionCode", value: "7", type: "int" },
				],
			}),
		);
		expect(document.warnings).toEqual([]);
		expect(document.root?.name).toBe("manifest");
		expect(document.root?.attributes.map(attribute => attribute.value)).toEqual(["com.example.demo", "7"]);
	});

	it("rejects documents without the binary XML header", () => {
		expect(parseAxml(utf8("<manifest/>")).root).toBeNull();
	});

	it("builds the manifest facts the audit rules consume", () => {
		const archive = buildApk({ withDex: false });
		const entry = findZipEntry(readZipIndex(archive), "AndroidManifest.xml");
		const document = parseAxml(readStoredEntry(archive, entry!));
		expect(document.root).not.toBeNull();

		const facts = buildManifestFacts(document.root!);
		expect(facts.packageName).toBe("com.example.triage");
		expect(facts.versionName).toBe("2.0");
		expect(facts.versionCode).toBe(20);
		expect(facts.minSdk).toBe(21);
		expect(facts.debuggable).toBe(true);
		expect(facts.allowBackup).toBe(true);
		expect(facts.usesCleartextTraffic).toBe(true);
		expect(facts.permissions).toEqual(["android.permission.CAMERA", "android.permission.READ_SMS"]);
		expect(facts.components).toHaveLength(3);
		const activity = facts.components.find(component => component.type === "activity");
		expect(activity?.exported).toBe(true);
		expect(activity?.actions).toEqual(["android.intent.action.MAIN"]);
		const provider = facts.components.find(component => component.type === "provider");
		expect(provider?.authorities).toEqual(["com.example.triage.data"]);
	});
});

describe("signature facts", () => {
	it("detects v1 signing from META-INF", () => {
		const archive = buildApk();
		const facts = readSignatureFacts(archive, readZipIndex(archive));
		expect(facts.v1).toBe(true);
		expect(facts.v2).toBe(false);
		expect(facts.schemes).toEqual(["v1"]);
	});

	it("reports no signature for an unsigned package", () => {
		const archive = buildApk({ withSignature: false });
		expect(readSignatureFacts(archive, readZipIndex(archive)).schemes).toEqual([]);
	});
});

describe("dex", () => {
	it("reads the version, counts and string pool", () => {
		const facts = parseDex(buildDex(["alpha", "beta"], { typeIds: 12, methodIds: 34, classDefs: 5 }));
		expect(facts.version).toBe("035");
		expect(facts.stringCount).toBe(2);
		expect(facts.strings).toEqual(["alpha", "beta"]);
		expect(facts.typeCount).toBe(12);
		expect(facts.methodCount).toBe(34);
		expect(facts.classCount).toBe(5);
	});
});

/** 夹具里的清单是 stored，测试内同步取出即可，不必等待 inflate。 */
function readStoredEntry(archive: Uint8Array, entry: { localHeaderOffset: number; compressedSize: number }): Uint8Array {
	const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
	const nameLength = view.getUint16(entry.localHeaderOffset + 26, true);
	const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
	const start = entry.localHeaderOffset + 30 + nameLength + extraLength;
	return archive.subarray(start, start + entry.compressedSize);
}
