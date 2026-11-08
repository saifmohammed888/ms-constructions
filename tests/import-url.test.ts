import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedImageMime, checkImportUrl, parseTags, sourceTag } from "../src/lib/import-url";

test("accepts Google Photos image hosts over https", () => {
  assert.equal(checkImportUrl("https://lh3.googleusercontent.com/pw/abc=w1600").ok, true);
  assert.equal(checkImportUrl("https://lh5.ggpht.com/x").ok, true);
});

test("rejects other hosts, http, ports and credentials", () => {
  assert.equal(checkImportUrl("http://lh3.googleusercontent.com/x").ok, false);
  assert.equal(checkImportUrl("https://evil.com/googleusercontent.com").ok, false);
  assert.equal(checkImportUrl("https://googleusercontent.com.evil.com/x").ok, false);
  assert.equal(checkImportUrl("https://169.254.169.254/latest").ok, false);
  assert.equal(checkImportUrl("https://lh3.googleusercontent.com:8443/x").ok, false);
  assert.equal(checkImportUrl("https://a:b@lh3.googleusercontent.com/x").ok, false);
  assert.equal(checkImportUrl("not a url").ok, false);
  assert.equal(checkImportUrl(42).ok, false);
});

test("only image content types pass", () => {
  assert.equal(allowedImageMime("image/jpeg; charset=binary"), "image/jpeg");
  assert.equal(allowedImageMime("text/html"), null);
  assert.equal(allowedImageMime(null), null);
});

test("source tag and tag parsing", () => {
  assert.equal(sourceTag("AF1Qip-abc_1"), "src:AF1Qip-abc_1");
  assert.equal(sourceTag("  "), null);
  assert.equal(sourceTag(undefined), null);
  assert.deepEqual(parseTags("daily-log, 2026-10-01,,"), ["daily-log", "2026-10-01"]);
  assert.deepEqual(parseTags(["a", " b "]), ["a", "b"]);
});
