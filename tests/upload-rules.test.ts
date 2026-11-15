import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMimeType, uploadProblem, MAX_UPLOAD_BYTES, friendlyFileName, uploadStamp } from "../src/lib/upload-rules";

test("phone photos without a MIME type are recognised from their extension", () => {
  assert.equal(resolveMimeType("", "IMG_0001.HEIC"), "image/heic");
  assert.equal(resolveMimeType("application/octet-stream", "plan.pdf"), "application/pdf");
  assert.equal(resolveMimeType("image/png", "anything.bin"), "image/png");
});

test("uploads are refused with a plain reason before they are sent", () => {
  assert.match(uploadProblem({ size: 0, name: "a.jpg", type: "image/jpeg" }) ?? "", /empty/);
  assert.match(uploadProblem({ size: MAX_UPLOAD_BYTES + 1, name: "a.pdf", type: "application/pdf" }) ?? "", /50 MB/);
  assert.match(uploadProblem({ size: 10, name: "run.exe", type: "application/x-msdownload" }) ?? "", /not supported/);
  assert.equal(uploadProblem({ size: 10, name: "site.jpg", type: "image/jpeg" }), null);
  assert.equal(uploadProblem({ size: 10, name: "drawing.docx", type: "" }), null);
});

test("camera names get a readable prefix, owner names are kept", () => {
  assert.equal(friendlyFileName("IMG_1184.jpeg", "photos", "2026-11-15_1542"), "2026-11-15_1542_photos_IMG_1184.jpeg");
  assert.equal(friendlyFileName("2026-11-04_1147_Material_Steel.jpg", "photos", "2026-11-15_1542"), "2026-11-04_1147_Material_Steel.jpg");
  assert.equal(friendlyFileName("Sump Plastered.jpg", "photos", "2026-11-15_1542"), "Sump Plastered.jpg");
});

test("upload stamp uses India time, not server time", () => {
  assert.equal(uploadStamp(new Date("2026-11-15T10:12:00Z")), "2026-11-15_1542");
  assert.equal(uploadStamp(new Date("2026-11-14T18:31:00Z")), "2026-11-15_0001");
});
