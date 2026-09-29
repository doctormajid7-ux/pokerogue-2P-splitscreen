import { assetPath } from "#utils/asset-path";
import { describe, expect, it } from "vitest";

describe("assetPath", () => {
  it("should keep an asset at the root of its directory free of a double slash", () => {
    // Regression: this produced `images//logo.png`, which browsers tolerate and
    // Android's AssetManager refuses — the title logo then showed Phaser's
    // missing-texture square.
    const path = assetPath("images", "", "logo.png");

    expect(path).toBe("images/logo.png");
    expect(path).not.toContain("//");
  });

  it("should join a sub-directory", () => {
    expect(assetPath("images", "ui", "cursor.png")).toBe("images/ui/cursor.png");
  });

  it("should tolerate a folder given with a trailing slash", () => {
    expect(assetPath("images", "ui/", "cursor.png")).toBe("images/ui/cursor.png");
  });

  it("should build audio paths the same way", () => {
    expect(assetPath("audio", "se", "hit.wav")).toBe("audio/se/hit.wav");
    expect(assetPath("audio", "", "theme.mp3")).toBe("audio/theme.mp3");
  });
});
