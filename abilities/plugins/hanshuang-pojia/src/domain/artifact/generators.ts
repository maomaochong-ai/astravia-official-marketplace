/**
 * `generate_artifact` 的脚手架生成器。
 *
 * 每个 kind 产出**可运行的骨架源码**，落在调用方定位到的判定点之上，交由
 * `SKILL.md` 的交付形状（Locate → Patch table → Runnable artefact → Verification →
 * Rollback）执行。它们是最小化骨架：操作者在验证流程里接着改，不是把若干样本的
 * 判定点批量拼装成的通用制品。
 */

export const ARTIFACT_KINDS = ["patch", "keygen", "proxy-dll", "verify"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** 语言选择：keygen / proxy-dll 需要；patch / verify 与语言弱相关仍可取其头信息。 */
export const ARTIFACT_LANGS = ["python", "c", "js"] as const;
export type ArtifactLang = (typeof ARTIFACT_LANGS)[number];

export interface ArtifactRequest {
	kind: ArtifactKind;
	lang?: ArtifactLang;
	/** 样本显示名，用于文件头 / 注释。 */
	target?: string;
	/** 定位点：到达判定点的命令 / 偏移 / 符号，来自 SKILL.md 的 Locate 段。 */
	locate?: string;
	/** patch kind：`address | original | patched` 三列提示。 */
	siteLines?: string[];
	/** keygen kind：期望产出的测试向量，`输入 => 期望键` 逐行。 */
	testVectors?: string[];
}

function langFor(req: ArtifactRequest): ArtifactLang {
	if (req.lang === "c" || req.lang === "js") return req.lang;
	return "python";
}


function escComment(text: string, lang: ArtifactLang): string {
	const prefix = lang === "python" ? "#" : lang === "js" ? "//" : "//";
	return text
		.trim()
		.split("\n")
		.map(line => `${prefix} ${line}`.trimEnd())
		.join("\n");
}

function fence(lang: ArtifactLang): string {
	return lang === "python" ? "```python" : lang === "js" ? "```js" : "```c";
}

/* ------------------------------------------------------------------ */
/* patch —— 最小二字节补丁骨架，带 patch table 与四件套验证             */
/* ------------------------------------------------------------------ */

function renderPatch(req: ArtifactRequest): string {
	const lang = langFor(req);
	const sites = (req.siteLines ?? ["TODO | XX 00 | YY 00 | 跳过授权对比分支"]).slice(0, 12);
	const table = sites.map(s => `| ${s.split("|").map(c => c.trim()).join(" | ")} |`).join("\n");
	const head = escComment(
		[
			`${ARTIFACT.banner(req)}`,
			"补丁骨架：定位到授权判定点后，把原始字节换成使分支走通过路径的最小改写。",
			"执行顺序：Copy-first → 改副本 → 同输入重放（BASELINE/VALIDATED/ROLLBACK 三腿）→ 哈希复原。",
		].join("\n"),
		lang,
	);

	const body =
		lang === "python"
			? [
					"import hashlib, shutil, sys",
					"",
					"SRC = sys.argv[1] if len(sys.argv) > 1 else 'sample.bin'",
					"COPY = SRC + '.patched'",
					"",
					"def sha(path):",
					"    h = hashlib.sha256()",
					"    with open(path, 'rb') as f:",
					"        for chunk in iter(lambda: f.read(65536), b''):",
					"            h.update(chunk)",
					"    return h.hexdigest()",
					"",
					"# ---- 定位点（先跑 Locate，别猜偏移）----",
					"# TODO",
					"PATCHES = [",
					"    # (file_offset, b'\\xXX', b'\\xYY')   -- 从 Locate 复现得到，不要手工估算",
					"]",
					"",
					"orig_hash = sha(SRC)",
					"shutil.copyfile(SRC, COPY)   # Copy-first：绝不动原样",
					"with open(COPY, 'r+b') as f:",
					"    for off, old, new in PATCHES:",
					"        f.seek(off)",
					"        cur = f.read(len(old))",
					"        assert cur == old, f'@0x{off:x} 期望 {old.hex()} 实得 {cur.hex()}'",
					"        f.seek(off); f.write(new)",
					"print('ORIGINAL sha256 ', orig_hash)",
					"print('MODIFIED sha256 ', sha(COPY))",
					"print('ROLLBACK: 用原样重跑本脚本得到同一 ORIGINAL 哈希恢复')",
				]
			: lang === "js"
				? [
						"const fs = require('fs');",
						"const src = process.argv[2] || 'sample.bin';",
						"const copy = src + '.patched';",
						"",
						"// ---- 定位点（先跑 Locate，别猜偏移）----",
						"// TODO",
						"const PATCHES = []; // [offset, Buffer], 从 Locate 复现得到",
						"",
						"const orig = fs.readFileSync(src); // Copy-first：绝不动原样",
						"const mod = Buffer.from(orig);",
						"for (const [off, bytes] of PATCHES) bytes.copy(mod, off);",
						"fs.writeFileSync(copy, mod);",
						"console.log('ORIGINAL sha256 ', require('crypto').createHash('sha256').update(orig).digest('hex'));",
						"console.log('MODIFIED sha256 ', require('crypto').createHash('sha256').update(mod).digest('hex'));",
					]
				: [
						"#include <stdio.h>",
						"#include <stdint.h>",
						"#include <string.h>",
						"#include <stdlib.h>",
						"",
						"// ---- 定位点（先跑 Locate，别猜偏移）----",
						"// TODO",
						"// 结构: { uint32_t off; uint8_t orig; uint8_t patch; }",
						"static const struct { uint32_t off; uint8_t orig, patch; } PATCHES[] = {};",
						"",
						"int main(int argc, char **argv) {",
						"    if (argc < 2) return 2;",
						"    FILE *f = fopen(argv[1], \"r+b\"); if (!f) return 3;",
						"    fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);",
						"    unsigned char *buf = malloc(n); if (!buf) return 4;",
						"    if (fread(buf, 1, n, f) != (size_t)n) return 5;",
						"    for (unsigned i = 0; i < sizeof(PATCHES)/sizeof(PATCHES[0]); i++) {",
						"        unsigned char *p = buf + PATCHES[i].off;",
						"        if (*p != PATCHES[i].orig) { fprintf(stderr, \"@0x%x mismatch\\n\", PATCHES[i].off); return 6; }",
						"        *p = PATCHES[i].patch;",
						"    }",
						"    rewind(f); fwrite(buf, 1, n, f); fclose(f); free(buf);",
						"    return 0;",
						"}\n",
					];

	return [head, "", "## Patch table", "", table, "", fence(lang), body.join("\n"), "```"].filter(Boolean).join("\n");
}

/* ------------------------------------------------------------------ */
/* keygen —— 授权算法逆向的最小键构造器 + 测试向量                       */
/* ------------------------------------------------------------------ */

function renderKeygen(req: ArtifactRequest): string {
	const lang = langFor(req);
	const vectors = (req.testVectors ?? ["用户名 => 期望键"]).slice(0, 12);
	const vecText = vectors.map(v => `- \`${v.trim()}\``).join("\n");
	const head = escComment(
		[
			`${ARTIFACT.banner(req)}`,
			"keygen 骨架：把授权校验函数读通后，用同样的常数 / 变换逆运算构造合法键。",
			"先验证：同一输入跑 校验函数 与 本构造器，两边应相等（Verification）。",
		].join("\n"),
		lang,
	);

	const body =
		lang === "python"
			? [
					"import hashlib, sys",
					"",
					"# ---- 从校验反推的常量 / 算法（读通判定点后填写）----",
					"ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'",
					"",
					"def checksum(user: str) -> int:",
					"    # TODO: 复现校验函数里的变换，例如 CRC / 多项式 / 查表",
					"    return sum(user.encode()) % len(ALPHABET)",
					"",
					"def keygen(user: str) -> str:",
					"    # TODO: 用 checksum 等推导键格式；键形状以样本为准",
					"    idx = checksum(user)",
					"    return user.upper() + '-' + ALPHABET[idx] * 4",
					"",
					"def main() -> None:",
					"    for line in sys.argv[1:] or [u'DemoUser']:",
					"        print(line, '=>', keygen(line))",
					"",
					"if __name__ == '__main__':",
					"    main()",
					"",
					"# 验证：`python keygen.py Username` 的产物应被样本的校验函数接受；",
					"# 不改校验逻辑本身 —— 先动态 hook 观察真实判决，再静态最小补丁。",
				]
			: lang === "js"
				? [
						"// keygen 骨架：读通判定点后用同样常数逆运算构造合法键",
						"// TODO: 补校验函数里的变换（CRC / 查表 / 多项式）",
						"const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';",
						"function checksum(user) {",
						"  return [...user].reduce((a, c) => a + c.charCodeAt(0), 0) % ALPHABET.length;",
						"}",
						"function keygen(user) {",
						"  return user.toUpperCase() + '-' + ALPHABET[checksum(user)].repeat(4);",
						"}",
						"process.argv.slice(2).concat(['DemoUser']).forEach(u => console.log(u, '=>', keygen(u)));",
					]
				: [
						"// keygen 骨架（C）：读通判定点后用同样常数逆运算构造合法键",
						"// TODO: 补校验函数里的变换（CRC / 查表 / 多项式）",
						"#include <stdio.h>",
						"#include <string.h>",
						"#include <ctype.h>",
						"static unsigned checksum(const char *u) {",
						"    unsigned s = 0; for (; *u; u++) s += (unsigned char)*u; return s;",
						"}",
						"static void keygen(const char *u) {",
						"    printf(\"%s-XXXX\\n\", u); /* TODO: 由 checksum 推导键段 */",
						"}",
						"int main(int argc, char **argv) {",
						"    const char *u = argc > 1 ? argv[1] : \"DemoUser\";",
						"    keygen(u);",
						"    return 0;",
						"}\n",
					];

	return [head, "", "## 测试向量", "", vecText, "", fence(lang), body.join("\n"), "```"].filter(Boolean).join("\n");
}

/* ------------------------------------------------------------------ */
/* proxy-dll —— 占位 / 转发脚手架：符号与转发目标列在头，不预写导入      */
/* ------------------------------------------------------------------ */

function renderProxyDll(req: ArtifactRequest): string {
	const lang = langFor(req);
	const head = escComment(
		[
			`${ARTIFACT.banner(req)}`,
			"proxy-DLL 脚手架：原 DLL 导出一一对应转发，插桩点留在每个转发函数上。",
			"提醒：先做符号枚举（本插件 list_code_symbols），把真实导出表填进来；",
			"脚手架只给转发骨架，不预写目标者私有地址。",
		].join("\n"),
		lang,
	);

	const body =
		lang === "python"
			? [
					"# 仅当目标 DLL 有可脚本化的宿主时才用 Python 转发射桩；",
					"# 多数 PE 目标走 C 转发（见下方 /* c */ 注释里已生成的那份）。",
					"raise NotImplementedError('用 c 语言形态：原样导出 + 转发骨架')",
				]
			: lang === "js"
				? ["// DLL 转发通常在 C/C++；JS 形态留给你在脚本宿主（例如 Frida）里做 hook 转发。",
					"// 见 c 形态的导出转发骨架。"]
				: [
						"// proxy-DLL 脚手架（C / MinGW）：原样转发 + 插桩点",
						"// 1) 用 list_code_symbols 枚举原 DLL 导出表",
						"// 2) 逐导出加 __declspec(dllexport) 转发函数，体内只转发 + 打点",
						"__declspec(dllexport) void __stdcall Original_Export(void) {",
						"    /* TODO: 转发到目标（对侧 DLL 的真实导出）；打点在转发前后 */",
						"    /* 原样转发调用目标导出即可，插件在这里只给骨架不填私有地址 */",
						"}",
						"",
						"/* 构建: x86_64-w64-mingw32-gcc -shared -o proxy.dll proxy.c -l<target> */",
					];

	return [head, "", fence(lang), body.join("\n"), "```"].filter(Boolean).join("\n");
}

/* ------------------------------------------------------------------ */
/* verify —— 验证 harness：同输入在 原样/补丁 两侧重放，比对           */
/* ------------------------------------------------------------------ */

function renderVerify(req: ArtifactRequest): string {
	const lang = langFor(req);
	const head = escComment(
		[
			`${ARTIFACT.banner(req)}`,
			"验证 harness：同一输入在 原裁剪 与 补丁后 两侧各跑一次，比对输出与退出码。",
			"这是四件套的 VERIFICATION 腿 —— 结论以真实重放为准，不是静态乐观。",
		].join("\n"),
		lang,
	);

	const body =
		lang === "python"
			? [
					"import subprocess, sys",
					"",
					"ORIG = sys.argv[1] if len(sys.argv) > 1 else './orig'",
					"MOD  = sys.argv[2] if len(sys.argv) > 2 else './patched'",
					"INPUT = ['test-input']",
					"",
					"def run(cmd):",
					"    p = subprocess.run([cmd, *INPUT], capture_output=True)",
					"    return p.returncode, p.stdout, p.stderr",
					"",
					"orig = run(ORIG); mod = run(MOD)",
					"print('BASELINE  ', orig[0], orig[1], orig[2])",
					"print('MODIFIED  ', mod[0], mod[1], mod[2])",
					"print('VERDICT   ', 'pass' if orig != mod else 'same-output (no effect)')",
					"# ROLLBACK：用原样重跑 ORIG 得到同一 BASELINE 即复原。",
				]
			: lang === "js"
				? [
						"const { execFileSync } = require('child_process');",
						"const [orig, mod] = [process.argv[2] || './orig', process.argv[3] || './patched'];",
						"const input = ['test-input'];",
						"const run = c => execFileSync(c, input, { stdio: 'pipe' });",
						"try { const b = run(orig), m = run(mod);",
						"  console.log('BASELINE', b.toString());",
						"  console.log('MODIFIED', m.toString());",
						"  console.log('VERDICT:', b.equals(m) ? 'same-output (no effect)' : 'pass');",
						"} catch (e) { console.error('run failed', e.message); }",
					]
				: [
						"// 验证 harness（C 形态通常走 shell 重放，这里是脚本角色）",
						"#include <stdio.h>",
						"#include <stdlib.h>",
						"int main(int argc, char **argv) {",
						"    // 用同一输入分别跑 argv[1]（原样）与 argv[2]（补丁后），比对退出码",
						"    if (argc < 3) return 2;",
						"    int a = system(argv[1]); /* 手动把 stdin 指向同一个 input.txt */",
						"    int b = system(argv[2]);",
						"    printf(\"BASELINE=%d MODIFIED=%d\\n\", a, b);",
						"    return (a == b) ? 1 : 0; /* 0 = 行为变化（预期），非本意时需复核补丁 */",
						"}\n",
					];

	return [head, "", fence(lang), body.join("\n"), "```"].filter(Boolean).join("\n");
}

/** 统一 banner：把定位点写进骨架头，确保五件套可追溯。 */
const ARTIFACT = {
	banner(req: ArtifactRequest): string {
		const t = (req.target ?? "sample").trim() || "sample";
		const l = (req.locate ?? "").trim();
		return `generate_artifact · kind=${req.kind} · target=${t} · locate=${l || "TODO(未给定)"}`;
	},
};

const RENDERERS: Record<ArtifactKind, (req: ArtifactRequest) => string> = {
	patch: renderPatch,
	keygen: renderKeygen,
	"proxy-dll": renderProxyDll,
	verify: renderVerify,
};

export function generateArtifact(req: ArtifactRequest): string {
	return RENDERERS[req.kind](req);
}