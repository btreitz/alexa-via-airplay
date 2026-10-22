export const STREAM_PATH = "/play.mp3";
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9._-]{4,64}$/;
export const URL_TTL_SECONDS = 60;
export const CLOCK_SKEW_SECONDS = 30;
export const MAX_TTL_SECONDS = 300;
export const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const EXPIRY_PATTERN = /^\d{1,12}$/;
export const LOGGED_QUERY_KEYS = ["d", "e", "exp"] as const;
export const MAX_LOGGED_QUERY_VALUE = 64;

export const SKILL_EVENTS = ["started", "stopped", "failed", "paused", "resumed"] as const;
export const SKILL_REPORT_EXPECTED_MS = 20_000;
export const REPORT_KEYS = ["d", "e", "exp", "sig"] as const;

export const NOT_FOUND_BODY = "Not found\n";
export const RECENT_REQUESTS_LIMIT = 50;
export const KEEP_ALIVE_TIMEOUT_MS = 5000;
export const HEADERS_TIMEOUT_MS = 10_000;
export const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_LOGGED_PATH = 100;

export const LOOKUP_TIMEOUT_MS = 5000;
export const MAX_TRACE_BYTES = 8192;
export const FORCED_REFRESH_MIN_INTERVAL_MS = 30_000;
export const MIN_STALE_AFTER_SECONDS = 1800;

export const URL_CHECK_TIMEOUT_MS = 10_000;
export const PROBE_ARRIVAL_GRACE_MS = 2000;
export const PROBE_NONCE_BYTES = 16;
export const PROXY_ERROR_STATUSES = new Set([502, 503, 530]);
