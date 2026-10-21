import { TEST_SECONDS, TEST_VOLUME } from "@bridge/bridge/constants.ts";

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
