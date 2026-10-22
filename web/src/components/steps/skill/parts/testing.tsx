import { Instructions } from "@/components/steps/skill/instructions";

export function TestingPart() {
  return (
    <Instructions path={["Test"]}>
      <p>
        Set <b>Skill testing is enabled in</b> to <b>Development</b>. That makes the skill available
        on the Echos of your account.
      </p>
      <p className="text-muted-foreground">
        The simulator in the console can&apos;t play audio. You test on a real Echo in the next
        step.
      </p>
    </Instructions>
  );
}
