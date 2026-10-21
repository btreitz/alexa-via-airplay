// The bridge at a glance: audio goes iPhone → bridge → (public URL) → Echo,
// commands go bridge → Amazon → Echo. Plain markup, so it follows the theme.

import { ArrowDownIcon, ArrowRightIcon, CloudIcon, ServerIcon, SmartphoneIcon, SpeakerIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

function Node({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="bg-card flex flex-col items-center gap-2 rounded-xl border p-4 text-center">
      <span className="bg-muted text-foreground grid size-10 place-items-center rounded-lg">
        <Icon className="size-5" />
      </span>
      <div className="text-sm font-medium">{title}</div>
      <p className="text-muted-foreground text-xs leading-snug">{children}</p>
    </div>
  );
}

/** A labelled arrow between two nodes. */
function Arrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-2">
      <span className="text-muted-foreground text-center text-xs leading-tight">{children}</span>
      <span className="flex w-full items-center">
        <span className="bg-muted-foreground/50 h-px flex-1" />
        <ArrowRightIcon className="text-muted-foreground -ml-1 size-4" />
      </span>
    </div>
  );
}

const NODES = {
  sender: { icon: SmartphoneIcon, title: "iPhone or Mac", text: "Pick the Echo like any AirPlay speaker" },
  bridge: { icon: ServerIcon, title: "This bridge", text: "One AirPlay speaker per Echo, on your network" },
  echo: { icon: SpeakerIcon, title: "Echo", text: "Plays the audio through your Alexa skill" },
  amazon: { icon: CloudIcon, title: "Amazon", text: "Tells the Echo to open your skill, sets its volume" },
};

export function HowItWorks() {
  return (
    <figure className="space-y-3">
      {/* Wide screens: the audio path in a row, the command path looping underneath. */}
      <div className="hidden grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_8rem_minmax(0,1fr)] md:grid">
        <Node icon={NODES.sender.icon} title={NODES.sender.title}>
          {NODES.sender.text}
        </Node>
        <Arrow>AirPlay, on your network</Arrow>
        <Node icon={NODES.bridge.icon} title={NODES.bridge.title}>
          {NODES.bridge.text}
        </Node>
        <Arrow>Audio, through your public HTTPS URL</Arrow>
        <Node icon={NODES.echo.icon} title={NODES.echo.title}>
          {NODES.echo.text}
        </Node>

        {/* From the bridge's centre down, along to the Echo's centre and up: the command path. */}
        <div className="relative col-span-3 col-start-3 h-28">
          <div className="border-muted-foreground/50 absolute inset-x-[calc((100%-8rem)/4)] top-0 h-12 rounded-b-xl border-x border-b border-dashed" />
          <div className="absolute inset-x-0 top-6 flex justify-center">
            <div className="bg-card flex max-w-64 items-center gap-3 rounded-xl border px-4 py-3">
              <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-lg">
                <CloudIcon className="size-4" />
              </span>
              <div>
                <div className="text-sm font-medium">{NODES.amazon.title}</div>
                <p className="text-muted-foreground text-xs leading-snug">{NODES.amazon.text}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Narrow screens: the same as a list. */}
      <div className="flex flex-col items-stretch gap-2 md:hidden">
        {(["sender", "bridge", "echo"] as const).map((key, i) => (
          <div key={key} className="space-y-2">
            {i > 0 && (
              <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
                <ArrowDownIcon className="size-4" />
                {i === 1 ? "AirPlay, on your network" : "Audio, through your public HTTPS URL"}
              </div>
            )}
            <Node icon={NODES[key].icon} title={NODES[key].title}>
              {NODES[key].text}
            </Node>
          </div>
        ))}
        <p className="text-muted-foreground pt-1 text-center text-xs">
          Alongside, the bridge asks Amazon to open your skill on the Echo and to set its volume.
        </p>
      </div>

      <figcaption className="text-muted-foreground text-xs">
        Echos only play audio from public HTTPS addresses, which is why the stream takes the detour through your public URL. Only your own Echos
        can play it.
      </figcaption>
    </figure>
  );
}
