// Plain one-line logs: `time level [scope] message key=value ...`.

type Fields = Record<string, unknown>;
type Level = "debug" | "info" | "warn" | "error";

const order: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const threshold = order[(process.env.LOG_LEVEL as Level) || "info"] ?? order.info;

function format(fields?: Fields): string {
  if (!fields) return "";
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}=${typeof v === "string" && !/\s/.test(v) ? v : JSON.stringify(v)}`)
    .join("");
}

function write(level: Level, scope: string, message: string, fields?: Fields): void {
  if (order[level] < threshold) return;
  const line = `${new Date().toISOString()} ${level.padEnd(5)} [${scope}] ${message}${format(fields)}`;
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(`${line}\n`);
}

export interface Logger {
  debug(message: string, fields?: Fields): void;
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
}

export function logger(scope: string): Logger {
  return {
    debug: (m, f) => write("debug", scope, m, f),
    info: (m, f) => write("info", scope, m, f),
    warn: (m, f) => write("warn", scope, m, f),
    error: (m, f) => write("error", scope, m, f),
  };
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
