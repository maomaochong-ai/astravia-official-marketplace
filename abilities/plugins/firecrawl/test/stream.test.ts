import { describe, expect, it } from "vitest";
import { downloadStream, planStream, StreamError, streamKind } from "../src/domain/media/stream";
import { discoverStreamUrl } from "../src/tools/video-tool";
import type { BinaryFetch, HttpClient, HttpResponse } from "../src/domain/scrape/http";

function http(responses: Record<string, string>): HttpClient {
	return async (init) => {
		const body = responses[init.url];
		const status = body === undefined ? 404 : 200;
		return {
			url: init.url,
			status,
			ok: status === 200,
			headers: { "content-type": init.url.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "application/dash+xml" },
			body: body ?? "",
			durationMs: 1,
			bytes: (body ?? "").length,
		} as HttpResponse;
	};
}

function binary(segments: Record<string, number[]>): BinaryFetch {
	return async (init) => {
		const bytes = segments[init.url];
		const base64 = bytes ? btoa(String.fromCharCode(...bytes)) : "";
		return {
			url: init.url,
			status: bytes ? 200 : 404,
			ok: Boolean(bytes),
			headers: {},
			base64,
			bytes: bytes?.length ?? 0,
		};
	};
}

const MEDIA_PLAYLIST = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-MAP:URI="init.mp4"
#EXTINF:4,
seg-1.m4s
#EXTINF:4,
seg-2.m4s
#EXT-X-ENDLIST`;

describe("stream detection", () => {
	it("recognises playlists, manifests and files", () => {
		expect(streamKind("https://a.test/x", "", "#EXTM3U\n#EXT-X-VERSION:7")).toBe("hls");
		expect(streamKind("https://a.test/x", "", '<?xml version="1.0"?><MPD xmlns="urn:mpeg:dash:schema:mpd:2011">')).toBe("dash");
		expect(streamKind("https://a.test/movie.mp4", "video/mp4", "")).toBe("file");
		expect(streamKind("https://a.test/page", "text/html", "<!doctype html>")).toBeNull();
	});
});

describe("hls planning", () => {
	it("keeps the init segment first and resolves relative URLs", async () => {
		const plan = await planStream(
			http({ "https://a.test/hls/index.m3u8": MEDIA_PLAYLIST }),
			"https://a.test/hls/index.m3u8",
			[],
		);
		expect(plan.kind).toBe("hls");
		expect(plan.container).toBe("mp4");
		expect(plan.segments).toEqual([
			"https://a.test/hls/init.mp4",
			"https://a.test/hls/seg-1.m4s",
			"https://a.test/hls/seg-2.m4s",
		]);
		expect(plan.encryption).toBeNull();
	});

	it("picks the highest-bitrate variant from a master playlist", async () => {
		const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
low/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720
high/index.m3u8`;
		const notes: string[] = [];
		const plan = await planStream(
			http({ "https://a.test/master.m3u8": master, "https://a.test/high/index.m3u8": MEDIA_PLAYLIST }),
			"https://a.test/master.m3u8",
			notes,
		);
		expect(plan.url).toBe("https://a.test/high/index.m3u8");
		expect(notes.join(" ")).toContain("1280x720");
	});

	it("reports encryption instead of hiding it", async () => {
		const encrypted = `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="key.bin"
#EXTINF:4,
seg-1.ts`;
		const plan = await planStream(http({ "https://a.test/e.m3u8": encrypted }), "https://a.test/e.m3u8", []);
		expect(plan.encryption).toBe("AES-128");
	});

	it("treats METHOD=NONE as clear", async () => {
		const clear = `#EXTM3U
#EXT-X-KEY:METHOD=NONE
#EXTINF:4,
seg-1.ts`;
		const plan = await planStream(http({ "https://a.test/c.m3u8": clear }), "https://a.test/c.m3u8", []);
		expect(plan.encryption).toBeNull();
		expect(plan.container).toBe("ts");
	});
});

describe("dash planning", () => {
	it("expands a $Number$ SegmentTemplate with a timeline", async () => {
		const mpd = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT8S">
  <Period><AdaptationSet><Representation id="video" bandwidth="900000">
    <SegmentTemplate initialization="init-$RepresentationID$.mp4" media="chunk-$Number%05d$.m4s" startNumber="7" timescale="1000">
      <SegmentTimeline><S t="0" d="4000" r="1"/></SegmentTimeline>
    </SegmentTemplate>
  </Representation></AdaptationSet></Period>
</MPD>`;
		const plan = await planStream(http({ "https://a.test/v/manifest.mpd": mpd }), "https://a.test/v/manifest.mpd", []);
		expect(plan.kind).toBe("dash");
		expect(plan.segments).toEqual([
			"https://a.test/v/init-video.mp4",
			"https://a.test/v/chunk-00007.m4s",
			"https://a.test/v/chunk-00008.m4s",
		]);
	});

	it("derives the segment count from duration when there is no timeline", async () => {
		const mpd = `<?xml version="1.0"?><MPD mediaPresentationDuration="PT10S"><Period><SegmentTemplate media="s-$Number$.m4s" duration="5000" timescale="1000" startNumber="1"/></Period></MPD>`;
		const plan = await planStream(http({ "https://a.test/d.mpd": mpd }), "https://a.test/d.mpd", []);
		expect(plan.segments).toEqual(["https://a.test/s-1.m4s", "https://a.test/s-2.m4s"]);
	});

	it("refuses DRM manifests", async () => {
		const mpd = `<?xml version="1.0"?><MPD><Period><AdaptationSet><ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"/></AdaptationSet></Period></MPD>`;
		const plan = await planStream(http({ "https://a.test/drm.mpd": mpd }), "https://a.test/drm.mpd", []);
		expect(plan.encryption).toContain("ContentProtection");
	});
});

describe("download", () => {
	it("concatenates the segments in order", async () => {
		const plan = await planStream(
			http({ "https://a.test/hls/index.m3u8": MEDIA_PLAYLIST }),
			"https://a.test/hls/index.m3u8",
			[],
		);
		const result = await downloadStream(
			binary({
				"https://a.test/hls/init.mp4": [1, 2],
				"https://a.test/hls/seg-1.m4s": [3, 4],
				"https://a.test/hls/seg-2.m4s": [5, 6],
			}),
			plan,
			1024,
		);
		expect(result.segments).toBe(3);
		expect(result.bytes).toBe(6);
		expect(atob(result.base64)).toBe("\x01\x02\x03\x04\x05\x06");
		expect(result.truncated).toBe(false);
	});

	it("stops at the size cap and says so", async () => {
		const plan = await planStream(
			http({ "https://a.test/hls/index.m3u8": MEDIA_PLAYLIST }),
			"https://a.test/hls/index.m3u8",
			[],
		);
		const result = await downloadStream(
			binary({
				"https://a.test/hls/init.mp4": [1, 2, 3, 4],
				"https://a.test/hls/seg-1.m4s": [5, 6, 7, 8],
			}),
			plan,
			4,
		);
		expect(result.bytes).toBe(4);
		expect(result.truncated).toBe(true);
		expect(result.segments).toBe(1);
	});

	it("fails when a segment is missing", async () => {
		const plan = await planStream(
			http({ "https://a.test/hls/index.m3u8": MEDIA_PLAYLIST }),
			"https://a.test/hls/index.m3u8",
			[],
		);
		await expect(downloadStream(binary({}), plan, 1024)).rejects.toBeInstanceOf(StreamError);
	});
});

describe("discovery", () => {
	it("prefers an m3u8 in the HTML", () => {
		const page = `<html><body><video src="/media/clip.mp4"></video>
			<script>var src = "https://cdn.test/hls/playlist.m3u8?token=abc";</script></body></html>`;
		expect(discoverStreamUrl(page, "https://site.test/watch")).toBe("https://cdn.test/hls/playlist.m3u8?token=abc");
	});

	it("falls back to a <video> source and resolves it", () => {
		const page = `<html><body><video src="/media/clip.mp4" controls></video></body></html>`;
		expect(discoverStreamUrl(page, "https://site.test/watch")).toBe("https://site.test/media/clip.mp4");
	});

	it("returns null when the page has no media", () => {
		expect(discoverStreamUrl("<html><body>nothing</body></html>", "https://site.test/")).toBeNull();
	});
});
