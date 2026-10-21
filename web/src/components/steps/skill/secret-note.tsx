import { Disclosure } from "@/components/common/disclosure";
import { TextLink } from "@/components/common/text-link";
import { HREF } from "@/lib/routes";

export function SecretNote() {
  return (
    <Disclosure
      title="About the signing secret in this code"
      contentClassName="text-muted-foreground space-y-2 text-sm"
    >
      <p>
        The skill signs every stream link it hands to an Echo, and the bridge only serves links with
        a valid signature. So nobody can play your stream by guessing its address.
      </p>
      <p>
        The secret is 32 random bytes that the bridge generated on its first start. It lives only in
        the bridge&apos;s data volume and in this code. You can&apos;t pick it yourself: if the code
        leaked, replace it with a new random one under{" "}
        <TextLink href={HREF.settings}>Settings → Rotate</TextLink>, then paste the code here again.
      </p>
    </Disclosure>
  );
}
