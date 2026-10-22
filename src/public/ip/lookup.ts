import http from "node:http";
import https from "node:https";
import net from "node:net";
import { LOOKUP_TIMEOUT_MS, MAX_TRACE_BYTES } from "../constants.ts";
import { parseTrace } from "./address.ts";
import type { IpFamily } from "../types.ts";

export function lookupPublicIp(url: string, family: IpFamily): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const options = {
      family,
      timeout: LOOKUP_TIMEOUT_MS,
      headers: { "user-agent": "alexa-via-airplay" },
    };
    const req = client.get(url, options, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        body += chunk;
        if (body.length > MAX_TRACE_BYTES) req.destroy(new Error("response too large"));
      });
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const ip = parseTrace(body);
        if (!ip || net.isIP(ip) !== family) {
          return reject(new Error(`no IPv${family} address in the response`));
        }
        resolve(ip);
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}
