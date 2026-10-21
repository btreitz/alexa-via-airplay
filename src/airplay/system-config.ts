import fs from "node:fs";

export function defaultRouteInterface(): string | undefined {
  try {
    const lines = fs.readFileSync("/proc/net/route", "utf8").trim().split("\n").slice(1);
    for (const line of lines) {
      const [iface, destination, , , , , , mask] = line.split(/\s+/);
      if (destination === "00000000" && mask === "00000000") return iface;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function avahiConfig(interfaces?: string): string {
  return [
    "[server]",
    interfaces ? `allow-interfaces=${interfaces}` : "# all interfaces",
    "use-ipv4=yes",
    "use-ipv6=yes",
    "ratelimit-interval-usec=1000000",
    "ratelimit-burst=1000",
    "",
    "[publish]",
    "publish-hinfo=no",
    "publish-workstation=no",
    "",
  ].join("\n");
}
