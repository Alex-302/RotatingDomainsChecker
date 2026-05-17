/**
 * DNS Resolver Comparison Test
 *
 * Compares three DNS resolution methods:
 * 1. dns.resolve()          - Node.js custom resolver (current implementation)
 * 2. dnslookup CLI binary   - ameshkov/dnslookup (external)
 * 3. dns.lookup()           - Node.js system resolver (getaddrinfo)
 *
 * Run: node test-dns-resolvers.mjs
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lookup, resolve as dnsResolve, getServers, setServers } from 'node:dns';

const execFileAsync = promisify(execFile);
const dnsLookupAsync = promisify(lookup);

// Force DNS server for dns.resolve() tests (bypass system 127.0.0.1)
setServers(['8.8.8.8']);

// Promisify dns.resolve with explicit rrtype
const dnsResolveAsync = (hostname) => {
  return new Promise((resolve, reject) => {
    dnsResolve(hostname, 'A', (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses);
    });
  });
};

// Test domains - well-known corporate domains
const TEST_DOMAINS = [
  'google.com',
  'microsoft.com',
  'cloudflare.com',
  'apple.com',
  'github.com',
  'example.com',
  'example.org',
  'amazon.com',
  'netflix.com',
  'adobe.com',
  'oracle.com',
  'intel.com',
  'cisco.com',
  'wikipedia.org',
  'openai.com',

  // Turkifsaclub pattern domains (known live)
  'turkifsaclub100.sbs',
  'turkifsaclub101.sbs',
  'turkifsaclub102.sbs',
  'turkifsaclub103.sbs',
  'turkifsaclub104.sbs',
  'turkifsaclub105.sbs',
  'turkifsaclub106.sbs',
  'turkifsaclub107.sbs',
  'turkifsaclub108.sbs',
  'turkifsaclub109.sbs',
  'turkifsaclub110.sbs',
  'turkifsaclub111.sbs',
  'turkifsaclub112.sbs',
  'turkifsaclub113.sbs',
  'turkifsaclub114.sbs',
  'turkifsaclub115.sbs',
  'turkifsaclub116.sbs',
  'turkifsaclub117.sbs',
  'turkifsaclub118.sbs',
  'turkifsaclub119.sbs',
  'turkifsaclub120.sbs',
];

/**
 * Method 1: Node.js dns.resolve(hostname, 'A') — custom resolver
 */
async function methodResolve(hostname, timeoutMs = 3000) {
  const start = Date.now();
  try {
    const addresses = await Promise.race([
      dnsResolveAsync(hostname),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
    ]);
    return { success: true, ips: addresses, ms: Date.now() - start };
  } catch (err) {
    return { success: false, error: err.message, code: err.code, ms: Date.now() - start };
  }
}

/**
 * Method 2: dnslookup CLI — ameshkov/dnslookup (GitHub releases binary)
 */
async function methodDnslookup(hostname, timeoutMs = 3000) {
  const start = Date.now();
  try {
    // Try to find dnslookup in PATH
    const { stdout } = await execFileAsync('where.exe', ['dnslookup']);
    const lines = stdout.trim().split('\r\n').filter(Boolean);
    if (lines.length === 0) {
      throw new Error('dnslookup not found in PATH');
    }
    const exePath = lines[0].trim();

    const { stdout: output } = await Promise.race([
      execFileAsync(exePath, [hostname]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
    ]);

    // dnslookup returns one IP per line, possibly with extra text
    const ips = output
      .trim()
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => /^\d+\.\d+\.\d+\.\d+$/.test(l));

    return { success: true, ips, ms: Date.now() - start };
  } catch (err) {
    return { success: false, error: err.message, ms: Date.now() - start };
  }
}

/**
 * Method 3: dns.lookup() — system resolver (getaddrinfo)
 */
async function methodLookup(hostname, timeoutMs = 3000) {
  const start = Date.now();
  try {
    const { address, family } = await Promise.race([
      dnsLookupAsync(hostname),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
    ]);
    return { success: true, ips: [address], family, ms: Date.now() - start };
  } catch (err) {
    return { success: false, error: err.message, code: err.code, ms: Date.now() - start };
  }
}

/**
 * Format result for display
 */
function fmt(r) {
  if (!r.success) {
    const code = r.code ? ` [${r.code}]` : '';
    return `FAIL ${r.error}${code}, ${r.ms}ms`;
  }
  return `OK ${r.ips.slice(0, 2).join(', ')}, ${r.ms}ms`;
}

const PAD = 16;

/**
 * Main
 */
async function main() {
  console.log('');
  console.log('==========================================');
  console.log('  DNS Resolver Comparison Test');
  console.log('==========================================');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`DNS servers: ${getServers().join(', ') || '(system default)'}`);
  console.log('');
  console.log(`Domain`.padEnd(PAD) +
    `dns.resolve()`.padEnd(PAD * 3) +
    `dnslookup CLI`.padEnd(PAD * 3) +
    `dns.lookup()`);
  console.log('-'.repeat(PAD * 9));

  const stats = { resolve: 0, dnslookup: 0, lookup: 0 };

  for (const domain of TEST_DOMAINS) {
    const [r1, r2, r3] = await Promise.allSettled([
      methodResolve(domain),
      methodDnslookup(domain),
      methodLookup(domain),
    ]);

    const v1 = r1.status === 'fulfilled' ? r1.value : { success: false, error: r1.reason, ms: 0 };
    const v2 = r2.status === 'fulfilled' ? r2.value : { success: false, error: r2.reason, ms: 0 };
    const v3 = r3.status === 'fulfilled' ? r3.value : { success: false, error: r3.reason, ms: 0 };

    if (v1.success) stats.resolve++;
    if (v2.success) stats.dnslookup++;
    if (v3.success) stats.lookup++;

    console.log(
      domain.padEnd(PAD) +
      fmt(v1).padEnd(PAD * 3) +
      fmt(v2).padEnd(PAD * 3) +
      fmt(v3)
    );
  }

  console.log('');
  console.log('==========================================');
  console.log('  Results');
  console.log('==========================================');
  console.log(`dns.resolve()   OK: ${stats.resolve} / ${TEST_DOMAINS.length}`);
  console.log(`dnslookup CLI   OK: ${stats.dnslookup} / ${TEST_DOMAINS.length}`);
  console.log(`dns.lookup()    OK: ${stats.lookup} / ${TEST_DOMAINS.length}`);

  if (stats.lookup > stats.resolve) {
    console.log('');
    console.log('  ✅ dns.lookup() (system resolver) is most reliable');
    console.log('  💡 Replace dns.resolve() → dns.lookup() in production');
  }
  console.log('');
}

main().catch(console.error);
