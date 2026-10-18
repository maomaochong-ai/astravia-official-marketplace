import { describe, expect, it } from "vitest";
import { isManifestUrl, profileElements, profileText } from "../src/domain/html/elements";
import { parseHtml } from "../src/domain/html/document";

const PAGE = `<!doctype html>
<html><head><title>Watch</title></head>
<body>
  <h1>Watch</h1>
  <h2>Part one</h2>
  <p>First paragraph.</p>
  <p>Second paragraph with a <a href="/a">link</a>.</p>
  <img src="/img/cover.png" alt="Cover">
  <img src="data:image/png;base64,AAAA" alt="inline">
  <video src="https://cdn.example.com/clip.mp4" poster="/img/poster.jpg">
    <source src="https://cdn.example.com/clip.m3u8" type="application/x-mpegURL">
  </video>
  <video src="blob:https://example.com/2f1c-4d">
    <source src="blob:https://example.com/2f1c-4d">
  </video>
  <audio src="https://cdn.example.com/track.mp3"></audio>
  <pre><code>npm i</code></pre>
  <table><tr><td>a</td></tr></table>
  <form action="/search"></form>
  <iframe src="about:blank"></iframe>
</body></html>`;

describe("profileElements", () => {
	const doc = parseHtml(PAGE, "https://example.com/watch");
	const profile = profileElements(doc, 480);

	it("counts the structures a reader would notice", () => {
		expect(profile.headings).toBe(2);
		expect(profile.paragraphs).toBe(2);
		expect(profile.links).toBe(1);
		expect(profile.images).toBe(2);
		expect(profile.videos).toBe(2);
		expect(profile.audio).toBe(1);
		expect(profile.tables).toBe(1);
		expect(profile.forms).toBe(1);
		expect(profile.iframes).toBe(1);
		expect(profile.chars).toBe(480);
	});

	it("resolves media against the page URL and keeps manifests marked", () => {
		const urls = profile.media.map((entry) => entry.url);
		expect(urls).toContain("https://cdn.example.com/clip.mp4");
		expect(urls).toContain("https://cdn.example.com/clip.m3u8");
		expect(urls).toContain("https://cdn.example.com/track.mp3");
		expect(urls).toContain("https://example.com/img/cover.png");
		expect(profile.media.find((entry) => entry.url.endsWith(".m3u8"))?.manifest).toBe(true);
	});

	it("skips data: images but records Media Source streams as protected", () => {
		expect(profile.media.some((entry) => entry.url.startsWith("data:"))).toBe(false);
		expect(profile.streamed).toBe(1);
		expect(profile.media.some((entry) => entry.url.startsWith("blob:"))).toBe(false);
	});
});

describe("isManifestUrl", () => {
	it("recognises playlists with and without a query string", () => {
		expect(isManifestUrl("https://a.com/x.m3u8")).toBe(true);
		expect(isManifestUrl("https://a.com/x.mpd?token=1")).toBe(true);
		expect(isManifestUrl("https://a.com/x.mp4")).toBe(false);
	});
});

describe("profileText", () => {
	it("derives paragraph and link counts from plain text", () => {
		const profile = profileText("One.\n\nTwo https://example.com/a b.\n\nThree.", "T");
		expect(profile.title).toBe("T");
		expect(profile.paragraphs).toBe(3);
		expect(profile.links).toBe(1);
		expect(profile.media).toHaveLength(0);
	});
});
