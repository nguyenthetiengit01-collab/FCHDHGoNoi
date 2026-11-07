import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { ensureWebpDataUrlServer } from "./serverWebp";

describe("ensureWebpDataUrlServer", () => {
  it("converts a PNG data URL to WebP data URL", async () => {
    const pngBuffer = await sharp({
      create: {
        width: 120,
        height: 160,
        channels: 3,
        background: { r: 30, g: 79, b: 194 },
      },
    })
      .png()
      .toBuffer();

    const pngDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    const result = await ensureWebpDataUrlServer(pngDataUrl, {
      maxWidth: 600,
      maxHeight: 800,
      quality: 85,
    });

    expect(result.startsWith("data:image/webp;base64,")).toBe(true);
  });

  it("leaves normal static paths unchanged", async () => {
    const staticUrl = "/images/hinhanh-webp/giaidau/DSC06522.webp";
    const result = await ensureWebpDataUrlServer(staticUrl);
    expect(result).toBe(staticUrl);
  });
});

