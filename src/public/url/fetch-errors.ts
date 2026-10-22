import { errorMessage } from "../../lib/errors.ts";

interface FetchCause {
  code?: string;
  message?: string;
}

export function describeFetchError(err: unknown): string {
  const cause = (err as { cause?: FetchCause })?.cause;
  const code = cause?.code || "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "The hostname doesn't resolve. Create the DNS record (or the tunnel's public hostname) first; then wait before checking again, failed lookups are cached for up to 30 minutes.";
  }
  if (/CERT|SSL|TLS/i.test(code) || /certificate/i.test(cause?.message || "")) {
    return `No valid HTTPS certificate (${code || cause?.message}). Cloudflare's free certificate only covers one subdomain level, e.g. bridge.example.com, not bridge.home.example.com.`;
  }
  if (code === "ECONNREFUSED") return "Connection refused.";
  if ((err as Error)?.name === "TimeoutError" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return "No answer within 10 seconds.";
  }
  return errorMessage(cause || err);
}
