import { CodeBlock } from "@/components/common/code-block";
import { Instructions } from "@/components/steps/skill/instructions";
import { InvocationNameForm } from "@/components/steps/skill/invocation-name-form";
import { LoadingFiles } from "@/components/steps/skill/loading-files";
import type { SkillResponse } from "@/lib/api";

export function InteractionModelPart({
  skill,
  invocationName,
}: {
  skill: SkillResponse | null;
  invocationName: string;
}) {
  return (
    <div className="space-y-4">
      <Instructions path={["Build", "Interaction Model", "JSON Editor"]}>
        <p>
          Replace everything in the editor with this, then press <b>Save</b>.
        </p>
      </Instructions>
      {skill ? (
        <CodeBlock label="Interaction model (JSON)" code={skill.interactionModel} lang="json" />
      ) : (
        <LoadingFiles />
      )}
      <InvocationNameForm invocationName={invocationName} />
    </div>
  );
}
