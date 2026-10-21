import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { contentSecurityPolicy, inlineScriptHashes } from "../../src/ui/csp.ts";
import { StaticSite } from "../../src/ui/static-site.ts";
import { tempDir } from "../helpers.ts";

const inline = 'self.__next_f.push([1,"x"])';
const html = `<!doctype html><html><head><script src="/_next/static/chunks/a.js" async></script></head><body><script>${inline}</script><script id="theme">(()=>{})()</script></body></html>`;

function site() {
  const root = tempDir();
  fs.writeFileSync(path.join(root, "index.html"), html);
  fs.writeFileSync(path.join(root, "404.html"), "<!doctype html><title>404</title>");
  fs.mkdirSync(path.join(root, "_next/static/chunks"), { recursive: true });
  fs.writeFileSync(path.join(root, "_next/static/chunks/a.js"), "console.log(1)");
  fs.mkdirSync(path.join(root, "about"));
  fs.writeFileSync(path.join(root, "about.html"), "<p>about</p>");
  fs.writeFileSync(path.join(path.dirname(root), "outside.txt"), "secret");
  return new StaticSite(root);
}

test("hashes exactly the inline scripts", () => {
  const hashes = inlineScriptHashes(html);
  const expected = `'sha256-${crypto.createHash("sha256").update(inline).digest("base64")}'`;
  assert.equal(hashes.length, 2);
  assert.ok(hashes.includes(expected));
  const csp = contentSecurityPolicy(hashes);
  assert.match(csp, /script-src 'self' 'sha256-/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
});

test("resolves pages, clean URLs and assets", () => {
  const s = site();
  assert.match(s.resolve("/")!.headers["Content-Security-Policy"], /sha256-/);
  assert.equal(path.basename(s.resolve("/about")!.file), "about.html");
  const asset = s.resolve("/_next/static/chunks/a.js")!;
  assert.match(asset.headers["Cache-Control"], /immutable/);
  assert.equal(asset.headers["Content-Security-Policy"], undefined);
  assert.equal(s.resolve("/missing"), null);
  assert.ok(s.notFoundPage());
});

test("never leaves the root", () => {
  const s = site();
  for (const p of [
    "/../outside.txt",
    "/%2e%2e/outside.txt",
    "/..%2foutside.txt",
    "/%00",
    "/%E0%A4%A",
  ])
    assert.equal(s.resolve(p), null, p);
});
