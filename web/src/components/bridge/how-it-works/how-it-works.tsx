import { NarrowFlow } from "@/components/bridge/how-it-works/narrow-flow";
import { WideFlow } from "@/components/bridge/how-it-works/wide-flow";

export function HowItWorks() {
  return (
    <figure className="space-y-3">
      <WideFlow />
      <NarrowFlow />
      <figcaption className="text-xs text-muted-foreground">
        Echos only play audio from public HTTPS addresses, which is why the stream takes the detour
        through your public URL. Only your own Echos can play it.
      </figcaption>
    </figure>
  );
}
