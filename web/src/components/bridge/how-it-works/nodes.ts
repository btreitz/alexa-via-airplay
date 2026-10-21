import { CloudIcon, ServerIcon, SmartphoneIcon, SpeakerIcon, type LucideIcon } from "lucide-react";

export interface FlowNodeInfo {
  icon: LucideIcon;
  title: string;
  text: string;
}

export const NODES = {
  sender: {
    icon: SmartphoneIcon,
    title: "iPhone or Mac",
    text: "Pick the Echo like any AirPlay speaker",
  },
  bridge: {
    icon: ServerIcon,
    title: "This bridge",
    text: "One AirPlay speaker per Echo, on your network",
  },
  echo: { icon: SpeakerIcon, title: "Echo", text: "Plays the audio through your Alexa skill" },
  amazon: {
    icon: CloudIcon,
    title: "Amazon",
    text: "Tells the Echo to open your skill, sets its volume",
  },
} satisfies Record<string, FlowNodeInfo>;

export const AUDIO_PATH = ["sender", "bridge", "echo"] as const;
export const LOCAL_HOP = "AirPlay, on your network";
export const PUBLIC_HOP = "Audio, through your public HTTPS URL";
