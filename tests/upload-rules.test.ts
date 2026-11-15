import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMimeType, uploadProblem, MAX_UPLOAD_BYTES } from "../src/lib/upload-rules";

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
