export interface Config {
  dataDir: string;
  runDir: string;
  publicPort: number;
  publicBind: string;
  uiPort: number;
  uiBind: string;
  alexaProxyPort: number;
  airplayBasePort: number;
  eventBusPort: number;
  publicBaseUrl?: string;
  avahiInterfaces?: string;
  manageReceivers: boolean;
  publicIpTraceUrl: string;
  publicIpRefreshSeconds: number;
  ipv6PrefixLength: number;
  clientIpHeader: string | null;
  trustedProxies: string[];
  webDir: string;
  uiDevOrigin: string | null;
}
