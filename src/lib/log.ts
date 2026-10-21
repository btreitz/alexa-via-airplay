type Fields = Record<string, unknown>;
type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const threshold = LEVEL_ORDER[(process.env.LOG_LEVEL as Level) || "info"] ?? LEVEL_ORDER.info;

export interface Logger {
  debug(message: string, fields?: Fields): void;
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
}

function formatValue(value: unknown): string {
  return typeof value === "string" && !/\s/.test(value) ? value : JSON.stringify(value);
}

function formatFields(fields?: Fields): string {
  if (!fields) return "";
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}=${formatValue(value)}`)
    .join("");
}

function write(level: Level, scope: string, message: string, fields?: Fields): void {
  if (LEVEL_ORDER[level] < threshold) return;
  const line = `${new Date().toISOString()} ${level.padEnd(5)} [${scope}] ${message}${formatFields(fields)}`;
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

export function logger(scope: string): Logger {
  return {
    debug: (message, fields) => write("debug", scope, message, fields),
    info: (message, fields) => write("info", scope, message, fields),
    warn: (message, fields) => write("warn", scope, message, fields),
    error: (message, fields) => write("error", scope, message, fields),
  };
}
