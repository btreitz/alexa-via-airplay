import assert from "node:assert/strict";
import { test } from "node:test";
import { redact } from "../../src/alexa/redact.ts";

test("redact strips tokens and cookies", () => {
  const out = redact(
    '{"refreshToken":"Atnr|secret","localCookie":"session-id=123; x-main=abc"} csrf=999 Atza|tok',
  );
  assert.doesNotMatch(out, /secret|123|abc|999|tok\b/);
});
