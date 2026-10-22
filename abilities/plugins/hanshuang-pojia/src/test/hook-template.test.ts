import { describe, expect, it } from "vitest";
import {
	buildHookScript,
	hookRunHint,
	hookTarget,
	hookTargetsFromHits,
	MAX_TARGETS,
} from "../domain/android/hook-template";
import type { DexSearchHit } from "../domain/android/dex-index";

function methodHit(name: string, owner: string): DexSearchHit {
	return { kind: "method", value: name, owner };
}

describe("hook targets", () => {
	it("parses a method signature into class, name, returns and params", () => {
		const target = hookTarget("com.example.PremiumGate", "boolean checkLicense(java.lang.String)");
		expect(target).toEqual({
			className: "com.example.PremiumGate",
			methodName: "checkLicense",
			returns: "boolean",
			params: "java.lang.String",
		});
	});

	it("treats an empty parameter list as no parameters", () => {
		const target = hookTarget("com.example.Gate", "void isVip()");
		expect(target?.params).toBe("");
	});

	it("rejects a description that is not a method signature", () => {
		expect(hookTarget("com.example.Gate", "com.example.Gate")).toBeNull();
	});

	it("dedupes repeated hits and caps the target list", () => {
		const hits = [methodHit("boolean checkLicense()", "com.example.Gate"), methodHit("boolean checkLicense()", "com.example.Gate")];
		expect(hookTargetsFromHits(hits).targets).toHaveLength(1);

		const many = Array.from({ length: MAX_TARGETS + 4 }, (_, index) => methodHit(`void m${index}()`, "com.example.Gate"));
		expect(hookTargetsFromHits(many).targets).toHaveLength(MAX_TARGETS);
	});
});

describe("hook script", () => {
	const targets = hookTargetsFromHits([
		methodHit("boolean checkLicense(java.lang.String)", "com.example.PremiumGate"),
		methodHit("void isVip()", "com.example.PremiumGate"),
	]).targets;

	const script = buildHookScript(targets, ["com.example.PremiumGate"], { source: "app.apk", query: "license", backtrace: true });

	it("hooks with Java.perform and the dotted class name", () => {
		expect(script).toContain("Java.perform");
		expect(script).toContain('Java.use("com.example.PremiumGate")');
	});

	it("prints arguments and keeps the original return value", () => {
		expect(script).toContain("console.log");
		expect(script).toContain("original0.apply(this, arguments)");
		expect(script).toContain("return result;");
	});

	it("never rewrites the result or forces a bypass", () => {
		// 这是整个模板的合规底线：观测，不改写。
		for (const banned of ["return true", "return 1;", "return \"", "Java.choose", "setReturnValueForce"]) {
			expect(script).not.toContain(banned);
		}
		expect(script).toContain("OBSERVATION ONLY");
	});

	it("includes a Java backtrace only when asked", () => {
		// 方法是 Java 层，Java 栈比原生栈有用；默认不打印，因为它是每个调用的固定开销。
		expect(script).toContain("getStackTraceString");
		const quiet = buildHookScript(targets, ["com.example.PremiumGate"], { source: "app.apk", query: "license" });
		expect(quiet).not.toContain("getStackTraceString");
	});

	it("enumerates declared methods when the query matched no method", () => {
		const fallback = buildHookScript([], ["com.example.PremiumGate"], { source: "app.apk", query: "premium" });
		expect(fallback).toContain("getDeclaredMethods");
		expect(fallback).toContain("No method matched");
	});

	it("states the run command with the package override", () => {
		expect(hookRunHint("com.example.app")).toContain("frida -U -f com.example.app");
		expect(hookRunHint(null)).toContain("frida -U -f <package-name>");
	});
});
