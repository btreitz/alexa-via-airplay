const NEEDS: [title: string, text: string][] = [
  [
    "Public URL",
    "An HTTPS address that reaches this bridge, e.g. a Cloudflare Tunnel on a domain of yours. Step 1 explains how to set one up.",
  ],
  [
    "Amazon account",
    "The account your Echos belong to. You sign in once; the bridge keeps the session.",
  ],
  [
    "Alexa skill",
    "A private skill in the Alexa developer console, with the same Amazon account. You paste two files the bridge generates; it is never published.",
  ],
  [
    "Echos",
    "Choose which Echos appear as AirPlay speakers, let the bridge identify them, and play a test sound.",
  ],
];

export function SetupNeeds() {
  return (
    <ol className="divide-y rounded-lg border">
      {NEEDS.map(([title, text], i) => (
        <li key={title} className="flex gap-4 px-4 py-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs text-muted-foreground tabular-nums">
            {i + 1}
          </span>
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{title}</div>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
