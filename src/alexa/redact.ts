const SECRET_FIELDS =
  /("?(?:cookie|localCookie|csrf|refreshToken|accessToken|access_token|macDms|adp_token|device_private_key|loginCookie|frc|map-md|token|authorization_code|code_verifier)"?\s*[:=]\s*)("[^"]*"|[^,;\s}]+)/gi;
const SECRET_COOKIES =
  /(Atna\||Atza\||x-main=|at-main=|sess-at-main=|session-id=|ubid-[a-z]+=)[^;"\s]+/gi;

export function redact(message: string): string {
  return message.replace(SECRET_FIELDS, "$1<redacted>").replace(SECRET_COOKIES, "$1<redacted>");
}
