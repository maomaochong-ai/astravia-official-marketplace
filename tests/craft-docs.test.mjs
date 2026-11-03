/**
 * Every craft plugin carries the same family decisions under its own name.
 *
 * There is no shared `docs/adr/craft/` directory any more: a family decision lives
 * next to the app it governs, and each of the sixteen copies is byte-identical. That
 * only holds if drift is visible, so this test fails the moment one plugin's copy
 * differs, or a copy goes missing, or the old shared directory comes back.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ADR_ROOT = new URL("../docs/adr/", import.meta.url).pathname;
const APPS = ["designcraft", "photocraft", "artcraft", "effectcraft", "filmcraft", "lightcraft", "pdfcraft",
	"vectorcraft", "cadcraft", "deckcraft", "figcraft", "gridcraft", "wordcraft", "texturecraft",
	"materialcraft", "craft-anything"];
const REFERENCE = "designcraft";

/** Family documents every craft app keeps its own copy of. */
const FAMILY_DOCS = [
	"craft-0001-seven-copies-and-a-parity-test.md",
	"craft-0002-agent-tools-talk-to-the-running-page.md",
	"craft-0003-first-open-is-a-preparation-not-a-failure.md",
	"craft-0004-inactive-tabs-stop-drawing.md",
	"craft-0005-the-agent-drives-the-canvas.md",
	"craft-0006-the-skill-is-the-doorway.md",
	"craft-0007-chinese-comes-from-the-shell.md",
	"craft-0008-one-container-per-app.md",
	"craft-0009-one-batch-and-a-text-map.md",
	"craft-0010-the-manifest-speaks-the-shell-language.md",
	"craft-0011-the-engine-is-ours.md",
	"craft-0012-chinese-is-rendered-here.md",
	"craft-0013-nothing-runs-in-the-background.md",
	"craft-CONTEXT.md",
];

function sha256(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("every craft app carries every family decision document", () => {
	for (const app of APPS) {
		for (const doc of FAMILY_DOCS) {
			const path = join(ADR_ROOT, app, doc);
			assert.ok(existsSync(path), `${app}/docs/adr/${doc} is missing`);
			assert.ok(readFileSync(path, "utf8").trim().length > 0, `${app}/docs/adr/${doc} is empty`);
		}
	}
});

test("the family documents are byte-identical across the sixteen apps", () => {
	for (const doc of FAMILY_DOCS) {
		const reference = sha256(join(ADR_ROOT, REFERENCE, doc));
		for (const app of APPS) {
			if (app === REFERENCE) continue;
			assert.equal(
				sha256(join(ADR_ROOT, app, doc)),
				reference,
				`${doc} differs between ${REFERENCE} and ${app}`,
			);
		}
	}
});

test("the family documents do not link out of their own app directory", () => {
	// A relative link escaping to ../craft/ or ../othercraft/ would only resolve in one
	// copy; the copies are identical, so such a link is wrong in every copy.
	for (const doc of FAMILY_DOCS) {
		const text = readFileSync(join(ADR_ROOT, REFERENCE, doc), "utf8");
		const targets = [...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
		for (const target of targets) {
			assert.ok(
				!/^\.\.\/(?!\.)/.test(target) || /\.\.\/(designcraft|photocraft|artcraft|effectcraft|filmcraft|lightcraft|pdfcraft|vectorcraft|cadcraft|deckcraft|figcraft|gridcraft|wordcraft|texturecraft|materialcraft|craft-anything)\//.test(target),
				`${doc} links to ${target}, which escapes the app-local copy`,
			);
			assert.ok(!target.includes("adr/craft"), `${doc} still links to the removed docs/adr/craft/`);
		}
	}
});

test("the shared docs/adr/craft/ directory is gone", () => {
	assert.equal(existsSync(join(ADR_ROOT, "craft")), false, "docs/adr/craft/ was restored; family decisions belong in each app's own ADR folder");
});
