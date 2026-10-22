import { HREF } from "@/lib/constants";
import type { SkillPart, ViewId } from "@/lib/types";

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
