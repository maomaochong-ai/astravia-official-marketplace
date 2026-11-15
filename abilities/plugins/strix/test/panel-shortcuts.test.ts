import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The panel answers its own keys.
 *
 * Registered scopes (not a `document` listener, ADR strix-0004) and declared with the
 * permission the host gates them on. Without `ui.shortcuts.register` the registration
 * throws, which is why the assertion checks the manifest too rather than only the code.
 */
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "plugin.json"), "utf8")) as {
	permissions?: string[];
};
const index = readFileSync(resolve(process.cwd(), "src/index.tsx"), "utf8");

describe("panel shortcuts", () => {
	it("declares the permission the host gates shortcut scopes on", () => {
		expect(pkg.permissions).toContain("ui.shortcuts.register");
	});

	it("registers through the host's stack, not a document listener", () => {
		expect(index).toContain("registerShortcutScope({");
		expect(index).not.toContain("document.addEventListener(\"keydown\"");
	});

	it("keeps the bindings usable while the composer has focus", () => {
		// The composer is a textarea: a scope without explicit `when` would be skipped
		// inside editable targets, which is "shortcuts do nothing" for this panel.
		const scope = index.slice(index.indexOf("registerShortcutScope({"));
		expect(scope).toContain('when: "always"');
		expect(scope).toContain('key: "escape"');
		expect(scope).toContain('key: "mod+k"');
	});
});
