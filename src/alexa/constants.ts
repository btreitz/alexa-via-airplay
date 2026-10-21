export const COMMAND_TIMEOUT_MS = 15_000;
export const AUTH_REFRESH_MS = 25 * 60_000;
export const WARM_MIN_INTERVAL_MS = 30_000;
export const VOLUME_GAP_MS = 1000;
export const HTTPS_KEEP_ALIVE_MS = 60_000;
export const SESSION_FILE_MODE = 0o600;

export const AMAZON_PAGES = [
  "amazon.com",
  "amazon.ca",
  "amazon.com.mx",
  "amazon.com.br",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.nl",
  "amazon.in",
  "amazon.co.jp",
  "amazon.com.au",
] as const;

export const EXCLUDED_DEVICE_FAMILIES = new Set(["WHA", "UNKNOWN", "VOX", "TABLET", "MSHOP"]);
export const AUDIO_PLAYER_CAPABILITY = "AUDIO_PLAYER";
export const LOGIN_URL_PATTERN = /Please open (http:\/\/\S+?)\/? with your browser/;
export const PROXY_LISTEN_BIND = "0.0.0.0";

export const SKILL_REPORT_TIMEOUT_MS = 1500;
export const MAX_INVOCATION_NAME_LENGTH = 50;
export const RESERVED_INVOCATION_WORDS = /\b(alexa|amazon|echo|skill|app)\b/;
export const PLAY_INTENT_SAMPLES = ["play", "start", "start playing", "resume playing"];
export const BUILT_IN_INTENTS = [
  "AMAZON.CancelIntent",
  "AMAZON.HelpIntent",
  "AMAZON.StopIntent",
  "AMAZON.NavigateHomeIntent",
  "AMAZON.FallbackIntent",
  "AMAZON.PauseIntent",
  "AMAZON.ResumeIntent",
  "AMAZON.NextIntent",
  "AMAZON.PreviousIntent",
  "AMAZON.StartOverIntent",
  "AMAZON.RepeatIntent",
  "AMAZON.LoopOnIntent",
  "AMAZON.LoopOffIntent",
  "AMAZON.ShuffleOnIntent",
  "AMAZON.ShuffleOffIntent",
];
