/**
 * Assessment report: the four-section write-up that the kit's
 * `seep_gen_security_report` rendered from seven parameters.
 *
 * Two deliberate differences from the kit's version:
 *
 * 1. Nothing is invented. The kit filled an empty `description` / `poc_summary`
 *    with a confident paragraph asserting a CWE-602 client-side-trust defect and
 *    printed a sample `TEST EAX,EAX / JZ` branch that came from nowhere. A default
 *    that states a finding you never observed is worse than a blank, so an
 *    unsupplied section renders an explicit "not supplied" line instead.
 * 2. No `patches/` reference. The kit's PoC paragraph pointed at a patches
 *    directory; this plugin produces evidence and write-ups, never patched builds.
 *
 * Rendering is pure: the date is passed in, so the report is reproducible.
 */

export type AssessmentLanguage = "zh" | "en";

export interface AssessmentRequest {
	/** Target asset name; also the report file stem. */
	target: string;
	vulnType?: string;
	branchLocation?: string;
	description?: string;
	pocSummary?: string;
	defense?: string;
	language: AssessmentLanguage;
	/** `YYYY-MM-DD`, supplied by the caller. */
	date: string;
}

export interface Assessment {
	fileName: string;
	content: string;
	/** Sections that fell back to the "not supplied" line, for the reply. */
	emptySections: string[];
}

const DEFAULT_VULN_TYPE: Record<AssessmentLanguage, string> = {
	zh: "未分类 —— 由评估人按实际观察补充",
	en: "Unclassified — the assessor fills this in from what was observed",
};

const NOT_SUPPLIED: Record<AssessmentLanguage, string> = {
	zh: "_未提供 —— 本报告不虚构未观察到的结论。请补全后重新生成。_",
	en: "_Not supplied — this report does not invent conclusions that were not observed. Fill it in and regenerate._",
};

const NO_DEFENSE: Record<AssessmentLanguage, string> = {
	zh: [
		"_未提供 —— 下面只是通用的纵深防御方向，不是针对本例的结论。_",
		"",
		"- 把安全决策放回服务端：客户端只做渲染，受限能力由服务端签发带时效的凭据。",
		"- 需要离线授权时用非对称签名：客户端只持公钥验签，私钥留在授权服务器。",
		"- 关键模块做完整性校验（代码段哈希 / 签名校验），让本地改动可被检出。",
	].join("\n"),
	en: [
		"_Not supplied — the items below are generic defence-in-depth directions, not a finding about this sample._",
		"",
		"- Move the security decision to the server: the client renders, the server issues a time-bound grant for restricted capability.",
		"- When offline authorisation is required, use asymmetric signatures: the client verifies with a public key, the private key stays on the licence server.",
		"- Add integrity checks to the sensitive modules (code-segment hash / signature verification) so local modification is detectable.",
	].join("\n"),
};

export const REPORT_FILE_SUFFIX = "_security_assessment_report.md";

/** File stem for one target: separators never survive, so it can never be a path. */
export function assessmentFileName(target: string): string {
	// Dots stay readable (`demo.apk_...`) but separators never survive, so the result is a bare file name.
	const stem = target
		.trim()
		.slice(0, 80)
		.replace(/[^\p{L}\p{N}._-]/gu, "_")
		.replace(/_+/g, "_")
		.replace(/^[._-]+|[._-]+$/g, "");
	if (!stem) throw new Error("target is empty after sanitising; use letters, digits, dashes or underscores");
	return `${stem}${REPORT_FILE_SUFFIX}`;
}

function section(value: string | undefined, fallback: string): { text: string; empty: boolean } {
	const trimmed = (value ?? "").trim();
	return trimmed.length > 0 ? { text: trimmed, empty: false } : { text: fallback, empty: true };
}

export function renderAssessment(request: AssessmentRequest): Assessment {
	const lang = request.language === "zh" ? "zh" : "en";
	const emptySections: string[] = [];

	const vulnType = (request.vulnType ?? "").trim() || DEFAULT_VULN_TYPE[lang];
	const summary = section(request.description, NOT_SUPPLIED[lang]);
	const evidence = section(request.pocSummary, NOT_SUPPLIED[lang]);
	const defense = section(request.defense, NO_DEFENSE[lang]);
	const location = (request.branchLocation ?? "").trim();

	const labels =
		lang === "zh"
			? {
					title: "# 软件安全评估与脆弱性走查报告",
					asset: "目标资产",
					kind: "评估类型",
					vuln: "缺陷分类",
					date: "评估时间",
					owner: "报告归属",
					s1: "## 1. 风险概述与脆弱性成因",
					s2: "## 2. 关键判定决策位点",
					s3: "## 3. 验证与复现证据",
					s4: "## 4. 纵深防护与加固建议",
					locNone: "_未提供 —— 需要给出函数名 / 偏移 / 符号，不接受占位地址。_",
					locLine: "判定函数 / 偏移位点",
					footer: [
						"---",
						"",
						"本报告由 hanshuang-pojia 插件按评估人提供的素材排版生成：插件只做只读分析与文档整理，",
						"不生成补丁、不重签、不绕过授权校验。第三方证据（反编译输出、反汇编、字符串转储）应保存在",
						"`exports/` 并在第 3 节引用文件名。",
					].join("\n"),
					kindValue: "白盒代码走查 / 客户端决策逻辑安全性验证",
				}
			: {
					title: "# Software security assessment — authorisation weakness review",
					asset: "Target asset",
					kind: "Assessment type",
					vuln: "Defect class",
					date: "Assessment date",
					owner: "Report location",
					s1: "## 1. Summary and root cause",
					s2: "## 2. Decision point",
					s3: "## 3. Verification evidence",
					s4: "## 4. Defence in depth and remediation",
					locNone: "_Not supplied — give the function name / offset / symbol; placeholder addresses are not accepted._",
					locLine: "Function / offset",
					footer: [
						"---",
						"",
						"This report was typeset by the hanshuang-pojia plugin from material the assessor supplied. It assembles",
						"the document from that material; patches, re-signed builds and runtime dumps produced alongside it belong",
						"in `exports/` and are cited by file name. Third-party evidence (decompiler output, disassembly, string dumps) belongs in",
						"`exports/`; cite the file names in section 3.",
					].join("\n"),
					kindValue: "White-box code review / client-side decision-logic safety verification",
				};

	if (summary.empty) emptySections.push(labels.s1);
	if (!location) emptySections.push(labels.s2);
	if (evidence.empty) emptySections.push(labels.s3);
	if (defense.empty) emptySections.push(labels.s4);

	const lines = [
		labels.title,
		"",
		`- **${labels.asset}**: \`${request.target.trim()}\``,
		`- **${labels.kind}**: ${labels.kindValue}`,
		`- **${labels.vuln}**: \`${vulnType}\``,
		`- **${labels.date}**: ${request.date}`,
		`- **${labels.owner}**: \`reports/${assessmentFileName(request.target)}\``,
		"",
		"---",
		"",
		labels.s1,
		"",
		summary.text,
		"",
		"---",
		"",
		labels.s2,
		"",
		location
			? `- **${labels.locLine}**: \`${location}\`\n- ${lang === "zh" ? "证据出处：见第 3 节与 `exports/` 下同名记录。" : "Where it came from: section 3 and the matching file under `exports/`."}`
			: labels.locNone,
		"",
		"---",
		"",
		labels.s3,
		"",
		evidence.text,
		"",
		"---",
		"",
		labels.s4,
		"",
		defense.text,
		"",
		labels.footer,
		"",
	];

	return { fileName: assessmentFileName(request.target), content: lines.join("\n"), emptySections };
}
