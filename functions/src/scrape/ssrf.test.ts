import { describe, it, expect } from 'vitest';
import { ssrfReason, isInternalIPv4, isInternalIPv6 } from './ssrf';

describe('ssrfReason', () => {
  it('passes typical public URLs', () => {
    expect(ssrfReason('https://www.nytimes.com/cooking/recipe')).toBeNull();
    expect(ssrfReason('http://cooking.example.com/path?q=1')).toBeNull();
  });

  it('rejects literal-IP loopback / private / link-local', () => {
    expect(ssrfReason('http://127.0.0.1/')).toMatch(/forbidden internal host/);
    expect(ssrfReason('http://10.0.0.1/')).toMatch(/forbidden internal host/);
    expect(ssrfReason('http://192.168.1.1/')).toMatch(/forbidden internal host/);
    expect(ssrfReason('http://169.254.169.254/')).toMatch(/forbidden internal host/);
    expect(ssrfReason('http://172.16.0.1/')).toMatch(/forbidden internal host/);
    expect(ssrfReason('http://172.31.255.255/')).toMatch(/forbidden internal host/);
  });

  it('rejects IPv6 loopback / link-local / unique-local', () => {
    expect(ssrfReason('http://[::1]/')).toMatch(/forbidden internal host/);
    expect(ssrfReason('http://[fe80::1]/')).toMatch(/forbidden internal host/);
    expect(ssrfReason('http://[fc00::1]/')).toMatch(/forbidden internal host/);
    expect(ssrfReason('http://[fd00::1]/')).toMatch(/forbidden internal host/);
  });

  it('rejects IPv4-mapped IPv6 (::ffff:127.0.0.1 dotted)', () => {
    expect(ssrfReason('http://[::ffff:127.0.0.1]/')).toMatch(/forbidden internal host/);
  });

  it('rejects known internal hostname aliases', () => {
    expect(ssrfReason('http://localhost/')).toMatch(/forbidden internal host/);
    expect(ssrfReason('http://metadata.google.internal/')).toMatch(/forbidden internal host/);
    expect(ssrfReason('http://metadata/')).toMatch(/forbidden internal host/);
  });

  it('rejects URLs with credentials in the userinfo position', () => {
    expect(ssrfReason('https://user:pass@example.com/')).toMatch(/forbidden URL credentials/);
    expect(ssrfReason('https://user@example.com/')).toMatch(/forbidden URL credentials/);
  });

  it('rejects unsupported schemes (file:, javascript:)', () => {
    expect(ssrfReason('file:///etc/passwd')).toMatch(/unsupported URL scheme/);
    expect(ssrfReason('javascript:alert(1)')).toMatch(/unsupported URL scheme/);
  });

  it('rejects invalid URLs', () => {
    expect(ssrfReason('not a url')).toBe('invalid URL');
    expect(ssrfReason('')).toBe('invalid URL');
  });

  it('passes public IPv4 (e.g. 8.8.8.8)', () => {
    expect(ssrfReason('http://8.8.8.8/')).toBeNull();
    expect(ssrfReason('http://1.1.1.1/')).toBeNull();
  });
});

describe('isInternalIPv4', () => {
  it('flags 0.0.0.0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 224+/4', () => {
    expect(isInternalIPv4('0.0.0.0')).toBe(true);
    expect(isInternalIPv4('10.255.255.255')).toBe(true);
    expect(isInternalIPv4('127.0.0.1')).toBe(true);
    expect(isInternalIPv4('169.254.0.1')).toBe(true);
    expect(isInternalIPv4('172.16.0.0')).toBe(true);
    expect(isInternalIPv4('172.31.255.255')).toBe(true);
    expect(isInternalIPv4('192.168.0.0')).toBe(true);
    expect(isInternalIPv4('224.0.0.1')).toBe(true);
    expect(isInternalIPv4('255.255.255.255')).toBe(true);
  });

  it('passes public IPv4', () => {
    expect(isInternalIPv4('8.8.8.8')).toBe(false);
    expect(isInternalIPv4('1.1.1.1')).toBe(false);
    expect(isInternalIPv4('172.15.255.255')).toBe(false); // just below the 172.16/12 range
    expect(isInternalIPv4('172.32.0.0')).toBe(false);     // just above
  });

  it('passes non-IPv4 strings', () => {
    expect(isInternalIPv4('::1')).toBe(false);
    expect(isInternalIPv4('localhost')).toBe(false);
    expect(isInternalIPv4('999.999.999.999')).toBe(false);
  });
});

describe('isInternalIPv6', () => {
  it('flags loopback / unspecified / link-local / unique-local', () => {
    expect(isInternalIPv6('::1')).toBe(true);
    expect(isInternalIPv6('::')).toBe(true);
    expect(isInternalIPv6('0:0:0:0:0:0:0:1')).toBe(true);
    expect(isInternalIPv6('fe80::1')).toBe(true);
    expect(isInternalIPv6('fc00::1')).toBe(true);
    expect(isInternalIPv6('fd12::1')).toBe(true);
  });

  it('flags IPv4-mapped IPv6 in dotted + hex-compressed forms', () => {
    expect(isInternalIPv6('::ffff:127.0.0.1')).toBe(true);
    expect(isInternalIPv6('::ffff:7f00:1')).toBe(true);
    expect(isInternalIPv6('::ffff:8.8.8.8')).toBe(false);
  });

  it('passes public IPv6', () => {
    expect(isInternalIPv6('2001:4860:4860::8888')).toBe(false);
  });
});
