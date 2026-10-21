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

export type ViewId = keyof typeof HREF;

export const SKILL_PARTS = [
  { slug: "create", label: "Create" },
  { slug: "interaction-model", label: "Interaction model" },
  { slug: "audio-player", label: "Audio Player" },
  { slug: "code", label: "Code" },
  { slug: "testing", label: "Testing" },
] as const;

export type SkillPart = (typeof SKILL_PARTS)[number]["slug"];

export function skillPartHref(slug: SkillPart): string {
  return `/setup/skill/${slug}`;
}

export function viewOf(pathname: string): ViewId | null {
  if (pathname.startsWith("/setup/skill")) return "skill";
  const entry = Object.entries(HREF).find(
    ([, href]) => pathname === href || pathname === `${href}/`,
  );
  return entry ? (entry[0] as ViewId) : null;
}
