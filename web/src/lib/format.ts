export function ago(time: string | number | null | undefined): string {
  if (!time) return "never";
  const seconds = Math.round((Date.now() - new Date(time).getTime()) / 1000);
  if (seconds < 60) return `${Math.max(0, seconds)} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

/** The Clipboard API needs HTTPS or localhost; the UI usually runs on plain-HTTP LAN addresses. */
export async function copyToClipboard(text: string, fallbackSource?: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallbackSource) return false;
    fallbackSource.focus();
    fallbackSource.select();
    return document.execCommand("copy");
  }
}
