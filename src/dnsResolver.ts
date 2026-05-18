import { Resolver } from 'node:dns/promises';

export const FORCED_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'] as const;

const forcedDnsResolver = new Resolver();
forcedDnsResolver.setServers([...FORCED_DNS_SERVERS]);

export function getForcedDnsServers(): string[] {
  return forcedDnsResolver.getServers();
}

export async function resolveHostname(hostname: string, timeoutMs?: number): Promise<string[]> {
  const resolvePromise = forcedDnsResolver.resolve(hostname);

  if (timeoutMs === undefined) {
    return resolvePromise;
  }

  return Promise.race([
    resolvePromise,
    new Promise<string[]>((_, reject) => {
      setTimeout(() => reject(new Error('DNS timeout')), timeoutMs);
    }),
  ]);
}