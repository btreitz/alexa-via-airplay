import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SkillStep } from "@/components/steps/skill-step";
import { SKILL_PARTS, type SkillPart } from "@/lib/setup";

// A static export needs every part known at build time.
export const dynamicParams = false;

export function generateStaticParams() {
  return SKILL_PARTS.map((p) => ({ part: p.slug }));
}

export const metadata: Metadata = { title: "Alexa skill" };

export default async function Page({ params }: PageProps<"/setup/skill/[part]">) {
  const { part } = await params;
  if (!SKILL_PARTS.some((p) => p.slug === part)) notFound();
  return <SkillStep part={part as SkillPart} />;
}
