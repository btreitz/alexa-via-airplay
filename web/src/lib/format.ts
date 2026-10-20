export function ago(time: string | number | null | undefined): string {
  if (!time) return "never";
  const seconds = Math.round((Date.now() - new Date(time).getTime()) / 1000);
  if (seconds < 60) return `${Math.max(0, seconds)} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

/**
 * The Clipboard API needs HTTPS or localhost; the UI usually runs on a plain-HTTP
 * LAN address. There the old execCommand route works, through a temporary,
 * off-screen textarea, so nothing has to be visible to copy it.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    try {
      return document.execCommand("copy");
    } finally {
      area.remove();
    }
  }
}
