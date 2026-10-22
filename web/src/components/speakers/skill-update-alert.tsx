import { InfoIcon } from "lucide-react";
import { TextLink } from "@/components/common/links/text-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { skillPartHref } from "@/lib/setup/routes";

export function SkillUpdateAlert() {
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>Update the skill code</AlertTitle>
      <AlertDescription>
        <p>
          Your skill doesn&apos;t report playback to the bridge yet. With the new code,
          &ldquo;Alexa, stop&rdquo; pauses your phone at once, and the Echo starts sooner and plays
          less behind. <TextLink href={skillPartHref("code")}>Paste the new code</TextLink>, then
          Save and Deploy.
        </p>
      </AlertDescription>
    </Alert>
  );
}
