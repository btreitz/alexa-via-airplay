import type { LucideIcon } from "lucide-react";
import type { HREF, SKILL_PARTS } from "@/lib/constants";
import type { ReceiverView } from "@/lib/api";

export type Tone = "ok" | "warn" | "bad";

export type Fact = [label: string, value: string];

export type ViewId = keyof typeof HREF;

export type SkillPart = (typeof SKILL_PARTS)[number]["slug"];

export type StepId = "url" | "amazon" | "skill" | "echos";

export interface Step {
  id: StepId;
  number: number;
  title: string;
  summary: string;
  done: boolean;
}

export interface EchoRow {
  serial: string;
  name: string;
  online: boolean | null;
  model: string | null;
  receiver?: ReceiverView;
}

export type SpeakerStateKind =
  "not-running" | "test-starting" | "test-playing" | "playing" | "starting" | "paused" | "ready";

export interface SpeakerState {
  kind: SpeakerStateKind;
  text: string;
}

export type ReadResult = { ok: true; file: unknown } | { ok: false; message: string };

export interface FlowNodeInfo {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface FooterAction {
  label: string;
  href?: string;
  onClick?: () => void;
  secondary?: boolean;
}
