import { TEST_SECONDS, TEST_VOLUME } from "@bridge/bridge/constants.ts";
import type { SkillPart, StepId } from "@/lib/types";

export const REPO_URL = "https://github.com/btreitz/alexa-via-airplay";
export const SETUP_GUIDE_URL = `${REPO_URL}/blob/main/SETUP.md`;
export const DEVELOPER_CONSOLE_URL = "https://developer.amazon.com/alexa/console/ask";

export const POLL_MS = 2000;
export const DEVICES_EVERY_MS = 10_000;
export const COPY_FEEDBACK_MS = 2500;
export const MAX_IMPORT_FILE_BYTES = 60 * 1024;
export const DEFAULT_VOLUME = 30;
export const SKILL_DEPLOYED_KEY = "avb.skillDeployed";
export const MOBILE_BREAKPOINT = 768;

export const TEST_EXPLANATION = `Plays a chime on this Echo for ${TEST_SECONDS} s at volume ${TEST_VOLUME}, the same way AirPlay audio travels: through your skill and the public URL. If you hear it, the connection works.`;

export const OFFLINE_MESSAGE = "The bridge doesn't answer. Is the container running?";
export const TEXT_LINK_CLASS = "text-primary underline underline-offset-4";
export const FACT_COLUMNS = "grid-cols-[14rem_1fr]";
export const ECHO_COLUMNS =
  "grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 md:grid-cols-[2.5rem_minmax(0,1fr)_12rem_9.5rem_9rem]";

export const HREF = {
  intro: "/setup",
  url: "/setup/public-url",
  amazon: "/setup/amazon",
  skill: "/setup/skill/create",
  echos: "/setup/echos",
  speakers: "/speakers",
  settings: "/settings",
  diagnostics: "/diagnostics",
} as const;

export const SKILL_PARTS = [
  { slug: "create", label: "Create" },
  { slug: "interaction-model", label: "Interaction model" },
  { slug: "audio-player", label: "Audio Player" },
  { slug: "code", label: "Code" },
  { slug: "testing", label: "Testing" },
] as const;

export const STEP_TITLES: Record<StepId, string> = {
  url: "Public URL",
  amazon: "Amazon account",
  skill: "Alexa skill",
  echos: "Echos",
};

export const SKILL_PARTS_WITH_FILES: readonly SkillPart[] = ["interaction-model", "code"];
