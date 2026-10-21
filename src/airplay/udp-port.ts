import dgram from "node:dgram";

export function udpPortFree(port: number, type: "udp4" | "udp6" = "udp4"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type, reuseAddr: false });
    socket.once("error", (err: NodeJS.ErrnoException) => {
      socket.close();
      resolve(err.code !== "EADDRINUSE");
    });
    socket.bind(port, () => socket.close(() => resolve(true)));
  });
}
