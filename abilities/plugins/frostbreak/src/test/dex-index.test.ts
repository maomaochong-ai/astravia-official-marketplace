import { describe, expect, it } from "vitest";
import { describeDescriptor, dexStrings, indexDex, searchDex } from "../domain/android/dex-index";
import { buildDex, buildDexWithClasses } from "./fixtures";

describe("dex descriptor rendering", () => {
	it("pretty-prints primitives, arrays and class descriptors", () => {
		expect(describeDescriptor("V")).toBe("void");
		expect(describeDescriptor("I")).toBe("int");
		expect(describeDescriptor("[B")).toBe("byte[]");
		expect(describeDescriptor("[[Ljava/lang/String;")).toBe("java.lang.String[][]");
		expect(describeDescriptor("Lcom/example/Gate;")).toBe("com.example.Gate");
	});
});

describe("dex index", () => {
	it("indexes classes, their superclass and declared methods", () => {
		const index = indexDex(buildDexWithClasses());
		expect(index.classCount).toBe(1);
		expect(index.classes).toHaveLength(1);
		const entry = index.classes[0]!;
		expect(entry.name).toBe("com.example.PremiumGate");
		expect(entry.superName).toBe("java.lang.Object");
		expect(entry.methods.map(method => method.name)).toEqual(["checkLicense", "isVip", "onCreate"]);
		expect(entry.methods[2]!.params).toBe("int");
		expect(entry.methods[2]!.returns).toBe("void");
		expect(entry.methods[0]!.access).toBe(0x02);
	});

	it("reads method and string counts from the header", () => {
		const index = indexDex(buildDexWithClasses());
		expect(index.methodCount).toBe(3);
		expect(index.stringCount).toBe(10);
	});

	it("searches classes, method signatures and the string pool", () => {
		const bytes = buildDexWithClasses();
		const index = indexDex(bytes);
		const strings = dexStrings(bytes);
		const any = searchDex(index, strings, "license", "any", 20);
		expect(any.hits.some(hit => hit.kind === "method" && hit.value.includes("checkLicense") && hit.owner === "com.example.PremiumGate")).toBe(true);
		expect(any.hits.some(hit => hit.kind === "string" && hit.value === "license")).toBe(true);

		const classes = searchDex(index, strings, "premiumgate", "class", 20);
		expect(classes.hits).toEqual([{ kind: "class", value: "com.example.PremiumGate", owner: "java.lang.Object" }]);

		const methods = searchDex(index, strings, "vip", "method", 20);
		expect(methods.hits.map(hit => hit.value)).toContain("void isVip()");
	});

	it("honours the hit budget", () => {
		const bytes = buildDexWithClasses();
		const result = searchDex(indexDex(bytes), dexStrings(bytes), "e", "any", 2);
		expect(result.hits).toHaveLength(2);
		expect(result.truncated).toBe(true);
	});

	it("returns nothing for an empty query", () => {
		const bytes = buildDexWithClasses();
		expect(searchDex(indexDex(bytes), dexStrings(bytes), "   ", "any", 10).hits).toEqual([]);
	});

	it("tolerates a DEX whose class_defs_off is zero", () => {
		// 表头声称有 3 个类，但 class_defs_off 为 0：解析器必须给出结构而不是抛错。
		const index = indexDex(buildDex(["Lcom/example/A;"]));
		expect(index.classes).toHaveLength(3);
		expect(index.classes[0]!.methods).toEqual([]);
	});
});
