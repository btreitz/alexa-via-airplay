import { Disclosure } from "@/components/common/layout/disclosure";

export function PublicUrlHelp() {
  return (
    <Disclosure
      title="How do I get a public URL?"
      contentClassName="text-muted-foreground space-y-2 text-sm"
    >
      <p>The easiest way is a Cloudflare Tunnel on a domain you have on Cloudflare:</p>
      <ol className="list-decimal space-y-1 pl-4">
        <li>Zero Trust → Networks → Tunnels: create a tunnel, choose Docker, copy the token.</li>
        <li>
          Add a public hostname, e.g. airplay.example.com, with service{" "}
          <code className="text-foreground">http://localhost:8099</code>.
        </li>
        <li>
          Run cloudflared with that token on this host, with host networking, e.g. as its own Docker
          Compose stack. The bridge doesn&apos;t run it for you.
        </li>
      </ol>
      <p>
        Any other HTTPS reverse proxy to port 8099 works too. Details, with a compose file for
        cloudflared, are in SETUP.md.
      </p>
    </Disclosure>
  );
}
