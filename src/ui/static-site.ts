// Serves the web UI: the static export of the Next.js app (web/out). The
// pages carry a few inline bootstrap scripts; instead of allowing inline
// scripts in general, each HTML file's CSP lists the hashes of exactly the
// inline scripts it contains.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

/** sha256 source expressions for every inline script in an HTML document. */
export function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    if (!match[1]) continue;
    hashes.add(`'sha256-${crypto.createHash("sha256").update(match[1], "utf8").digest("base64")}'`);
  }
  return [...hashes];
}

export function contentSecurityPolicy(scriptHashes: string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self'${scriptHashes.length ? ` ${scriptHashes.join(" ")}` : ""}`,
    // Server-rendered markup carries style attributes (Radix positioning).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
}

export interface StaticFile {
  file: string;
  headers: Record<string, string>;
}

export class StaticSite {
  readonly root: string;
  private readonly cspCache = new Map<string, { mtimeMs: number; csp: string }>();

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  get available(): boolean {
    return fs.existsSync(path.join(this.root, "index.html"));
  }

  /** Maps a URL path to a file under the root, or null. Never leaves the root. */
  resolve(pathname: string): StaticFile | null {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (decoded.includes("\0")) return null;
    const relative = decoded.replace(/^\/+/, "");
    const candidates = relative === "" ? ["index.html"] : [relative, `${relative}.html`, path.join(relative, "index.html")];
    for (const candidate of candidates) {
      const file = path.resolve(this.root, candidate);
      if (!file.startsWith(this.root + path.sep)) return null;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      return { file, headers: this.headersFor(file, stat, relative) };
    }
    return null;
  }

  notFoundPage(): StaticFile | null {
    const file = path.join(this.root, "404.html");
    try {
      return { file, headers: this.headersFor(file, fs.statSync(file), "404.html") };
    } catch {
      return null;
    }
  }

  private headersFor(file: string, stat: fs.Stats, relative: string): Record<string, string> {
    const ext = path.extname(file);
    const headers: Record<string, string> = {
      "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
      // Build output under _next/static has content hashes in its names.
      "Cache-Control": relative.startsWith("_next/static/") ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    };
    if (ext === ".html") {
      headers["Content-Security-Policy"] = this.cspFor(file, stat);
      headers["X-Frame-Options"] = "DENY";
    }
    return headers;
  }

  private cspFor(file: string, stat: fs.Stats): string {
    const cached = this.cspCache.get(file);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.csp;
    const csp = contentSecurityPolicy(inlineScriptHashes(fs.readFileSync(file, "utf8")));
    this.cspCache.set(file, { mtimeMs: stat.mtimeMs, csp });
    return csp;
  }
}
