export function defaultReceiverName(echoName: string): string {
  return `${echoName} (Alexa)`;
}

export function nextFreePort(used: number[], base: number): number {
  let port = base;
  while (used.includes(port)) port++;
  return port;
}
