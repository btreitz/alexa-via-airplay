import { ExternalLinkIcon } from "lucide-react";
import { DefinitionList } from "@/components/common/definition-list";
import { ExternalLink } from "@/components/common/external-link";
import { Instructions } from "@/components/steps/skill/instructions";
import { DEVELOPER_CONSOLE_URL } from "@/lib/constants";
import type { Fact } from "@/lib/types";

const CHOICES: Fact[] = [
  ["Name", "Anything, e.g. Sound Bridge"],
  ["Primary locale", "The language of your Echos"],
  ["Experience", "Other"],
  ["Model", "Custom"],
  ["Hosting", "Alexa-hosted (Node.js)"],
  ["Template", "Start from Scratch"],
];

export function CreatePart() {
  return (
    <Instructions>
      <p>
        Open the{" "}
        <ExternalLink
          className="text-primary underline underline-offset-4"
          href={DEVELOPER_CONSOLE_URL}
        >
          Alexa developer console <ExternalLinkIcon className="inline size-3.5" />
        </ExternalLink>{" "}
        with the Amazon account that owns your Echos, choose <b>Create Skill</b> and pick:
      </p>
      <DefinitionList rows={CHOICES} />
    </Instructions>
  );
}
