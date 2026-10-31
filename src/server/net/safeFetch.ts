import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { promisify } from "node:util";
import { Agent, fetch as undiciFetch } from "undici";
import { checkUrl, isPrivateIp } from "@/lib/url-safety";

/**
 * SSRF-hardened fetch for user-supplied URLs.
 *
 *  1. `checkUrl()` syntactic guard on the initial URL and on every redirect hop.
 *  2. `assertPublicHost()` resolves DNS and rejects any private/reserved address before connecting.
 *  3. The undici Agent's `connect.lookup` re-checks the address actually used for the TCP connection,
 *     which closes the DNS-rebinding window between step 2 and the connect.
 *  4. Manual redirect handling (max 5 hops), a hard timeout and a response-size cap.
 */

export class FetchBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchBlockedError";
  }
}

export class FetchFailedError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "FetchFailedError";
    this.status = status;
  }
}

type LookupFn = (hostname: string) => Promise<LookupAddress[]>;
const defaultLookup: LookupFn = (hostname) => promisify(dnsLookup)(hostname, { all: true, verbatim: true }) as Promise<LookupAddress[]>;

/** Resolve `hostname` and throw if it has no addresses or ANY address is private/reserved. */
export async function assertPublicHost(hostname: string, lookupImpl: LookupFn = defaultLookup): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new FetchBlockedError("Private, loopback or reserved IP addresses are not allowed.");
    return;
  }
  let addrs: LookupAddress[];
  try {
    addrs = await lookupImpl(host);
  } catch {
    throw new FetchFailedError(`Could not resolve host ${host}.`);
  }
  if (addrs.length === 0) throw new FetchFailedError(`Host ${host} has no DNS records.`);
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw new FetchBlockedError(`Host ${host} resolves to a private or reserved address; refusing to fetch.`);
    }
  }
}

let agent: Agent | null = null;
function getGuardedAgent(): Agent {
  if (agent) return agent;
  agent = new Agent({
    connect: {
      // Re-validate the address used for the actual connection (anti DNS-rebinding).
      lookup(hostname, options, callback) {
        dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
          if (err) return callback(err, "", 4);
          const list = (Array.isArray(addresses) ? addresses : []) as LookupAddress[];
          const bad = list.find((a) => isPrivateIp(a.address));
          if (bad || list.length === 0) {
            return callback(new FetchBlockedError(`Blocked connection to non-public address for ${hostname}.`), "", 4);
          }
          if ((options as { all?: boolean }).all) {
            (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
          } else {
            callback(null, list[0]!.address, list[0]!.family);
          }
        });
      },
    },
    headersTimeout: 15_000,
    bodyTimeout: 20_000,
  });
  return agent;
}

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  maxRedirects?: number;
  /** Test seam: replaces undici fetch. */
  fetchImpl?: typeof fetch;
  lookupImpl?: LookupFn;
};

export type SafeFetchResult = {
  finalUrl: string;
  status: number;
  contentType: string;
  headers: Headers;
  bytes: Uint8Array;
  truncated: boolean;
};

// Browser-like UA with a GapLens token: several government sites return 403 to "bot" user agents.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 GapLens/1.0";

export async function safeFetch(input: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 5;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = input;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const checked = checkUrl(current);
      if (!checked.ok) throw new FetchBlockedError(checked.reason);
      await assertPublicHost(checked.url.hostname, opts.lookupImpl);

      const init = {
        method: "GET",
        redirect: "manual" as const,
        signal: controller.signal,
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8", "Accept-Language": "en-IN,en;q=0.9", ...opts.headers },
      };
      let res: Response;
      try {
        res = opts.fetchImpl
          ? await opts.fetchImpl(checked.normalized, init)
          : ((await undiciFetch(checked.normalized, { ...init, dispatcher: getGuardedAgent() })) as unknown as Response);
      } catch (err) {
        if (controller.signal.aborted) throw new FetchFailedError(`Timed out after ${Math.round(timeoutMs / 1000)}s.`);
        const cause = (err as { cause?: unknown }).cause;
        if (cause instanceof FetchBlockedError) throw cause;
        throw new FetchFailedError(`Network error: ${(cause as Error)?.message ?? (err as Error).message}`);
      }

      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, checked.normalized).toString();
        await res.body?.cancel().catch(() => undefined);
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        throw new FetchFailedError(`HTTP ${res.status} from ${checked.url.hostname}.`, res.status);
      }
      const declared = Number(res.headers.get("content-length") ?? "0");
      if (declared > maxBytes * 4) {
        await res.body?.cancel().catch(() => undefined);
        throw new FetchFailedError(`Response too large (${Math.round(declared / 1024 / 1024)} MB).`);
      }
      const { bytes, truncated } = await readCapped(res, maxBytes);
      return { finalUrl: checked.normalized, status: res.status, contentType: res.headers.get("content-type") ?? "", headers: res.headers, bytes, truncated };
    }
    throw new FetchFailedError(`Too many redirects (>${maxRedirects}).`);
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!res.body) return { bytes: new Uint8Array(await res.arrayBuffer()).slice(0, maxBytes), truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      chunks.push(value.slice(0, maxBytes - total));
      total = maxBytes;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return { bytes: out, truncated };
}

/** Decode bytes using the charset from content-type (default utf-8). */
export function decodeBody(bytes: Uint8Array, contentType: string): string {
  const m = /charset=([\w-]+)/i.exec(contentType);
  try {
    return new TextDecoder(m?.[1]?.toLowerCase() ?? "utf-8", { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
