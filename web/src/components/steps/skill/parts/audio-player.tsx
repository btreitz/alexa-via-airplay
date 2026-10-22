import { Instructions } from "@/components/steps/skill/instructions";

export function AudioPlayerPart() {
  return (
    <Instructions path={["Build", "Interfaces"]}>
      <p>
        Turn on <b>Audio Player</b>, press <b>Save</b>, then <b>Build skill</b> at the top. Building
        takes a minute.
      </p>
    </Instructions>
  );
}
