export function envString(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw ? raw : undefined;
}

export function envInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = envString(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer ${min}–${max}, got "${raw}"`);
  }
  return value;
}

export function envPort(name: string, fallback: number): number {
  return envInteger(name, fallback, 1, 65535);
}

export function envList(name: string, fallback: string): string[] {
  return (envString(name) ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
