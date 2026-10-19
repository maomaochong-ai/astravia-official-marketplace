import { describe, expect, it } from "vitest";
import { failureMessageKey } from "../domain/failure-codes";
import en from "../../locales/en.json";
import zh from "../../locales/zh.json";

describe("failureMessageKey", () => {
  it("maps engine failure codes to localized message keys", () => {
    expect(failureMessageKey("network_timeout")).toBe("error.networkTimeout");
    expect(failureMessageKey("network_blocked")).toBe("error.networkBlocked");
    expect(failureMessageKey("auth_required")).toBe("error.authRequired");
    expect(failureMessageKey("site_unsupported")).toBe("error.siteUnsupported");
  });

  it("explains a tool that is still being fetched instead of showing a raw failure", () => {
    expect(failureMessageKey("engine_preparing")).toBe("error.enginePreparing");
    expect(failureMessageKey("ffmpeg_required")).toBe("error.ffmpegPreparing");
  });

  it("leaves unknown or missing codes to the raw message", () => {
    expect(failureMessageKey("something_new")).toBeNull();
    expect(failureMessageKey(null)).toBeNull();
  });
});

describe("locale catalogs", () => {
  it("define every message the failure codes point at, in both languages", () => {
    for (const code of ["engine_preparing", "ffmpeg_required", "engine_unavailable"]) {
      const key = failureMessageKey(code);
      expect(key).not.toBeNull();
      expect((en as Record<string, string>)[key as string]).toBeTypeOf("string");
      expect((zh as Record<string, string>)[key as string]).toBeTypeOf("string");
    }
  });
});
