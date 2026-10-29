import { describe, expect, it } from "vitest";
import {
	buildHookScript,
	hookRunHint,
	hookTarget,
	hookTargetsFromHits,
	MAX_TARGETS,
} from "../../domain/android/hook-template";
import type { DexSearchHit } from "../../domain/android/dex-index";

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

	it("keeps the default observation script free of rewrites", () => {
		// 默认档的底线：只观测。改写要显式选 override / replace 并给 return_value。
		for (const banned of ["return true", "return 1;", 'return "', "Java.choose", "setReturnValueForce"]) {
			expect(script).not.toContain(banned);
		}
		expect(script).toContain("OBSERVATION ONLY");
	});

	it("runs the original and replaces its result in override mode", () => {
		const overridden = buildHookScript(targets, [], { source: "app.apk", query: "license", mode: "override", returnValue: "true" });
		expect(overridden).toContain("overload.implementation");
		// 原方法仍被调用：override 是「跑完再改」，不是短路。
		expect(overridden).toContain("original0.apply(this, arguments)");
		expect(overridden).toContain("return true;");
		expect(overridden).toContain("// OVERRIDE:");
		expect(overridden).not.toContain("OBSERVATION ONLY");
		// 改写前后都记录，否则一次 run 看不出改了什么。
		expect(overridden).toContain('event: "override"');
	});

	it("skips the original entirely in replace mode", () => {
		const replaced = buildHookScript(targets, [], { source: "app.apk", query: "license", mode: "replace", returnValue: 'Java.use("java.lang.Boolean").TRUE' });
		expect(replaced).toContain("// REPLACE:");
		expect(replaced).not.toContain("original0.apply(this, arguments)");
		expect(replaced).toContain('return Java.use("java.lang.Boolean").TRUE;');
	});

	it("refuses a return_value that would break the generated script", () => {
		const build = (returnValue: string): string => buildHookScript(targets, [], { mode: "override", returnValue });
		// 缺表达式：空串与只带空白都不行，否则会生成 `return ;`。
		expect(() => buildHookScript(targets, [], { mode: "override" })).toThrow("return_value is required");
		expect(() => buildHookScript(targets, [], { mode: "replace", returnValue: "   " })).toThrow("return_value is required");
		// 多行 / 分号 / 注释会把单条 return 变成一段代码，任一处越界就拒绝。
		expect(() => build("true;\nlog({})")).toThrow("single expression");
		expect(() => build("1; 2")).toThrow("single expression");
		expect(() => build("true // always")).toThrow("must not contain comments");
		expect(() => build("(1")).toThrow("unbalanced brackets");
		expect(() => build("a".repeat(201))).toThrow("keep it under");
		// observe 忽略 return_value，不让它影响默认档。
		expect(buildHookScript(targets, [], { mode: "observe", returnValue: "true" })).not.toContain("return true;");
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
