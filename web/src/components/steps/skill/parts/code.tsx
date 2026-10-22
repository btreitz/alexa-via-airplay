import { CodeBlock } from "@/components/common/code-block";
import { Instructions } from "@/components/steps/skill/instructions";
import { LoadingFiles } from "@/components/steps/skill/loading-files";
import { SecretNote } from "@/components/steps/skill/secret-note";
import type { SkillResponse } from "@/lib/api";

export function CodePart({ skill }: { skill: SkillResponse | null }) {
  return (
    <div className="space-y-4">
      <Instructions path={["Code", "lambda/index.js"]}>
        <p>
          Replace everything in the file with this, then press <b>Save</b> and <b>Deploy</b>.
        </p>
        <p className="text-muted-foreground">
          Besides starting the stream, the code tells the bridge when the Echo starts or stops
          playing, with a signed request to the same address. That way &ldquo;Alexa, stop&rdquo;
          pauses your phone at once. Set up the skill before this was added? Paste the code again.
        </p>
      </Instructions>
      {skill ? (
        <CodeBlock label="lambda/index.js" code={skill.indexJs} lang="javascript" secret />
      ) : (
        <LoadingFiles />
      )}
      <SecretNote />
    </div>
  );
}
