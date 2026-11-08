import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { heicToJpeg, HEIC_TYPES } from "../src/lib/heic";

test("HEIC photo converts to a decodable JPEG of the same size", async () => {
  const input = await readFile(new URL("./fixtures/sample.heic", import.meta.url));
  const jpeg = await heicToJpeg(input);
  assert.equal(jpeg[0], 0xff);
  assert.equal(jpeg[1], 0xd8);
  // JPEG SOF0 marker (0xFFC0) carries height then width.
  const sof = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(sof > 0, "JPEG frame header present");
  assert.equal(jpeg.readUInt16BE(sof + 5), 900);
  assert.equal(jpeg.readUInt16BE(sof + 7), 1200);
});

test("HEIC MIME types are recognised", () => {
  assert.ok(HEIC_TYPES.has("image/heic"));
  assert.ok(HEIC_TYPES.has("image/heif"));
  assert.ok(!HEIC_TYPES.has("image/jpeg"));
});
