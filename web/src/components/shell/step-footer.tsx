import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { FooterButton, type FooterAction } from "@/components/shell/footer-button";

export function StepFooter({ back, next }: { back?: FooterAction; next?: FooterAction }) {
  return (
    <footer className="mt-10 flex items-center justify-between border-t pt-6">
      <div>
        {back && (
          <FooterButton action={back} variant="ghost">
            <ArrowLeftIcon /> {back.label}
          </FooterButton>
        )}
      </div>
      <div>
        {next && (
          <FooterButton action={next} variant={next.secondary ? "outline" : "default"}>
            {next.label} <ArrowRightIcon />
          </FooterButton>
        )}
      </div>
    </footer>
  );
}

export function continueAction(done: boolean, href: string, label = "Continue"): FooterAction {
  return { label: done ? label : "Skip for now", secondary: !done, href };
}
