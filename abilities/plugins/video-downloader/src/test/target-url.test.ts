import { describe, expect, it } from "vitest";
import { extractTargetUrl } from "../domain/target-url";

describe("extractTargetUrl", () => {
  it("keeps a clean link untouched", () => {
    expect(extractTargetUrl("https://www.bilibili.com/video/BV1xx411c7mD")).toBe(
      "https://www.bilibili.com/video/BV1xx411c7mD",
    );
  });

  it("finds the link inside a douyin share message", () => {
    const share =
      "7.97 复制打开抖音，看看【山子岚的作品】如果累了就回故乡 https://v.douyin.com/jusf6MklgkI/ eBT:/ n@Q.xF 07/04 :8pm";
    expect(extractTargetUrl(share)).toBe("https://v.douyin.com/jusf6MklgkI/");
  });

  it("completes a schemeless short link", () => {
    expect(extractTargetUrl("v.douyin.com/jusf6MklgkI/")).toBe("https://v.douyin.com/jusf6MklgkI/");
    expect(extractTargetUrl("b23.tv/BV1xx411c7mD")).toBe("https://b23.tv/BV1xx411c7mD");
    expect(extractTargetUrl("www.bilibili.com/video/BV1xx411c7mD")).toBe(
      "https://www.bilibili.com/video/BV1xx411c7mD",
    );
  });

  it("strips sentence punctuation around the link", () => {
    expect(extractTargetUrl("看这个（https://b23.tv/abc）很好")).toBe("https://b23.tv/abc");
    expect(extractTargetUrl("链接：https://b23.tv/abc。")).toBe("https://b23.tv/abc");
    expect(extractTargetUrl("链接是https://b23.tv/abc,")).toBe("https://b23.tv/abc");
  });

  it("ignores prose and handles that are not links", () => {
    expect(extractTargetUrl("")).toBe("");
    expect(extractTargetUrl("   ")).toBe("");
    expect(extractTargetUrl("7.97 复制打开抖音，07/04 :8pm")).toBe("");
    expect(extractTargetUrl("这个视频不错")).toBe("");
  });

  it("prefers the first link when a message carries several", () => {
    expect(extractTargetUrl("https://a.example.com/1 https://b.example.com/2")).toBe("https://a.example.com/1");
  });
});
