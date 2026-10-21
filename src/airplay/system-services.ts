import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/log.ts";
import { Supervised } from "../lib/supervised.ts";
import { waitFor } from "../lib/time.ts";
import {
  AVAHI_LOG_FILTER,
  AVAHI_PID_FILE,
  AVAHI_READY_TIMEOUT_MS,
  DBUS_SOCKET,
  DBUS_START_TIMEOUT_MS,
  NQPTP_BIND_ERROR,
} from "./constants.ts";
import { avahiConfig, defaultRouteInterface } from "./system-config.ts";
import type { SystemHealth } from "./types.ts";

export class SystemServices {
  readonly interfaces?: string;
  private readonly log = logger("system");
  private readonly runDir: string;
  private readonly dbus: Supervised;
  private readonly avahi: Supervised;
  private readonly nqptp: Supervised;
  private readonly problems = new Set<string>();
  private avahiReady = false;

  constructor(runDir: string, interfaces?: string) {
    this.runDir = runDir;
    this.interfaces = interfaces || defaultRouteInterface();
    this.dbus = this.createDbus();
    this.avahi = this.createAvahi();
    this.nqptp = this.createNqptp();
  }

  async start(): Promise<void> {
    this.log.info("starting shared services", { avahiInterfaces: this.interfaces ?? "all" });
    this.dbus.start();
    await waitFor(() => fs.existsSync(DBUS_SOCKET), DBUS_START_TIMEOUT_MS);
    this.avahi.start();
    this.nqptp.start();
    if (!(await waitFor(() => this.avahiReady, AVAHI_READY_TIMEOUT_MS))) {
      this.log.warn("Avahi not ready after 10 s, continuing");
    }
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

  private createDbus(): Supervised {
    return new Supervised({
      name: "dbus",
      command: "dbus-daemon",
      args: ["--system", "--nofork", "--nopidfile"],
      beforeStart: () => {
        fs.mkdirSync(path.dirname(DBUS_SOCKET), { recursive: true });
        fs.rmSync(DBUS_SOCKET, { force: true });
      },
    });
  }

  private createAvahi(): Supervised {
    const configFile = path.join(this.runDir, "avahi-daemon.conf");
    return new Supervised({
      name: "avahi",
      command: "avahi-daemon",
      args: ["--no-chroot", "--no-rlimits", "-f", configFile],
      beforeStart: () => {
        this.avahiReady = false;
        fs.mkdirSync(this.runDir, { recursive: true });
        fs.writeFileSync(configFile, avahiConfig(this.interfaces));
        fs.rmSync(AVAHI_PID_FILE, { force: true });
      },
      onLine: (line) => this.onAvahiLine(line),
    });
  }

  private onAvahiLine(line: string): boolean {
    if (line.includes("Server startup complete")) this.avahiReady = true;
    if (line.includes("Detected another IPv4 mDNS stack")) {
      this.problems.add(
        "Another mDNS responder (Avahi?) runs on this host. Stop it, or AirPlay discovery may be unreliable.",
      );
    }
    return AVAHI_LOG_FILTER.test(line);
  }

  private createNqptp(): Supervised {
    return new Supervised({
      name: "nqptp",
      command: "nqptp",
      args: [],
      onLine: (line) => {
        if (NQPTP_BIND_ERROR.test(line)) {
          this.problems.add(
            "NQPTP can't bind UDP 319/320. Another PTP or AirPlay 2 service uses these ports on this host.",
          );
        }
      },
    });
  }
}
