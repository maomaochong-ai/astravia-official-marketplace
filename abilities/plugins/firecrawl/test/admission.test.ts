import { describe, expect, it } from "vitest";
import { admitLink } from "../src/domain/crawl/admission";
import type { AdmissionContext } from "../src/domain/crawl/admission";
import { getCrawlScope } from "../src/domain/crawl/scope";

const START = "https://example.com/docs/";

function context(overrides: Partial<AdmissionContext> = {}): AdmissionContext {
	return {
		startUrl: START,
		scope: getCrawlScope(START),
		depth: 1,
		maxDepth: 2,
		includePaths: [],
		excludePaths: [],
		allowExternalLinks: false,
		allowSubdomains: false,
		allowBackwardCrawling: false,
		robots: { isAllowed: () => true },
		ignoreRobotsTxt: false,
		visited: new Set<string>(),
		...overrides,
	};
}

function code(result: ReturnType<typeof admitLink>): string | null {
	return "code" in result ? result.code : null;
}

describe("admitLink", () => {
	it("accepts a normalized in-scope link", () => {
		expect(admitLink("/docs/api/#x", context())).toEqual({ url: "https://example.com/docs/api/" });
	});

	it("reports unparseable input instead of throwing", () => {
		expect(code(admitLink("javascript:void(0)", context()))).toBe("URL_PARSE_ERROR");
	});

	it("refuses other domains before looking at depth", () => {
		expect(code(admitLink("https://other.com/docs/", context({ depth: 99 })))).toBe("EXTERNAL_LINK");
	});

	it("allows subdomains only when asked", () => {
		expect(code(admitLink("https://docs.example.com/docs/a", context()))).toBe("EXTERNAL_LINK");
		expect(code(admitLink("https://docs.example.com/docs/a", context({ allowSubdomains: true })))).toBeNull();
	});

	it("keeps the crawl inside the start directory", () => {
		expect(code(admitLink("/blog/post", context()))).toBe("BACKWARD_CRAWLING");
		expect(code(admitLink("/blog/post", context({ allowBackwardCrawling: true })))).toBeNull();
	});

	it("checks depth before patterns", () => {
		expect(code(admitLink("/docs/a", context({ depth: 3, excludePaths: ["^/docs/a"] })))).toBe("DEPTH_LIMIT");
	});

	it("applies exclude before include", () => {
		const result = admitLink("/docs/private/x", context({ includePaths: ["^/docs/"], excludePaths: ["/private/"] }));
		expect(code(result)).toBe("EXCLUDE_PATTERN");
		expect(result).toMatchObject({ message: expect.stringContaining('"/private/"') });
	});

	it("requires a match when include patterns exist", () => {
		expect(code(admitLink("/docs/api", context({ includePaths: ["^/api/"] })))).toBe("INCLUDE_PATTERN");
		expect(code(admitLink("/docs/api", context({ includePaths: ["^/docs/"] })))).toBeNull();
	});

	it("refuses files and social hosts", () => {
		expect(code(admitLink("/docs/manual.pdf", context()))).toBe("FILE_TYPE");
		expect(
			code(admitLink("https://x.com/example", context({ allowExternalLinks: true, allowBackwardCrawling: true }))),
		).toBe("SOCIAL_MEDIA");
	});

	it("honours robots unless explicitly ignored", () => {
		const robots = { isAllowed: (url: string) => !url.includes("/secret") };
		expect(code(admitLink("/docs/secret", context({ robots })))).toBe("ROBOTS_TXT");
		expect(code(admitLink("/docs/secret", context({ robots, ignoreRobotsTxt: true })))).toBeNull();
	});

	it("reports duplicates last", () => {
		const visited = new Set(["https://example.com/docs/a"]);
		expect(code(admitLink("/docs/a", context({ visited })))).toBe("DUPLICATE");
	});
});
