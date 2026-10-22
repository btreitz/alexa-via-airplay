"use client";

import { MAX_VOLUME, MIN_VOLUME } from "@bridge/alexa/constants.ts";
import { Volume1Icon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function VolumeControl({
  value,
  onChange,
  onCommit,
  disabled,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  disabled?: boolean;
  label: string;
}) {
  const Icon = value === 0 ? VolumeXIcon : value < 50 ? Volume1Icon : Volume2Icon;
  return (
    <SliderPrimitive.Root
      min={MIN_VOLUME}
      max={MAX_VOLUME}
      step={5}
      value={[value]}
      disabled={disabled}
      onValueChange={([v]) => onChange(v)}
      onValueCommit={([v]) => onCommit(v)}
      className={cn(
        "relative flex h-10 w-full touch-none items-center overflow-hidden rounded-lg bg-muted select-none",
        "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 data-[disabled]:opacity-50",
        !disabled && "cursor-grab active:cursor-grabbing",
      )}
    >
      <SliderPrimitive.Track className="absolute inset-0">
        <SliderPrimitive.Range className="absolute h-full bg-foreground/85" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={label} className="block h-10 w-0 outline-none" />
      <span className="pointer-events-none absolute inset-x-3 flex items-center justify-between text-white mix-blend-difference">
        <Icon className="size-4" />
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </span>
    </SliderPrimitive.Root>
  );
}
