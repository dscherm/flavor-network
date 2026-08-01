// MAKE-WEBLINK-FN (2026-05-30). Lifted from bookstrapCB
// (D:/Projects/bookstrapCB/functions/src/scrape/handler.ts — the
// ssrfReason / isInternalIPv4 / isInternalIPv6 / assertHostnameResolvesPublicly
// / pinnedAgent block). No app-specific changes — the SSRF threat
// model is identical (callable accepts user-supplied URLs, runs inside
// GCP infra where 169.254.169.254 is the metadata service).
//
// DO NOT relax these checks. The function runs inside Firebase Functions
// (Google infra). Without these guards a malicious URL could exfiltrate
// metadata, scan internal services, or perform DNS rebinding attacks.

import { lookup } from 'node:dns/promises';

export const REDIRECT_MAX = 5;

/**
 * SSRF guard. Reject literal IPs in dangerous ranges + known internal
 * hostname aliases + URLs carrying credentials in the userinfo position.
 *
 * Hostname-based URLs (the common case) skip the literal-IP path and rely
 * on assertHostnameResolvesPublicly() for DNS-based validation.
 */
export function ssrfReason(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'invalid URL';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return `unsupported URL scheme: ${u.protocol}`;
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host) return 'invalid URL: empty hostname';

  // Reject URLs that carry credentials in the userinfo position.
  // `https://user:pass@host/` would cause fetch to send an Authorization
  // header on our behalf; some historical URL parsers also mis-parse
  // chains like `https://a@b@c/` so the effective host is not what a
  // human reading the URL would expect.
  if (u.username || u.password) {
    return `forbidden URL credentials: ${u.username ? 'username' : 'password'} present`;
  }

  if (isInternalIPv4(host)) return `forbidden internal host: ${host}`;
  if (isInternalIPv6(host)) return `forbidden internal host: ${host}`;

  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower === 'metadata.google.internal' || lower === 'metadata') {
    return `forbidden internal host: ${host}`;
  }
  return null;
}

export function isInternalIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = [m[1], m[2], m[3], m[4]].map((s) => Number(s));
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  // 0.0.0.0/8 unspecified, 10/8 private, 127/8 loopback, 169.254/16 link-local,
  // 172.16/12 private, 192.168/16 private, 224/4 multicast, 240/4 reserved.
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

export function isInternalIPv6(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === '::1' || lower === '::' || lower === '0:0:0:0:0:0:0:1') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  if (lower.startsWith('::ffff:')) {
    const tail = lower.slice('::ffff:'.length);
    if (tail.includes('.')) return isInternalIPv4(tail);
    const groups = tail.split(':');
    if (groups.length !== 2) return false;
    const hi = parseInt(groups[0], 16);
    const lo = parseInt(groups[1], 16);
    if (Number.isNaN(hi) || Number.isNaN(lo)) return false;
    const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isInternalIPv4(dotted);
  }
  return false;
}

function isLiteralIp(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || host.includes(':');
}

/**
 * DNS-aware SSRF check. ssrfReason() blocks literal-IP and known-alias
 * hosts, but a custom domain that resolves to an internal IP (whether by
 * attacker design or via DNS rebinding with short TTL) slips through the
 * synchronous guard. Resolve the hostname right before fetch and refuse
 * if any returned address is internal. Returns the IP to pin (or null
 * when the host is a literal IP and no pin is needed).
 */
export async function assertHostnameResolvesPublicly(url: string): Promise<string | null> {
  const u = new URL(url);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (isLiteralIp(host)) return null;
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`forbidden internal host: ${host} (DNS lookup failed: ${msg})`);
  }
  if (addresses.length === 0) {
    throw new Error(`forbidden internal host: ${host} (no addresses returned)`);
  }
  for (const { address, family } of addresses) {
    const internal =
      family === 4 ? isInternalIPv4(address) : isInternalIPv6(address);
    if (internal) {
      throw new Error(`forbidden internal host: ${host} resolves to ${address}`);
    }
  }
  return addresses[0].address;
}

// REMOVED 2026-08-01: pinnedAgent(). It built an undici Agent that forced the
// TCP connection to a pre-validated IP, to close the DNS-rebinding window
// between our lookup and undici's connect-time lookup. It was never wired up
// — handler.ts explains the decision at the assertHostnameResolvesPublicly()
// call site: undici 6's connect.lookup signature is incompatible with node's
// classic (err, addr, family) form, and the residual attack surface (a
// rebind landing in the milliseconds between two lookups, against an
// auth-gated endpoint) was judged too narrow to justify the complexity.
//
// Deleted because it was the ONLY reason `undici` was a direct dependency,
// and that dependency carried a high-severity advisory. Dead code that
// imports a vulnerable package is a liability with no upside. The live
// defences are unchanged: ssrfReason() + assertHostnameResolvesPublicly(),
// both re-run on every redirect hop.
//
// If IP pinning is revisited, note that undici's Agent connect.lookup has
// since changed — check the current signature rather than restoring this.
