"use client";

// A volume bar in the style of the iOS Control Center: the fill is the volume,
// the icon and number sit inside. Built on the same Radix slider as the plain
// slider, so dragging, clicking and the arrow keys all work.

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
      min={0}
      max={100}
      step={5}
      value={[value]}
      disabled={disabled}
      onValueChange={([v]) => onChange(v)}
      onValueCommit={([v]) => onCommit(v)}
      className={cn(
        "bg-muted relative flex h-10 w-full touch-none items-center overflow-hidden rounded-lg select-none",
        "has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-3 data-[disabled]:opacity-50",
        !disabled && "cursor-grab active:cursor-grabbing",
      )}
    >
      <SliderPrimitive.Track className="absolute inset-0">
        <SliderPrimitive.Range className="bg-foreground/85 absolute h-full" />
      </SliderPrimitive.Track>
      {/* Thin and invisible: the fill already shows the position. It carries focus and the keyboard. */}
      <SliderPrimitive.Thumb aria-label={label} className="block h-10 w-0 outline-none" />
      {/* difference blending keeps the icon and number readable on the fill and on the empty part */}
      <span className="pointer-events-none absolute inset-x-3 flex items-center justify-between text-white mix-blend-difference">
        <Icon className="size-4" />
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </span>
    </SliderPrimitive.Root>
  );
}
