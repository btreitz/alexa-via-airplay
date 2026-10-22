import { AudioPlayerPart } from "@/components/steps/skill/parts/audio-player";
import { CodePart } from "@/components/steps/skill/parts/code";
import { CreatePart } from "@/components/steps/skill/parts/create";
import { InteractionModelPart } from "@/components/steps/skill/parts/interaction-model";
import { TestingPart } from "@/components/steps/skill/parts/testing";
import type { SkillResponse } from "@/lib/api";
import type { SkillPart } from "@/lib/types";

export function SkillPartContent({
  part,
  skill,
  invocationName,
}: {
  part: SkillPart;
  skill: SkillResponse | null;
  invocationName: string;
}) {
  switch (part) {
    case "create":
      return <CreatePart />;
    case "interaction-model":
      return <InteractionModelPart skill={skill} invocationName={invocationName} />;
    case "audio-player":
      return <AudioPlayerPart />;
    case "code":
      return <CodePart skill={skill} />;
    case "testing":
      return <TestingPart />;
  }
}
