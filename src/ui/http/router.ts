import type { Handler, Params, Route } from "../types.ts";

function compile(pathPattern: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = pathPattern.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { pattern: new RegExp(`^${source}$`), keys };
}

function decodeParams(keys: string[], match: RegExpExecArray): Params | null {
  const params: Params = {};
  try {
    keys.forEach((key, i) => (params[key] = decodeURIComponent(match[i + 1])));
  } catch {
    return null;
  }
  return params;
}

export class Router {
  private readonly routes: Route[] = [];

  add(method: string, pathPattern: string, handler: Handler): void {
    this.routes.push({ method, handler, ...compile(pathPattern) });
  }

  match(method: string, pathname: string): { route: Route; params: Params } | "method" | undefined {
    let pathMatched = false;
    for (const route of this.routes) {
      const match = route.pattern.exec(pathname);
      if (!match) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params = decodeParams(route.keys, match);
      return params ? { route, params } : undefined;
    }
    return pathMatched ? "method" : undefined;
  }
}
