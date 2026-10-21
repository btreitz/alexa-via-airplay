import type { CatchUp } from "./types.ts";

export const SAMPLE_RATE = 44100;
export const BYTES_PER_FRAME = 4;
export const BYTES_PER_SECOND = SAMPLE_RATE * BYTES_PER_FRAME;
export const FULL_SCALE = 32768;
export const MIN_LEVEL_DB = -96;

export const FILLER_TICK_MS = 20;
export const SILENCE_AFTER_MS = 200;
export const ENCODER_LINGER_MS = 15_000;
export const ENCODER_RESTART_DELAY_MS = 500;
export const RECONNECT_MS = 5000;
export const MAX_FILLER_MS = 1000;
export const MAX_CLIENT_BACKLOG_BYTES = 1024 * 1024;

// -probesize/-analyzeduration: without them ffmpeg buffers ~5 s before encoding, and the Echo keeps that delay.
export const ENCODER_ARGS: readonly string[] = [
  "-hide_banner",
  "-loglevel",
  "warning",
  "-nostdin",
  "-probesize",
  "32",
  "-analyzeduration",
  "0",
  "-f",
  "s16le",
  "-ar",
  String(SAMPLE_RATE),
  "-ch_layout",
  "stereo",
  "-i",
  "pipe:0",
  "-c:a",
  "libmp3lame",
  "-b:a",
  "192k",
  "-flush_packets",
  "1",
  "-f",
  "mp3",
  "pipe:1",
];

export const CATCH_UP_MODES: readonly CatchUp[] = ["off", "quiet", "skip"];
export const CATCH_UP_MARGIN_SECONDS = 1.5;
export const HISTORY_SECONDS = 10;
export const MAX_START_BUFFER_SECONDS = 8;
export const REPORT_DELAY_SECONDS = 0.3;
export const WAITED_MS = 1000;
export const QUIET_PEAK = 64;

export const CHIME_LOOP_MS = 1500;
export const CHIME_NOTES = [
  { at: 0, hz: 880 },
  { at: 0.3, hz: 659.25 },
] as const;
export const CHIME_GAIN = 0.4;

export const PTP_PORTS = [319, 320] as const;
export const MDNS_PORT = 5353;
export const DOCKER_BRIDGE_ADDRESS = /^172\.(1[6-9]|2\d|3[01])\./;

export const TOPIC_PREFIX = "avb";
export const RAW_METADATA_CODE = /^[A-Za-z0-9]{4}$/;
export const EVENT_BUS_HOST = "127.0.0.1";

export const DBUS_SOCKET = "/run/dbus/system_bus_socket";
export const DBUS_START_TIMEOUT_MS = 5000;
export const AVAHI_PID_FILE = "/run/avahi-daemon/pid";
export const AVAHI_READY_TIMEOUT_MS = 10_000;
export const AVAHI_LOG_FILTER = /startup complete|another|error|fail|warn|Joining|allow-interfaces/i;
export const NQPTP_BIND_ERROR = /bind|address already in use/i;

export const SHAIRPORT_NQPTP_NAME_MAX = 63;
export const RECEIVER_ID_MAX = 24;
