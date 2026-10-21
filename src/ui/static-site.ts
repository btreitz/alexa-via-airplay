import fs from "node:fs";
import path from "node:path";
import { CONTENT_TYPES, IMMUTABLE_CACHE, IMMUTABLE_PREFIX } from "./constants.ts";
import { contentSecurityPolicy, inlineScriptHashes } from "./csp.ts";
import type { StaticFile } from "./types.ts";

function decodePath(pathname: string): string | null {
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded.includes("\0") ? null : decoded;
  } catch {
    return null;
  }
}

function candidatesFor(relative: string): string[] {
  if (relative === "") return ["index.html"];
  return [relative, `${relative}.html`, path.join(relative, "index.html")];
}

function statFile(file: string): fs.Stats | null {
  try {
    const stat = fs.statSync(file);
    return stat.isFile() ? stat : null;
  } catch {
    return null;
  }
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

  resolve(pathname: string): StaticFile | null {
    const decoded = decodePath(pathname);
    if (decoded === null) return null;
    const relative = decoded.replace(/^\/+/, "");
    for (const candidate of candidatesFor(relative)) {
      const file = path.resolve(this.root, candidate);
      if (!file.startsWith(this.root + path.sep)) return null;
      const stat = statFile(file);
      if (stat) return { file, headers: this.headersFor(file, stat, relative) };
    }
    return null;
  }

  notFoundPage(): StaticFile | null {
    const file = path.join(this.root, "404.html");
    const stat = statFile(file);
    return stat ? { file, headers: this.headersFor(file, stat, "404.html") } : null;
  }

  private headersFor(file: string, stat: fs.Stats, relative: string): Record<string, string> {
    const ext = path.extname(file);
    const headers: Record<string, string> = {
      "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
      "Cache-Control": relative.startsWith(IMMUTABLE_PREFIX) ? IMMUTABLE_CACHE : "no-cache",
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
