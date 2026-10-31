/**
 * URL safety / SSRF guard.
 *
 * Rules:
 *  - Only http: and https: schemes.
 *  - No embedded credentials (user:pass@host).
 *  - Hostname must not be localhost / *.localhost / *.local / *.internal or a bare single-label name.
 *  - Literal IPs (v4, v6, v4-mapped v6, decimal/hex/octal-encoded v4) in private, loopback,
 *    link-local, CGNAT, multicast, reserved or unspecified ranges are rejected.
 *
 * NOTE: This is a syntactic check. Before fetching server-side, callers must ALSO resolve the
 * hostname (DNS) and re-check every resolved address with `isPrivateIp` to defeat DNS rebinding.
 * See `assertPublicHost` in src/server/services/sourceExtractor.ts (Phase 2).
 */

export type UrlCheckResult =
  | { ok: true; url: URL; normalized: string }
  | { ok: false; reason: string };

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".home.arpa"];
const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback", "metadata.google.internal"]);

/** Parse a dotted IPv4 string (strict, decimal). Returns 4 octets or null. */
function parseIPv4(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    octets.push(n);
  }
  return octets as [number, number, number, number];
}

export function isPrivateIPv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 192 && b === 0 && (octets[2] === 0 || octets[2] === 2)) return true; // 192.0.0/24, TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18/15
  if (a === 198 && b === 51 && octets[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && octets[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast 224/4 + reserved 240/4 + broadcast
  return false;
}

function expandIPv6(host: string): number[] | null {
  let h = host.toLowerCase();
  const zone = h.indexOf("%");
  if (zone !== -1) h = h.slice(0, zone);
  // Embedded IPv4 tail (e.g. ::ffff:127.0.0.1)
  let tail: number[] = [];
  const lastColon = h.lastIndexOf(":");
  const maybeV4 = h.slice(lastColon + 1);
  if (maybeV4.includes(".")) {
    const v4 = parseIPv4(maybeV4);
    if (!v4) return null;
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    h = h.slice(0, lastColon + 1) + "0:0";
  }
  const halves = h.split("::");
  if (halves.length > 2) return null;
  const parse = (s: string) => (s === "" ? [] : s.split(":"));
  const head = parse(halves[0] ?? "");
  const rest = halves.length === 2 ? parse(halves[1] ?? "") : [];
  const groups = halves.length === 2 ? [...head, ...Array(8 - head.length - rest.length).fill("0"), ...rest] : head;
  if (groups.length !== 8) return null;
  const nums: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    nums.push(parseInt(g, 16));
  }
  if (tail.length === 2) {
    nums[6] = tail[0]!;
    nums[7] = tail[1]!;
  }
  return nums;
}

export function isPrivateIPv6(groups: number[]): boolean {
  const [g0 = 0, , , , , g5 = 0, g6 = 0, g7 = 0] = groups;
  const allZeroUntil = (n: number) => groups.slice(0, n).every((g) => g === 0);
  if (allZeroUntil(8)) return true; // ::
  if (allZeroUntil(7) && g7 === 1) return true; // ::1
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d
  if ((allZeroUntil(5) && g5 === 0xffff) || allZeroUntil(6)) {
    return isPrivateIPv4([g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff]);
  }
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  if (g0 === 0x2001 && groups[1] === 0x0db8) return true; // documentation
  if (g0 === 0x0064 && groups[1] === 0xff9b) {
    // NAT64 embeds IPv4 in last 32 bits
    return isPrivateIPv4([g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff]);
  }
  return false;
}

/** True if `ip` is a literal IP address in a non-public range. Non-IP strings return false. */
export function isPrivateIp(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "");
  const v4 = parseIPv4(bare);
  if (v4) return isPrivateIPv4(v4);
  if (bare.includes(":")) {
    const v6 = expandIPv6(bare);
    return v6 ? isPrivateIPv6(v6) : true; // unparsable v6-looking host: fail closed
  }
  return false;
}

/** Hostnames made only of digits/hex/dots that aren't canonical dotted-quad (e.g. 2130706433, 0x7f.1) */
function looksLikeObfuscatedIPv4(host: string): boolean {
  if (parseIPv4(host)) return false;
  return /^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){0,3}$/i.test(host);
}

export function checkUrl(input: string): UrlCheckResult {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "URL is empty." };
  if (raw.length > 2048) return { ok: false, reason: "URL is too long (max 2048 characters)." };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Not a valid URL. Include http:// or https://." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https URLs are allowed." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URLs with embedded credentials are not allowed." };
  }

  // WHATWG URL already normalises decimal/hex IPv4 into dotted form, but check defensively.
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, reason: "URL has no host." };

  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "Local or internal hostnames are not allowed." };
  }
  if (looksLikeObfuscatedIPv4(host)) {
    return { ok: false, reason: "Numeric-encoded IP addresses are not allowed." };
  }
  if (isPrivateIp(host)) {
    return { ok: false, reason: "Private, loopback or reserved IP addresses are not allowed." };
  }
  const isIpLiteral = parseIPv4(host) !== null || host.startsWith("[");
  if (!isIpLiteral && !host.includes(".")) {
    return { ok: false, reason: "Hostname must be a fully-qualified public domain." };
  }

  url.hash = "";
  return { ok: true, url, normalized: url.toString() };
}

/** Normalised key for de-duplicating URLs (scheme+host lowercased, trailing slash and fragment stripped). */
export function urlDedupKey(url: URL): string {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "";
  return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
}
