import { ExternalLinkIcon } from "lucide-react";
import { DefinitionList } from "@/components/common/layout/definition-list";
import { ExternalLink } from "@/components/common/links/external-link";
import { Instructions } from "@/components/steps/skill/instructions";
import { DEVELOPER_CONSOLE_URL, TEXT_LINK_CLASS } from "@/lib/constants";
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
        <ExternalLink className={TEXT_LINK_CLASS} href={DEVELOPER_CONSOLE_URL}>
          Alexa developer console <ExternalLinkIcon className="inline size-3.5" />
        </ExternalLink>{" "}
        with the Amazon account that owns your Echos, choose <b>Create Skill</b> and pick:
      </p>
      <DefinitionList rows={CHOICES} />
    </Instructions>
  );
}
