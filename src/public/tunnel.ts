// Optional built-in Cloudflare Tunnel: when TUNNEL_TOKEN is set, the bridge
// runs cloudflared itself. The token goes through the environment (not the
// command line, which other processes can read) and is never logged.

import { logger } from "../lib/log.ts";
import { Supervised } from "../lib/supervisor.ts";

const tunnelLog = logger("tunnel");

export interface TunnelStatus {
  enabled: boolean;
  running: boolean;
  connections: number;
  lastError: string | null;
}

export function redactTunnelLine(line: string): string {
  return line.replace(/eyJ[A-Za-z0-9_-]{20,}={0,2}/g, "<token>").replace(/(token[=:]\s*)\S+/gi, "$1<redacted>");
}

export class Tunnel {
  private readonly process: Supervised;
  private connections = new Set<string>();
  private lastError: string | null = null;

  constructor(token: string) {
    this.process = new Supervised({
      name: "tunnel",
      command: "cloudflared",
      // Metrics only on loopback: with host networking they'd be reachable from the LAN.
      args: ["tunnel", "--no-autoupdate", "--loglevel", "info", "--metrics", "127.0.0.1:0", "run"],
      spawnOptions: { env: { ...process.env, TUNNEL_TOKEN: token } },
      beforeStart: () => this.connections.clear(),
      onLine: (line) => {
        const index = /connIndex=(\d+)/.exec(line)?.[1];
        if (/Registered tunnel connection/.test(line) && index) this.connections.add(index);
        if (/Unregistered tunnel connection|Connection terminated|lost connection/i.test(line) && index) this.connections.delete(index);
        if (/\bERR\b/.test(line)) this.lastError = redactTunnelLine(line).replace(/^\S+\s+ERR\s+/, "").slice(0, 300);
        // Re-log ourselves, redacted, and skip noisy ICMP proxy warnings.
        if (!/ICMP proxy|ping_group_range|INF\s+[+|]/i.test(line)) logTunnel(redactTunnelLine(line));
        return false;
      },
    });
  }

  start(): void {
    this.process.start();
  }

  stop(): Promise<void> {
    return this.process.stop();
  }

  status(): TunnelStatus {
    return { enabled: true, running: this.process.running, connections: this.connections.size, lastError: this.lastError };
  }
}

function logTunnel(line: string): void {
  if (line.trim()) tunnelLog.info(line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s+/, ""));
}
