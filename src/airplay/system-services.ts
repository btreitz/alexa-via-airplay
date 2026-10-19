// The services all receivers share: one system D-Bus (Avahi needs it), one
// Avahi daemon for mDNS, one NQPTP for AirPlay 2 timing (UDP 319/320).

import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/log.ts";
import { Supervised } from "../lib/supervisor.ts";

const log = logger("system");

/** Interface of the IPv4 default route, read from /proc/net/route. */
export function defaultRouteInterface(): string | undefined {
  try {
    const lines = fs.readFileSync("/proc/net/route", "utf8").trim().split("\n").slice(1);
    for (const line of lines) {
      const [iface, destination, , , , , , mask] = line.split(/\s+/);
      if (destination === "00000000" && mask === "00000000") return iface;
    }
  } catch {
    // not Linux
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

export interface SystemHealth {
  dbus: boolean;
  avahi: boolean;
  avahiReady: boolean;
  nqptp: boolean;
  problems: string[];
}

export class SystemServices {
  private readonly dbus: Supervised;
  private readonly avahi: Supervised;
  private readonly nqptp: Supervised;
  private avahiReady = false;
  private readonly problems = new Set<string>();
  readonly interfaces?: string;

  constructor(runDir: string, interfaces?: string) {
    this.interfaces = interfaces || defaultRouteInterface();
    const avahiConf = path.join(runDir, "avahi-daemon.conf");

    this.dbus = new Supervised({
      name: "dbus",
      command: "dbus-daemon",
      args: ["--system", "--nofork", "--nopidfile"],
      beforeStart: () => {
        fs.mkdirSync("/run/dbus", { recursive: true });
        fs.rmSync("/run/dbus/system_bus_socket", { force: true });
      },
    });

    this.avahi = new Supervised({
      name: "avahi",
      command: "avahi-daemon",
      args: ["--no-chroot", "--no-rlimits", "-f", avahiConf],
      beforeStart: () => {
        this.avahiReady = false;
        fs.mkdirSync(runDir, { recursive: true });
        fs.writeFileSync(avahiConf, avahiConfig(this.interfaces));
        fs.rmSync("/run/avahi-daemon/pid", { force: true });
      },
      onLine: (line) => {
        if (line.includes("Server startup complete")) this.avahiReady = true;
        if (line.includes("Detected another IPv4 mDNS stack")) {
          this.problems.add("Another mDNS responder (Avahi?) runs on this host. Stop it, or AirPlay discovery may be unreliable.");
        }
        // Avahi is chatty about every interface and record; keep warnings and the essentials.
        return /startup complete|another|error|fail|warn|Joining|allow-interfaces/i.test(line);
      },
    });

    this.nqptp = new Supervised({
      name: "nqptp",
      command: "nqptp",
      args: [],
      onLine: (line) => {
        if (/bind|address already in use/i.test(line)) {
          this.problems.add("NQPTP can't bind UDP 319/320. Another PTP or AirPlay 2 service uses these ports on this host.");
        }
      },
    });
  }

  async start(): Promise<void> {
    log.info("starting shared services", { avahiInterfaces: this.interfaces ?? "all" });
    this.dbus.start();
    await waitFor(() => fs.existsSync("/run/dbus/system_bus_socket"), 5000);
    this.avahi.start();
    this.nqptp.start();
    if (!(await waitFor(() => this.avahiReady, 10_000))) log.warn("Avahi not ready after 10 s, continuing");
  }

  async stop(): Promise<void> {
    await Promise.all([this.nqptp.stop(), this.avahi.stop()]);
    await this.dbus.stop();
  }

  health(): SystemHealth {
    return {
      dbus: this.dbus.running,
      avahi: this.avahi.running,
      avahiReady: this.avahiReady,
      nqptp: this.nqptp.running,
      problems: [...this.problems],
    };
  }
}

export async function waitFor(check: () => boolean, timeoutMs: number, intervalMs = 100): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return check();
}
