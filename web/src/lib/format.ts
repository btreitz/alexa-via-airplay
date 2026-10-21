export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function secondsAgo(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, seconds)} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

export function ago(time: string | number | null | undefined): string {
  if (!time) return "never";
  return secondsAgo(Math.round((Date.now() - new Date(time).getTime()) / 1000));
}

export function uptime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
