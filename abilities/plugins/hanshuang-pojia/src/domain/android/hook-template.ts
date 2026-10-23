/**
 * Frida 脚本模板生成，三档，由调用方显式选择。
 *
 * 上游 `seep_apk_gen_hook` 对应三份模板 before / after / replace；这里的档位是：
 *
 * - `observe`（默认）—— 进入打印参数、退出打印返回值，包装体原样返回 `result`；
 * - `override`（= 上游 after）—— 原方法照常执行，返回值由 `return_value` 表达式替换；
 * - `replace`（= 上游 before 的短路）—— 原方法不执行，包装体直接返回 `return_value`。
 *
 * 默认档仍是观测：不给 `return_value` 就永远生成不出改写返回值的脚本。`override` /
 * `replace` 是显式请求，表达式要过 `assertReturnExpression` 的窄校验（单行、无分号、
 * 无注释、括号配平），因为那个串会被原样拼进 JS。
 */

import type { DexSearchHit } from "./dex-index";

export interface HookTarget {
	className: string;
	methodName: string;
	returns: string;
	params: string;
}

/** 三档语义。默认 `observe`，另外两档必须带 `returnValue`。 */
export type HookMode = "observe" | "override" | "replace";

export const HOOK_MODES: readonly HookMode[] = ["observe", "override", "replace"];

/** 表达式上限：够写 `true`、`"pro"`、`0x1`、`String(original0.apply(this, arguments)) + "-x"`，不至于变成代码块。 */
const MAX_EXPRESSION_LENGTH = 200;

export interface HookOptions {
	/** 样本名，只写进注释头。 */
	source?: string;
	/** 触发这份模板的关键字，同样只写进注释头。 */
	query?: string;
	/** 进入时打印 Java 调用栈。 */
	backtrace?: boolean;
	/** 退出时打印返回值。 */
	logReturn?: boolean;
	maxTargets?: number;
	/** 默认 observe；override / replace 需要 `returnValue`。 */
	mode?: HookMode;
	/** override / replace 用它替换返回值；observe 忽略。 */
	returnValue?: string;
}

/**
 * 校验并归一化返回值表达式。
 *
 * 这段串会被直接拼进生成的 JS，所以只允许「单行、无分号、无注释、括号配平」的形态。
 * 不是安全沙箱（用户本来就能写任意脚本），而是不让一次手滑把整份脚本的语法弄坏 ——
 * 语法坏掉的脚本在设备上只会报一句看不懂的 `SyntaxError`。
 */
export function assertReturnExpression(value: string | undefined): string {
	const expression = (value ?? "").trim();
	if (expression === "") throw new Error("return_value is required for mode=override and mode=replace");
	if (expression.length > MAX_EXPRESSION_LENGTH) {
		throw new Error(`return_value is ${expression.length} characters; keep it under ${MAX_EXPRESSION_LENGTH} so it stays one expression`);
	}
	if (/[\r\n;]/.test(expression)) throw new Error("return_value must be a single expression: newlines and semicolons are rejected");
	if (expression.includes("//") || expression.includes("/*")) throw new Error("return_value must not contain comments");
	let depth = 0;
	for (const char of expression) {
		if (char === "(" || char === "[" || char === "{") depth += 1;
		else if (char === ")" || char === "]" || char === "}") depth -= 1;
		if (depth < 0) throw new Error("return_value has unbalanced brackets");
	}
	if (depth !== 0) throw new Error("return_value has unbalanced brackets");
	return expression;
}

/** 一份脚本最多挂多少个目标：再多就不是「看一眼」而是批量插桩了。 */
export const MAX_TARGETS = 12;

/** `void checkLicense(java.lang.String)` → 结构化目标；解析失败返回 null。 */
export function hookTarget(className: string, description: string): HookTarget | null {
	const match = /^(.*?)\s+([\w$<>]+)\((.*)\)$/.exec(description.trim());
	if (!match) return null;
	return { className, methodName: match[2]!, returns: match[1]!.trim(), params: match[3]!.trim() };
}

export function hookTargetsFromHits(hits: readonly DexSearchHit[], maxTargets = MAX_TARGETS): { targets: HookTarget[]; classes: string[] } {
	const targets: HookTarget[] = [];
	const classes: string[] = [];
	for (const hit of hits) {
		if (hit.kind === "class") {
			if (!classes.includes(hit.value)) classes.push(hit.value);
			continue;
		}
		if (hit.kind !== "method" || !hit.owner) continue;
		const parsed = hookTarget(hit.owner, hit.value);
		if (!parsed) continue;
		if (targets.some(target => target.className === parsed.className && target.methodName === parsed.methodName)) continue;
		if (targets.length >= maxTargets) break;
		targets.push(parsed);
	}
	return { targets, classes };
}

function js(value: string): string {
	return JSON.stringify(value);
}

function methodBinder(target: HookTarget, index: number, options: HookOptions): string[] {
	const mode = options.mode ?? "observe";
	const { logReturn = true, backtrace = false } = options;
	const expression = mode === "observe" ? "" : assertReturnExpression(options.returnValue);
	const tag = `${target.className}.${target.methodName}`;
	const lines: string[] = [];
	lines.push(`  var method${index} = ${js(target.methodName)};`);
	lines.push(`  var overloads${index} = Target${index}[method${index}].overloads;`);
	lines.push(`  overloads${index}.forEach(function (overload, position) {`);
	lines.push(`    var original${index} = overload;`);
	lines.push(`    overload.implementation = function () {`);
	lines.push(`      var args = [];`);
	lines.push(`      for (var index = 0; index < arguments.length; index += 1) {`);
	lines.push(`        try { args.push(String(arguments[index])); } catch (error) { args.push("<unprintable>"); }`);
	lines.push(`      }`);
	lines.push(`      log({ event: "enter", method: ${js(tag)}, overload: position, args: args });`);
	if (backtrace) {
		lines.push(`      try {`);
		lines.push(`        log({ event: "backtrace", method: ${js(tag)}, stack: Log.getStackTraceString(Exception.$new()) });`);
		lines.push(`      } catch (error) { log({ event: "backtrace-failed", method: ${js(tag)}, error: String(error) }); }`);
	}
	if (mode === "replace") {
		lines.push(`      log({ event: "replace", method: ${js(tag)}, value: ${js(expression)} });`);
		lines.push(`      return ${expression};`);
		lines.push(`    };`);
		lines.push(`  });`);
		return lines;
	}
	lines.push(`      var result = original${index}.apply(this, arguments);`);
	if (logReturn) {
		lines.push(`      if (${target.returns === "void" ? "false" : "true"}) {`);
		lines.push(`        try { log({ event: "exit", method: ${js(tag)}, result: String(result) }); }`);
		lines.push(`        catch (error) { log({ event: "exit", method: ${js(tag)}, result: "<unprintable>" }); }`);
		lines.push(`      }`);
	}
	if (mode === "override") {
		lines.push(`      log({ event: "override", method: ${js(tag)}, from: String(result), to: ${js(expression)} });`);
		lines.push(`      return ${expression};`);
	} else {
		lines.push(`      return result;`);
	}
	lines.push(`    };`);
	lines.push(`  });`);
	return lines;
}

const MODE_HEADER: Record<HookMode, readonly string[]> = {
	observe: [
		"// OBSERVATION ONLY: each wrapper prints what it sees and returns the original result.",
		"// It does not alter arguments, return values or control flow.",
	],
	override: [
		"// OVERRIDE: the original method runs, then each wrapper returns the `return_value` expression.",
		"// The real result is logged next to the replacement, so the delta shows up in the same run.",
	],
	replace: [
		"// REPLACE: the original method does not run; each wrapper returns the `return_value` expression.",
		"// Use it when calling the original would re-enter the check you are replacing.",
	],
};

/**
 * 生成整份脚本。`targets` 为空但有 `classes` 时会退化成「列出这些类声明了哪些方法」，
 * 因为「搜到类但没搜到方法」在混淆后的 APK 上很常见，直接报空模板没有帮助。
 */
export function buildHookScript(targets: readonly HookTarget[], classes: readonly string[], options: HookOptions = {}): string {
	const mode = options.mode ?? "observe";
	// 缺表达式在入口就炸，别等 methodBinder 在深层抛出半份脚本。
	if (mode !== "observe") assertReturnExpression(options.returnValue);
	const maxTargets = Math.max(1, Math.min(MAX_TARGETS, options.maxTargets ?? MAX_TARGETS));
	const picked = targets.slice(0, maxTargets);
	const pickedClasses = classes.slice(0, maxTargets);
	const methodTargets = picked.length > 0 ? picked : [];
	const classTargets = methodTargets.length > 0 ? [] : pickedClasses;

	const lines: string[] = [
		`// Frida ${mode} script generated by hanshuang-pojia (generate_hook).`,
		`// source: ${options.source ?? "(unspecified)"}${options.query ? ` · query: ${options.query}` : ""}`,
		...MODE_HEADER[mode],
		"",
		"Java.perform(function () {",
		"  var Log = Java.use(\"android.util.Log\");",
		"  var Exception = Java.use(\"java.lang.Exception\");",
		"",
		"  function log(payload) {",
		"    try { send(payload); } catch (error) { console.log(JSON.stringify(payload)); }",
		"  }",
		"",
	];

	if (methodTargets.length > 0) {
		methodTargets.forEach((target, index) => {
			lines.push(`  // ${target.className}.${target.methodName} — ${target.returns} (${target.params || "no arguments"})`);
			lines.push(`  var Target${index} = Java.use(${js(target.className)});`);
			lines.push(...methodBinder(target, index, options));
			lines.push("");
		});
	} else if (classTargets.length > 0) {
		lines.push("  // No method matched the query; list what these classes declare so the next run can target one.");
		classTargets.forEach((name, index) => {
			lines.push(`  var Class${index} = Java.use(${js(name)});`);
			lines.push(`  Class${index}.class.getDeclaredMethods().forEach(function (method) {`);
			lines.push(`    log({ event: "declare", className: ${js(name)}, method: String(method) });`);
			lines.push(`  });`);
			lines.push("");
		});
	} else {
		lines.push("  // Nothing to hook: the query matched neither a class nor a method.");
		lines.push(`  log({ event: "empty", query: ${js(options.query ?? "")} });`);
	}

	lines.push("});");
	lines.push("");
	return lines.join("\n");
}

/** 脚本跑起来时需要用户自己补的命令行提示，写进工具输出而不是脚本里。 */
export function hookRunHint(packageName: string | null): string {
	const target = packageName ?? "<package-name>";
	return [
		`Run it with: frida -U -f ${target} -l hook.js --no-pause`,
		"Attach to a running app instead with: frida -U <process> -l hook.js",
		"Output goes through `send()`, so keep the frida console attached; `--no-pause` keeps the app past the spawn pause.",
	].join("\n");
}
