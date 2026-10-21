"use client";

import { DownloadIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/bridge/confirm-button";
import { Section, ViewHeader } from "@/components/shell/view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useBridge } from "@/hooks/use-bridge";
import { setSkillConfirmed } from "@/hooks/use-skill-confirmed";
import { useSyncedState } from "@/hooks/use-synced-state";
import { api, type CatchUp, type Preset, type SettingsUpdate } from "@/lib/api";

const CATCH_UP: { value: CatchUp; label: string }[] = [
  { value: "quiet", label: "In pauses and silence" },
  { value: "skip", label: "Right away" },
  { value: "off", label: "Off" },
];

const PRESETS: { value: Preset; label: string; description: string }[] = [
  { value: "low-latency", label: "Low latency", description: "For video and games: the Echo catches up right away and stays connected through pauses of up to 10 minutes." },
  { value: "balanced", label: "Balanced", description: "For music: the Echo catches up in pauses and silence, and stops after a minute of pause." },
  { value: "uninterrupted", label: "Uninterrupted", description: "For podcasts and audiobooks: no audio is ever left out, so the Echo stays a few seconds behind." },
  { value: "custom", label: "Custom", description: "Set the pause and the catch-up below yourself." },
];

/** Label and explanation on the left, the control on the right: the same for every setting. */
function Row({ label, htmlFor, description, children }: { label: string; htmlFor?: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-8 px-4 py-4">
      <div className="space-y-1">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title}>
      <div className="divide-y rounded-lg border">{children}</div>
    </Section>
  );
}

export function SettingsPage() {
  const { status, devices, run } = useBridge();
  const [idle, setIdle, idleState] = useSyncedState(String(status?.settings.idleTimeoutSeconds ?? 60));
  if (!status) return null;
  const { settings, alexa } = status;
  const custom = settings.preset === "custom";
  const preset = PRESETS.find((option) => option.value === settings.preset);

  // Switches apply at once; there is no separate save step to forget.
  const save = (update: SettingsUpdate) => run(() => api.updateSettings(update), "Saved");

  async function commitIdle() {
    if (!idleState.dirty) return;
    if (Number(idle) !== settings.idleTimeoutSeconds) await save({ idleTimeoutSeconds: Number(idle) });
    idleState.reset();
  }

  async function exportSettings() {
    const file = await run(() => api.exportSettings());
    if (!file) return;
    const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `alexa-via-airplay-settings-${file.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function rotate() {
    const done = await run(() => api.rotateSecret());
    if (!done) return;
    setSkillConfirmed(false);
    toast.success("Secret rotated. Paste the new skill code in step 3, Code.");
  }

  return (
    <>
      <ViewHeader eyebrow="Bridge" title="Settings" description="Changes apply immediately." />
      <div className="space-y-8">
        <Group title="Playback">
          <Row
            label="Preset"
            htmlFor="preset"
            description={custom ? preset?.description : `${preset?.description} The pause and catch-up below follow it; choose Custom to change them.`}
          >
            <Select value={settings.preset} onValueChange={(value) => save({ preset: value as Preset })}>
              <SelectTrigger id="preset" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Stop the Echo after a pause of" htmlFor="idle" description="How long AirPlay may stay paused before the Echo stops.">
            <Input
              id="idle"
              type="number"
              min={10}
              max={3600}
              className="w-24"
              disabled={!custom}
              value={idle}
              onChange={(e) => setIdle(e.target.value)}
              onBlur={commitIdle}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <span className="text-muted-foreground text-sm">seconds</span>
          </Row>
          <Row label="Volume follows AirPlay" htmlFor="forward-volume" description="Changing the volume on your iPhone or Mac sets it on the Echo.">
            <Switch id="forward-volume" checked={settings.forwardVolume} onCheckedChange={(on) => save({ forwardVolume: on })} />
          </Row>
          <Row
            label="Catch up on the delay"
            htmlFor="catch-up"
            description={
              <>
                The Echo buffers a few seconds, so it plays behind your phone. Once it plays, the bridge can leave out a little audio until the Echo is
                only about 1.5 s behind: in pauses and silence (nothing audible is lost), or right away (one short jump in the music). Needs the
                current skill code.
              </>
            }
          >
            <Select value={settings.catchUp} disabled={!custom} onValueChange={(value) => save({ catchUp: value as CatchUp })}>
              <SelectTrigger id="catch-up" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATCH_UP.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </Group>

        <Group title="Security">
          <Row
            label="Only serve this home's public IP"
            htmlFor="restrict-ip"
            description="Turn off only if your Echos reach the internet through another IP (VPN, second uplink). Behind CGNAT it protects less."
          >
            <Switch id="restrict-ip" checked={settings.restrictToHomeIp} onCheckedChange={(on) => save({ restrictToHomeIp: on })} />
          </Row>
          <Row label="Signing secret" description="Rotate it if the skill code leaked. Echos can't play until you paste the new skill code.">
            <ConfirmButton
              variant="outline"
              title="Rotate the signing secret?"
              description="Echos can't play until you paste the new skill code and deploy it."
              confirmLabel="Rotate secret"
              onConfirm={rotate}
            >
              Rotate
            </ConfirmButton>
          </Row>
        </Group>

        <Group title="Move to another host">
          <Row
            label="Export settings"
            description={
              <>
                A .json file with everything this bridge has set up: the public URL, the skill&apos;s invocation name and signing secret, the Amazon
                site, your speakers (names and AirPlay IDs) and which Echo is which, and the playback and security settings. Import it at the start
                of the setup on the new host. Not included: the Amazon sign-in and the tunnel token in .env. The file contains the signing secret:
                keep it private.
              </>
            }
          >
            <Button variant="outline" onClick={exportSettings}>
              <DownloadIcon /> Export
            </Button>
          </Row>
        </Group>

        <Group title="Amazon account">
          <Row
            label={alexa.status === "ready" ? `Signed in on ${status.amazonPage ?? "Amazon"}` : "Not signed in"}
            description={alexa.status === "ready" ? `${devices.length} Echo${devices.length === 1 ? "" : "s"} on this account.` : "Sign in in step 2."}
          >
            {alexa.status === "ready" && (
              <>
                <Button variant="outline" onClick={() => run(() => api.refreshDevices(), "Echo list refreshed")}>
                  Refresh Echos
                </Button>
                <ConfirmButton
                  variant="outline"
                  title="Sign out of Amazon?"
                  description="The bridge can't start your Echos until you sign in again."
                  confirmLabel="Sign out"
                  onConfirm={() => run(() => api.logout())}
                >
                  Sign out
                </ConfirmButton>
              </>
            )}
          </Row>
        </Group>
      </div>
    </>
  );
}
