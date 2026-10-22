import type net from "node:net";

export function listeningPort(server: net.Server | undefined): number | null {
  const address = server?.address();
  return address && typeof address === "object" ? address.port : null;
}
