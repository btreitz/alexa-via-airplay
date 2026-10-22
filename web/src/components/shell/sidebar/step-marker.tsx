import { CheckIcon } from "lucide-react";
import { StepCircle } from "@/components/common/step-circle";
import type { Step } from "@/lib/types";

export function StepMarker({ step, current }: { step: Step; current: boolean }) {
  return (
    <StepCircle state={step.done ? "done" : current ? "current" : "idle"}>
      {step.done ? <CheckIcon className="size-3.5!" /> : step.number}
    </StepCircle>
  );
}
