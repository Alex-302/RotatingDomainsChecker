/**
 * DNS Resolver Test — проверяет DNS резолв используя dns.Resolver с принудительными DNS серверами
 *
 * Запуск: node test-dns-resolvers.mjs
 */

import dns from 'node:dns';
import { Resolver } from 'node:dns/promises';

// Принудительные DNS серверы (Google + Cloudflare)
const FORCED_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

// Используем dns.Resolver с явным указанием серверов вместо глобального dns.resolve
const customResolver = new Resolver();
customResolver.setServers(FORCED_DNS_SERVERS);

const dnsResolve = customResolver.resolve.bind(customResolver);

async function testDomain(domain, timeoutMs = 3000) {
  const start = Date.now();
  try {
    const result = await Promise.race([
      dnsResolve(domain),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DNS timeout')), timeoutMs)
      )
    ]);

    if (result instanceof Error) {
      return {
        domain,
        resolved: false,
        latencyMs: Date.now() - start,
        error: result.message
      };
    }

    return {
      domain,
      resolved: true,
      latencyMs: Date.now() - start,
      addresses: result
    };
  } catch (err) {
    return {
      domain,
      resolved: false,
      latencyMs: Date.now() - start,
      error: err.code || err.message || 'Unknown error'
    };
  }
}

async function main() {
  const groups = {
    'Major sites (should resolve)': [
      'google.com',
      'github.com',
      'cloudflare.com',
      'amazon.com',
      'microsoft.com',
      'apple.com',
      'youtube.com',
      'facebook.com',
    ],
    'Failed in logs (should resolve)': [
      'dizipal1243.com',
      'dizipal1553.com',
      'turkifsaclub123.sbs',
      'piabettv18.live',
      'piabettv20.live',
      'voe.sx',
      'ericeastweight.com',
      'papazsports1013.pro',
      't.co',
    ],
    'Heuristic candidates (failed in logs)': [
      'dizipal1244.com',
      'dizipal1554.com',
      'turkifsaclub124.sbs',
      'piabettv19.live',
      'papazsports923.pro',
    ],
  };

  const allResults = [];
  const TIMEOUT = 3000;

  console.log('='.repeat(80));
  console.log('DNS Resolver Test — Using dns.Resolver with custom servers');
  console.log('='.repeat(80));
  console.log(`DNS Servers: ${FORCED_DNS_SERVERS.join(', ')}`);
  console.log(`Timeout: ${TIMEOUT}ms per domain`);
  console.log('');

  for (const [groupName, domains] of Object.entries(groups)) {
    console.log(`\n📋 ${groupName}`);
    console.log('-'.repeat(60));

    for (const domain of domains) {
      const result = await testDomain(domain, TIMEOUT);
      allResults.push(result);

      const status = result.resolved ? '✅ OK' : `❌ FAIL (${result.error})`;
      const addresses = result.addresses
        ? ` → ${result.addresses.slice(0, 3).join(', ')}${result.addresses.length > 3 ? '...' : ''}`
        : '';
      console.log(`  [${result.latencyMs}ms] ${status}  ${domain}${addresses}`);
    }
  }

  const resolved = allResults.filter(r => r.resolved).length;
  const failed = allResults.filter(r => !r.resolved).length;
  const avgLatency = allResults.reduce((sum, r) => sum + r.latencyMs, 0) / allResults.length;

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total:    ${allResults.length}`);
  console.log(`Resolved: ${resolved} (${Math.round(resolved / allResults.length * 100)}%)`);
  console.log(`Failed:   ${failed} (${Math.round(failed / allResults.length * 100)}%)`);
  console.log(`Avg RTT:  ${avgLatency.toFixed(1)}ms`);

  const resolvedDomains = allResults.filter(r => r.resolved);
  if (resolvedDomains.length > 0) {
    console.log('\n✅ Resolved domains:');
    for (const r of resolvedDomains) {
      const ips = (r.addresses || []).join(', ') || '(no IPs)';
      console.log(`  ${r.domain} [${r.latencyMs}ms] → ${ips}`);
    }
  }

  if (failed > 0) {
    const failedDomains = allResults.filter(r => !r.resolved);
    console.log('\n❌ Failed domains:');
    for (const r of failedDomains) {
      console.log(`  ${r.domain}: ${r.error} (${r.latencyMs}ms)`);
    }
  }

  console.log('\n🔍 DNS server info:');
  console.log(`  Custom Resolver servers: ${customResolver.getServers().join(', ')}`);
  try {
    const defaultServers = dns.getServers();
    console.log(`  System DNS servers:    ${defaultServers.join(', ') || '(none shown)'}`);
  } catch (e) {
    console.log(`  Could not get system DNS servers: ${e.message}`);
  }

  // Check if it's a broken DNS resolver, not a domain issue:
  const majorSites = ['google.com', 'cloudflare.com', 'github.com'];
  const majorSiteFailed = allResults
    .filter(r => majorSites.includes(r.domain) && !r.resolved);

  if (majorSiteFailed.length > 0) {
    const errors = majorSiteFailed.map(r => `${r.domain}: ${r.error}`).join(', ');
    const servers = customResolver.getServers().join(', ');
    const errMsg = majorSiteFailed[0].error;
    const isRefused = errMsg === 'ECONNREFUSED';
    const hint = isRefused
      ? `DNS server ${servers} is refusing connections.`
      : `DNS lookup failed for major sites — possible network/DNS outage.`;
    throw new Error(
      `FATAL: DNS resolver is broken — ${hint}\nFailed: ${errors}`
    );
  }

  if (failed > allResults.length * 0.5) {
    console.log('\n⚠️  More than half of domains failed!');
    console.log('This might be a DNS resolver issue on this machine.');
  }
}

main().catch(err => {
  console.error('\n' + '='.repeat(80));
  console.error('FATAL ERROR:', err.message);
  console.error('='.repeat(80));
  process.exit(1);
});
